/**
 * Click-to-navigate guard for the Preview webview.
 *
 * Plain script (no modules/bundler) so it loads via <script src> under the
 * webview CSP. Single client-side source of truth — the extension must NOT
 * duplicate this body with Function.toString(). Parity with
 * src/core/clickNavigation.ts is enforced by test/webviewUtilsParity.test.ts.
 */
(function (global) {
    'use strict';

    var NON_NAVIGABLE_SELECTOR =
        'button, a, input, select, textarea, summary, [contenteditable], .comment-thread, .mermaid-toolbar';

    function resolveNavigationLine(target) {
        if (!target || typeof target.closest !== 'function') return null;
        if (target.closest(NON_NAVIGABLE_SELECTOR)) return null;
        var lineEl = target.closest('[data-line]');
        var raw = lineEl && lineEl.dataset ? lineEl.dataset.line || '' : '';
        var line = parseInt(raw, 10);
        return Number.isFinite(line) && line > 0 ? line : null;
    }

    function calculateNextChunkIndex(currentIndex, totalChunks, direction) {
        if (totalChunks <= 0) return -1;
        if (totalChunks === 1) return 0;
        if (currentIndex < 0) {
            return direction === 'next' ? 0 : totalChunks - 1;
        }
        if (direction === 'next') {
            return (currentIndex + 1) % totalChunks;
        } else {
            return (currentIndex - 1 + totalChunks) % totalChunks;
        }
    }

    function formatDiffCounter(currentIndex, totalChunks) {
        if (totalChunks <= 0) {
            return '0 / 0';
        }
        if (currentIndex < 0 || currentIndex >= totalChunks) {
            return '- / ' + totalChunks;
        }
        return (currentIndex + 1) + ' / ' + totalChunks;
    }

    global.PreviewNav = {
        NON_NAVIGABLE_SELECTOR: NON_NAVIGABLE_SELECTOR,
        resolveNavigationLine: resolveNavigationLine,
        calculateNextChunkIndex: calculateNextChunkIndex,
        formatDiffCounter: formatDiffCounter,
    };
})(typeof window !== 'undefined' ? window : globalThis);
