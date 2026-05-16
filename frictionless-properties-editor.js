// Filename: frictionless-properties-editor.js
// Version: 1.1.1

module.exports = async (params) => {
    const { app } = params;
    const activeEditor = app.workspace.activeEditor;
    if (!activeEditor?.editor) return;

    const { editor, file } = activeEditor;
    const cursor = editor.getCursor();
    const coords = editor.coordsAtPos(cursor);
    const cache = app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter || {};
    const existingKeys = Object.keys(frontmatter).filter(k => k !== 'position');

    const registeredProperties = app.metadataTypeManager?.properties || app.metadataTypeManager?.registeredProperties || {};
    const vaultTags = Object.keys(app.metadataCache.getTags() || {}).map(t => t.replace(/^#/, ''));

    // --- Helper: Safe Type Extraction ---
    const getTypeForKey = (key) => {
        const propTypeObj = registeredProperties[key];
        if (typeof propTypeObj === 'string') return propTypeObj;
        if (propTypeObj && typeof propTypeObj.type === 'string') return propTypeObj.type;
        return 'text';
    };

    // --- Hardcoded Lucide SVGs for QuickAdd Compatibility ---
    const SVG_ICONS = {
        text: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>`,
        tags: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`,
        hash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>`,
        list: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`,
        calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        clock: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
        'check-square': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
        forward: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg>`,
        x: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
    };

    const injectIcon = (el, type) => {
        el.innerHTML = SVG_ICONS[type] || SVG_ICONS.text;
    };

    const getIconNameForType = (type, key) => {
        const lowerKey = (key || '').toLowerCase();
        if (lowerKey === 'tags') return 'tags';
        if (lowerKey === 'aliases') return 'forward';

        switch ((type || '').toLowerCase()) {
            case 'number': return 'hash';
            case 'checkbox': return 'check-square';
            case 'date': return 'calendar';
            case 'datetime': return 'clock';
            case 'multitext':
            case 'list': return 'list';
            case 'text':
            default: return 'text';
        }
    };

    // --- State Management ---
    let state = {
        key: '',
        type: 'text',
        isList: false,
        listValues: []
    };

    // --- Widget Setup ---
    const widget = document.createElement('div');
    widget.style.cssText = `
        position: absolute;
        top: ${coords.top - 45}px;
        left: ${coords.left + 20}px;
        z-index: var(--layer-popover);
        background: var(--background-primary);
        border: 4px solid var(--interactive-accent);
        border-radius: var(--radius-m);
        padding: 1em;
        margin: 4px;
        box-shadow: var(--shadow-l);
        display: flex;
        gap: 6px;
        align-items: flex-start;
        font-family: var(--font-interface);
        min-width: 250px;
    `;

    // --- 1. Property Chooser & Autocomplete ---
    const propContainer = document.createElement('div');
    propContainer.style.cssText = `
        position: relative; display: flex; align-items: center; 
        padding-left: 6px; border-radius: var(--radius-s);
        border: 1px solid transparent;
        transition: border-color 0.15s ease;
    `;

    const propIcon = document.createElement('div');
    propIcon.style.cssText = `
        display: flex; align-items: center; justify-content: center; 
        width: 16px; height: 16px; color: var(--text-muted); opacity: 0.8;
    `;
    injectIcon(propIcon, 'text');

    const propInput = document.createElement('input');
    propInput.placeholder = "Property...";
    propInput.style.cssText = `
        background: transparent; border: none;
        color: var(--text-normal); width: 130px;
        font-size: var(--font-ui-small); outline: none;
        padding: 4px 8px; height: 28px;
    `;

    const suggester = document.createElement('div');
    suggester.style.cssText = `
        position: absolute; top: 100%; left: 0; width: 100%;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: var(--radius-s);
        max-height: 150px; overflow-y: auto; display: none;
        box-shadow: var(--shadow-s); z-index: var(--layer-menu);
    `;

    propContainer.append(propIcon, propInput, suggester);

    // --- 2. Value Chooser Container & Tag Suggester ---
    const valContainer = document.createElement('div');
    valContainer.style.cssText = `
        position: relative; display: flex; align-items: center; gap: 4px;
        padding: 4px 8px; flex-wrap: wrap; max-width: 350px;
        min-height: 28px; flex-grow: 1; border-radius: var(--radius-s);
        border: 1px solid transparent;
        transition: border-color 0.15s ease;
    `;

    const valInput = document.createElement('input');
    valInput.style.cssText = `
        background: transparent; border: none;
        color: var(--text-normal); font-size: var(--font-ui-small);
        outline: none; flex-grow: 1; min-width: 80px; height: 20px;
    `;

    const valSuggester = document.createElement('div');
    valSuggester.style.cssText = `
        position: absolute; top: 100%; left: 0; width: 100%;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: var(--radius-s);
        max-height: 150px; overflow-y: auto; display: none;
        box-shadow: var(--shadow-s); z-index: var(--layer-menu);
    `;

    valContainer.appendChild(valInput);
    valContainer.appendChild(valSuggester);
    widget.append(propContainer, valContainer);
    document.body.appendChild(widget);

    // --- Focus Highlighting Logic ---
    propInput.addEventListener('focus', () => propContainer.style.borderColor = 'var(--interactive-accent)');
    propInput.addEventListener('blur', () => propContainer.style.borderColor = 'transparent');

    valInput.addEventListener('focus', () => valContainer.style.borderColor = 'var(--interactive-accent)');
    valInput.addEventListener('blur', () => valContainer.style.borderColor = 'transparent');

    // --- Property Autocomplete Logic ---
    let filteredKeys = [...existingKeys];
    let selectedIndex = 0;

    const renderSuggestions = () => {
        suggester.innerHTML = '';
        if (filteredKeys.length === 0) {
            suggester.style.display = 'none';
            return;
        }
        suggester.style.display = 'block';
        filteredKeys.forEach((key, index) => {
            const type = getTypeForKey(key);

            const item = document.createElement('div');
            item.style.cssText = `
                display: flex; align-items: center; gap: 8px;
                padding: 4px 8px; font-size: var(--font-ui-small);
                cursor: pointer; color: var(--text-muted);
                background: ${index === selectedIndex ? 'var(--background-modifier-hover)' : 'transparent'};
            `;

            const iconEl = document.createElement('div');
            iconEl.style.cssText = `display: flex; align-items: center; width: 14px; height: 14px; opacity: 0.7;`;
            injectIcon(iconEl, getIconNameForType(type, key));

            const textEl = document.createElement('span');
            textEl.textContent = key;

            item.append(iconEl, textEl);

            item.addEventListener('click', () => selectProperty(key));
            suggester.appendChild(item);
        });
    };

    propInput.addEventListener('input', () => {
        const query = propInput.value.toLowerCase();
        filteredKeys = existingKeys.filter(k => k.toLowerCase().includes(query));
        selectedIndex = filteredKeys.length > 0 ? 0 : -1;
        renderSuggestions();
    });

    renderSuggestions();

    propInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, filteredKeys.length - 1);
            renderSuggestions();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            renderSuggestions();
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (selectedIndex >= 0 && filteredKeys[selectedIndex]) {
                selectProperty(filteredKeys[selectedIndex]);
            }
        }
    });

    // --- Value (Tag) Autocomplete Logic ---
    let valFiltered = [];
    let valSelectedIndex = 0;

    // Filename: frictionless-properties-editor.js
    // Version: 1.1.1

    const renderValSuggestions = () => {
        valSuggester.innerHTML = '';
        if (valFiltered.length === 0 || !state.isList) {
            valSuggester.style.display = 'none';
            return;
        }
        valSuggester.style.display = 'block';
        valFiltered.forEach((tag, index) => {
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex; align-items: center; justify-content: space-between; gap: 8px;
                padding: 4px 8px; font-size: var(--font-ui-small);
                cursor: pointer; color: var(--text-muted);
                background: ${index === valSelectedIndex ? 'var(--background-modifier-hover)' : 'transparent'};
            `;

            // Text label container - visually handle bracketed strings or raw text cleanly
            const isBracketed = typeof tag === 'string' && tag.startsWith('[[') && tag.endsWith(']]');
            const cleanDisplay = isBracketed
                ? tag.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|').pop()
                : tag;

            const textEl = document.createElement('span');
            textEl.textContent = cleanDisplay;
            item.appendChild(textEl);

            // Determine if the value functions as an internal note link
            const lookupPath = isBracketed ? tag.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0] : tag;
            const pointsToNote = typeof tag === 'string' && !!app.metadataCache.getFirstLinkpathDest(lookupPath, '');
            const isWikiLink = isBracketed || pointsToNote;

            if (isWikiLink) {
                const linkIconEl = document.createElement('div');
                linkIconEl.style.cssText = `
                    display: flex; align-items: center; width: 14px; height: 14px; 
                    opacity: 0.6; cursor: pointer;
                `;
                linkIconEl.className = 'clickable-icon';
                injectIcon(linkIconEl, 'link');

                // Allow clicking the icon itself to natively navigate to the note
                linkIconEl.addEventListener('click', (e) => {
                    e.stopPropagation(); // Stop from choosing the autocomplete choice
                    app.workspace.openLinkText(lookupPath, '', true);
                });

                item.appendChild(linkIconEl);
            }

            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                // Wrap the selection back inside wikilink syntax if it resolves to a valid note
                const committedValue = isBracketed ? tag : (pointsToNote ? `[[${tag}]]` : tag);
                commitVal(committedValue);
            });
            valSuggester.appendChild(item);
        });
    };

    const updateValSuggestions = () => {
        if (!state.isList) {
            valSuggester.style.display = 'none';
            return;
        }
        const rawQuery = valInput.value.toLowerCase();
        let sourceValues = [];
        if (state.key.toLowerCase() === 'tags') {
            sourceValues = vaultTags;
        } else {
            const files = app.vault.getMarkdownFiles();
            const cacheValues = files.flatMap(f => app.metadataCache.getFileCache(f)?.frontmatter?.[state.key] || []);
            sourceValues = [...new Set(cacheValues.filter(v => typeof v === 'string'))];
        }
        const query = state.key.toLowerCase() === 'tags' ? rawQuery.replace(/^#/, '') : rawQuery;
        valFiltered = sourceValues.filter(v => v.toLowerCase().includes(query) && !state.listValues.includes(v));
        valSelectedIndex = valFiltered.length > 0 ? 0 : -1;
        renderValSuggestions();
    };

    valInput.addEventListener('input', updateValSuggestions);
    valInput.addEventListener('focus', updateValSuggestions);
    valInput.addEventListener('blur', () => { valSuggester.style.display = 'none'; });

    const commitVal = async (valStr) => {
        let trimmed = valStr.trim();
        if (state.key.toLowerCase() === 'tags' && trimmed.startsWith('#')) {
            trimmed = trimmed.replace(/^#+/, '');
        }
        if (!trimmed) return;

        state.listValues.push(trimmed);
        valInput.value = '';
        valSuggester.style.display = 'none';
        renderPills();
        await saveToFile(state.key, state.listValues);
        valInput.focus();
        updateValSuggestions();
    };

    // --- List & State Logic ---
    const renderPills = () => {
        valContainer.querySelectorAll('.multi-select-pill').forEach(p => p.remove());

        state.listValues.forEach((item, index) => {
            const pill = document.createElement('div');
            pill.className = 'multi-select-pill';
            pill.style.cssText = `
                display: flex; align-items: center; gap: 4px;
                background-color: var(--pill-background); color: var(--pill-color);
                padding: 2px 6px; border-radius: var(--pill-radius);
                font-size: var(--font-ui-smaller); border: var(--pill-border-width) solid var(--pill-border-color);
                white-space: nowrap;
            `;

            const text = document.createElement('span');
            text.textContent = item;

            const removeBtn = document.createElement('div');
            removeBtn.className = 'multi-select-pill-remove-button';
            removeBtn.style.cssText = `cursor: pointer; display: flex; align-items: center; opacity: 0.7;`;
            injectIcon(removeBtn, 'x');

            removeBtn.addEventListener('click', async () => {
                state.listValues.splice(index, 1);
                renderPills();
                await saveToFile(state.key, state.listValues);
                valInput.focus();
                updateValSuggestions();
            });

            pill.append(text, removeBtn);
            valContainer.insertBefore(pill, valInput);
        });
    };

    const selectProperty = (key) => {
        propInput.value = key;
        suggester.style.display = 'none';

        state.key = key;
        let detectedType = getTypeForKey(key);

        const lowerKey = key.toLowerCase();
        if (['tags', 'aliases', 'cssclasses'].includes(lowerKey)) {
            detectedType = 'tags';
        }
        state.type = detectedType;

        injectIcon(propIcon, getIconNameForType(state.type, key));

        const val = frontmatter[key];
        state.isList = ['multitext', 'list', 'tags', 'aliases'].includes(state.type) || Array.isArray(val);

        if (state.isList) {
            let parsedVal = val;
            if (typeof val === 'string') {
                parsedVal = val.split(',').map(s => s.trim()).filter(s => s);
            }
            state.listValues = Array.isArray(parsedVal) ? [...parsedVal] : (parsedVal ? [parsedVal.toString()] : []);

            renderPills();
            valInput.placeholder = "Add item...";
            valInput.type = 'text';
            valInput.value = '';
        } else {
            state.listValues = [];
            renderPills();
            valInput.value = val ?? '';
            valInput.placeholder = "Value...";
            valInput.type = state.type === 'number' ? 'number' : (state.type === 'date' ? 'date' : 'text');
            valSuggester.style.display = 'none';
        }

        valInput.focus();
    };

    valInput.addEventListener('keydown', async (e) => {
        if (state.isList && valSuggester.style.display === 'block') {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                valSelectedIndex = Math.min(valSelectedIndex + 1, valFiltered.length - 1);
                renderValSuggestions();
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                valSelectedIndex = Math.max(valSelectedIndex - 1, 0);
                renderValSuggestions();
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (valSelectedIndex >= 0 && valFiltered[valSelectedIndex]) {
                    e.preventDefault();
                    await commitVal(valFiltered[valSelectedIndex]);
                    return;
                }
            }
        }

        if (state.isList) {
            if (e.key === 'Enter' || (e.key === 'Escape' && valInput.value === '')) {
                e.preventDefault();
                e.stopPropagation();
                if (valInput.value.trim()) {
                    await commitVal(valInput.value);
                } else {
                    cleanup();
                }
            } else if (e.key === 'Backspace' && valInput.value === '') {
                e.preventDefault();
                if (state.listValues.length > 0) {
                    state.listValues.pop();
                    renderPills();
                    await saveToFile(state.key, state.listValues);
                    updateValSuggestions();
                }
            }
        } else {
            if (e.key === 'Enter') {
                e.preventDefault();
                let finalVal = valInput.value;
                if (state.type === 'number') finalVal = finalVal === '' ? null : Number(finalVal);
                if (state.type === 'checkbox') finalVal = finalVal.toLowerCase() === 'true';

                await saveToFile(state.key, finalVal);
                cleanup();
            }
        }
    });

    const saveToFile = async (key, value) => {
        await app.fileManager.processFrontMatter(file, fm => {
            if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
                fm[key] = Array.isArray(value) ? [] : value;
            } else {
                fm[key] = value;
            }
        });
        new Notice("The property was updated.");
    };

    // --- Lifecycle Management ---
    propInput.focus();

    const handleGlobalKeydown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cleanup();
        }
    };

    const handleGlobalMousedown = (e) => {
        if (!widget.contains(e.target)) {
            cleanup();
        }
    };

    const cleanup = () => {
        document.removeEventListener('keydown', handleGlobalKeydown);
        document.removeEventListener('mousedown', handleGlobalMousedown);
        widget.remove();
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('mousedown', handleGlobalMousedown);
};