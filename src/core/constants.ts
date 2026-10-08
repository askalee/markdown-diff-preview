/**
 * Named constants for previously scattered magic numbers.
 * Webview inline scripts (P3 target) still carry their own copies until
 * they are extracted to static media/*.js — keep values in sync.
 */

/** `exec` stdout cap for git commands (10MB). */
export const GIT_MAX_BUFFER = 10 * 1024 * 1024;

/** Word-diff noise-suppression default: fallback to line-level above this change ratio. */
export const WORD_DIFF_THRESHOLD = 0.7;

/** Pointer travel (px) that counts as a pan drag rather than a click. */
export const DIAGRAM_DRAG_THRESHOLD = 6;

/** Diff-focus highlight linger time (ms). */
export const DIFF_FOCUS_MS = 1500;
/** Programmatic-scroll guard window (ms). */
export const SCROLL_SETTLE_MS = 800;
/** Preview→editor selection sync debounce (ms). */
export const SELECTION_DEBOUNCE_MS = 150;
/** Copy-toast fade timings (ms). */
export const COPY_TOAST_FADE_MS = 1800;
export const COPY_TOAST_REMOVE_MS = 2200;
/** Mermaid library wait cap (ms) / poll interval (ms). */
export const MERMAID_WAIT_MS = 3000;
export const MERMAID_POLL_MS = 50;
