/*
Created: 2026-02-24 gogogo@unm.edu
Code provided by Gemini.

V1.0.0
Initial creation.

V1.0.1
The title property and the note title are distinct now.
The title property excludes leading #s.
The note title exludes leading #s.
The note title contains ⁇ instead of ?.

TODO
   When a wikilink with an alias is in the current line, the wikiklink isn't sanitized properly.

DONE
   It really needs to disntinguish between the title property and the note title, please.
      The problem is that the title property doesn't have the same restrictions that the 
      note title does in terms of characters.
   Let's fix these problems wih the sanitizer:
      - Clobber leading #s/
      - Replace ? with ⁇

*/




module.exports = async (params) => {
    const { app } = params;
    const view = app.workspace.activeLeaf?.view;

    // 1. Validation
    if (!view || view.getViewType() !== "markdown") {
        new Notice("No active Markdown view found.");
        return;
    }

    const editor = view.editor;
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line).trim();

    if (!lineText) {
        new Notice("The current line is empty!");
        return;
    }

    // 2. Orchestration
    const sanitizedTitle = sanitizeFilename(lineText);
    const sanitizedTitleProp = sanitizeTitleProp(lineText);
    const file = view.file;

    try {
        // Update metadata first
        await updateFrontmatterTitle(app, file, sanitizedTitleProp);
        
        // Rename the physical file
        await renameNoteFile(app, file, sanitizedTitle);

        // Restore UI state
        restoreEditorState(editor, cursor);
        
        new Notice(`Title and Filename updated: ${sanitizedTitle}`);
    } catch (error) {
        new Notice("Operation failed. See console for details.");
        console.error("QuickAdd Rename Error:", error);
    }
};

/**
 * Strips OS-illegal characters and Markdown formatting.
 */
function sanitizeFilename(text) {
    return text
        .replace(/[\\/:*"<>|]/g, '-') 
        .replace(/\[\[|\]\]/g, '')     
        .replace(/\*\*|__/g, '')
        .replace(/\*|_/g, '')
        .replace(/[.!|;:,]$/, '')
        .replace(/#+ */g, '')
        .replace(/\?+/gm, '⁇');
}

function sanitizeTitleProp(text) {
    returnText = '';
    returnText = text.replace(/#+ */g, '');
    return returnText;
}

/**
 * Updates or creates the 'title' property in YAML frontmatter.
 */
async function updateFrontmatterTitle(app, file, title) {
    await app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter["title"] = title;
    });
}

/**
 * Renames the file while preserving the current directory.
 */
async function renameNoteFile(app, file, newName) {
    const parentPath = file.parent.path === "/" ? "" : file.parent.path + "/";
    const newPath = `${parentPath}${newName}.md`;
    await app.fileManager.renameFile(file, newPath);
}

/**
 * Returns focus to the editor and restores the cursor position.
 */
function restoreEditorState(editor, cursor) {
    setTimeout(() => {
        editor.focus();
        editor.setCursor(cursor);
    }, 100);
}



