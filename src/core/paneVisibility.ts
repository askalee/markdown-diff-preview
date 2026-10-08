export type PaneVisibility = 'both' | 'preview' | 'diagrams';

export const DEFAULT_PANE_VISIBILITY: PaneVisibility = 'both';

export function isPaneVisibility(value: unknown): value is PaneVisibility {
    return value === 'both' || value === 'preview' || value === 'diagrams';
}

export function resolvePaneVisibility(
    visibility: unknown,
    diagramsVisible?: unknown,
): PaneVisibility {
    if (isPaneVisibility(visibility)) return visibility;
    // Legacy compat: webview state used diagramsVisible boolean.
    if (diagramsVisible === false) return 'preview';
    return DEFAULT_PANE_VISIBILITY;
}
