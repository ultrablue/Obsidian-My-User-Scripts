/* 
Change log, etc.

    File created: 2026-01-18 gogogo@unm.edu
    script created by gemini.

----------------------------------------------------------

TODO
    Let the script accept the following variables from Quick Add:
       - scrollPercent

*/

module.exports = async (params) => {
    
    let percentage = 0.25;
    
    const { app } = params;
    const activeView = app.workspace.getActiveFileView();
    if (!activeView || activeView.getViewType() !== "markdown") return;

    const editor = activeView.editor;
    const pos = editor.getCursor();
    const scroller = activeView.contentEl.querySelector('.cm-scroller');
    if (!scroller) return;

    const cursorCoords = editor.coordsAtPos(pos);
    const scrollerRect = scroller.getBoundingClientRect();
    const viewportHeight = scroller.clientHeight;
    
    const cursorTopInScroller = cursorCoords.top - scrollerRect.top;
    const newScrollTop = scroller.scrollTop + cursorTopInScroller - (viewportHeight * percentage);

    // 1. Perform the jump
    scroller.scrollTo({ top: newScrollTop, behavior: 'auto' });

    // 2. QoL: Use document.elementFromPoint to find the line at the cursor's NEW position
    // We wait a tiny tick for the DOM to settle after the scroll
    setTimeout(() => {
        const lineEl = document.elementFromPoint(cursorCoords.left, scrollerRect.top + (viewportHeight * percentage));
        const lineToHighlight = lineEl?.closest('.cm-line');
        
        if (lineToHighlight) {
            lineToHighlight.animate([
                { backgroundColor: 'rgba(0, 167, 255, 0.4)' }, 
                { backgroundColor: 'transparent' }
            ], { duration: 1500, easing: 'ease-out' });
        }
    }, 10); 
};


