/**
 * Preview click-to-navigate guard - no VS Code / DOM dependencies.
 * The Preview webview delegates single clicks on `.content` to editor
 * navigation via the closest `[data-line]` ancestor. Interactive controls
 * (e.g. the mermaid `Open in View` / `Code` buttons) live INSIDE
 * `[data-line]` containers, so without this guard every button click would
 * also yank focus to the Markdown editor via scrollToLine.
 */

export const NON_NAVIGABLE_SELECTOR =
    'button, a, input, select, textarea, summary, [contenteditable], .comment-thread, .mermaid-toolbar';

export interface ClickTarget {
    closest?: ((selector: string) => { dataset?: { line?: string } } | null) | null;
}

/** Line number to navigate to for a click, or null when it must not navigate. */
export function resolveNavigationLine(target: ClickTarget | null | undefined): number | null {
    if (!target || typeof target.closest !== 'function') return null;
    if (target.closest(NON_NAVIGABLE_SELECTOR)) return null;
    const lineEl = target.closest('[data-line]');
    const raw = lineEl && lineEl.dataset ? lineEl.dataset.line || '' : '';
    const line = parseInt(raw, 10);
    return Number.isFinite(line) && line > 0 ? line : null;
}
