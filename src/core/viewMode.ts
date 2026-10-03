/**
 * View mode state for the Markdown preview panel.
 * - `normal`: show only the current markdown as-is (no diff chrome).
 * - `diff`: show the current git diff highlighting (previous behaviour).
 *
 * Persistence (option A): session memory only. The extension panel holds the
 * source of truth (`_viewMode`), defaulting to `normal`. The webview mirrors
 * it via `vscode.getState()/setState()` so a webview reload restores the UI
 * without changing the default for newly opened panels.
 */

import type { FileDiff } from './types';

export type ViewMode = 'normal' | 'diff';

export const DEFAULT_VIEW_MODE: ViewMode = 'normal';

export function isViewMode(value: unknown): value is ViewMode {
    return value === 'normal' || value === 'diff';
}

export function toggleViewMode(mode: ViewMode): ViewMode {
    return mode === 'normal' ? 'diff' : 'normal';
}

/**
 * Resolve which diff the renderer should see.
 * Normal mode always renders the current content (`null` diff).
 */
export function resolveEffectiveDiff(viewMode: ViewMode, diff: FileDiff | null): FileDiff | null {
    if (viewMode === 'normal') {
        return null;
    }
    return diff;
}

/** Whether diff-only header chrome (stats, vs base, nav) should be shown. */
export function shouldShowDiffChrome(viewMode: ViewMode): boolean {
    return viewMode === 'diff';
}
