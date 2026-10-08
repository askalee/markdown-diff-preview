/**
 * Shared diagram helpers for the Preview webview.
 *
 * Plain script (no modules/bundler) so it loads via <script src> under the
 * webview CSP. This file is the single client-side source of truth — the
 * extension must NOT duplicate these bodies with Function.toString().
 * Parity with src/core/diagramHighlight.ts + src/core/sequenceStickyHeader.ts
 * is enforced by test/webviewUtilsParity.test.ts.
 */
(function (global) {
    'use strict';

    var CLASS_NODE_SELECTOR = 'g.node[id*="classId-"]';
    var ACTOR_HEADER_SELECTOR = 'rect.actor, g.actor-man, text.actor';
    var DIAGRAM_HIGHLIGHT_CLASS = 'diagram-highlight';

    var STICKY_BAR_HEIGHT = 36;
    var MIN_CHIP_WIDTH = 64;
    var MAX_CHIP_WIDTH = 220;

    function normalizeDiagramName(raw) {
        if (!raw) return '';
        var normalized = String(raw).replace(/<<[^<>]*>>/g, '');
        normalized = normalized.replace(/<[^<>]*>/g, '');
        normalized = normalized.replace(/~[^~]*~/g, '');
        normalized = normalized.replace(/~/g, '');
        normalized = normalized.trim().replace(/^["'`]+|["'`]+$/g, '');
        normalized = normalized.toLowerCase().replace(/\s+/g, '');
        return normalized;
    }

    function isSameDiagramName(a, b) {
        var left = normalizeDiagramName(a);
        var right = normalizeDiagramName(b);
        return left.length > 0 && left === right;
    }

    function extractClassIdName(idAttr) {
        if (!idAttr) return null;
        var match = String(idAttr).match(/classId-(.+)-(\d+)$/);
        return match ? match[1] : null;
    }

    function isDragMovement(downX, downY, upX, upY, threshold) {
        if (threshold === undefined) threshold = 6;
        return Math.hypot(upX - downX, upY - downY) > threshold;
    }

    function shouldShowStickyHeader(view) {
        var panY = view.panY;
        var svgHeight = view.svgHeight;
        var headerHeight = view.headerHeight;
        var mainHeight = view.mainHeight;
        var barHeight = view.barHeight === undefined ? STICKY_BAR_HEIGHT : view.barHeight;
        if (!Number.isFinite(panY) || !Number.isFinite(svgHeight) || svgHeight <= 0) {
            return false;
        }
        if (!Number.isFinite(headerHeight) || headerHeight <= 0) {
            return false;
        }
        if (!Number.isFinite(mainHeight) || mainHeight <= 0) {
            return false;
        }
        var svgTop = mainHeight / 2 - svgHeight / 2 + panY;
        return svgTop + headerHeight < barHeight;
    }

    function computeChipCenterOffset(laneCx, svgWidth, zoom, panX) {
        return (laneCx - svgWidth / 2) * zoom + panX;
    }

    function computeCenterPanX(laneCx, svgWidth, zoom) {
        var panX = -(laneCx - svgWidth / 2) * zoom;
        return panX === 0 ? 0 : panX;
    }

    function clampChipWidth(raw, min, max) {
        if (min === undefined) min = MIN_CHIP_WIDTH;
        if (max === undefined) max = MAX_CHIP_WIDTH;
        if (!Number.isFinite(raw)) {
            return min;
        }
        return Math.min(max, Math.max(min, raw));
    }

    global.DiagramUtils = {
        CLASS_NODE_SELECTOR: CLASS_NODE_SELECTOR,
        ACTOR_HEADER_SELECTOR: ACTOR_HEADER_SELECTOR,
        DIAGRAM_HIGHLIGHT_CLASS: DIAGRAM_HIGHLIGHT_CLASS,
        STICKY_BAR_HEIGHT: STICKY_BAR_HEIGHT,
        MIN_CHIP_WIDTH: MIN_CHIP_WIDTH,
        MAX_CHIP_WIDTH: MAX_CHIP_WIDTH,
        normalizeDiagramName: normalizeDiagramName,
        isSameDiagramName: isSameDiagramName,
        extractClassIdName: extractClassIdName,
        isDragMovement: isDragMovement,
        shouldShowStickyHeader: shouldShowStickyHeader,
        computeChipCenterOffset: computeChipCenterOffset,
        computeCenterPanX: computeCenterPanX,
        clampChipWidth: clampChipWidth,
    };
})(typeof window !== 'undefined' ? window : globalThis);
