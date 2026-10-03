/**
 * Open-in-View reveal policy - no VS Code / DOM dependencies.
 *
 * Background (verified in VS Code 1.140 with real tab groups):
 * - first open with ViewColumn.Beside lands in a new rightmost group and
 *   focuses the Diagrams panel without covering the Preview.
 * - reveal(Beside) on an existing panel MOVES it into the Preview's group,
 *   covering the Preview; reveal() with no args stays in place.
 * - resetting webview.html destroys the focused content, so same-diagram
 *   re-opens must not rebuild.
 */

export type DiagramsOpenAction = 'create' | 'noop' | 'reveal' | 'reveal-select' | 'reveal-rebuild';

export interface DiagramsOpenState {
    hasPanel: boolean;
    sameDocument: boolean;
    sameIndex: boolean;
    panelActive: boolean;
}

export function decideDiagramsOpen(state: DiagramsOpenState): DiagramsOpenAction {
    if (!state.hasPanel) return 'create';
    if (state.sameDocument && state.sameIndex && state.panelActive) return 'noop';
    if (state.sameDocument && state.sameIndex) return 'reveal';
    if (state.sameDocument) return 'reveal-select';
    return 'reveal-rebuild';
}
