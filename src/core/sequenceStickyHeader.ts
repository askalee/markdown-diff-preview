/**
 * Sequence sticky-header helpers - no VS Code / DOM dependencies.
 * Pure geometry used by the Diagrams view webview (via the plain-JS mirror
 * media/diagram-utils.js, loaded with <script src>) and unit-tested here in Node.
 *
 * Coordinate model: the SVG is centered in #diagrams-view-main and moved
 * by translate(panX, panY). The sticky bar overlays the top `barHeight` px
 * of main and mirrors panX/zoom (never panY) so chips stay aligned with
 * the lifelines below.
 */

/** One sequence lane header measured in SVG intrinsic coordinates. */
export interface StickyLane {
    name: string;
    /** Center x of the header in intrinsic SVG units. */
    cx: number;
    /** Header width in intrinsic SVG units. */
    width: number;
}

export const STICKY_BAR_HEIGHT = 36;
export const MIN_CHIP_WIDTH = 64;
export const MAX_CHIP_WIDTH = 220;
export const BASE_CHIP_FONT_SIZE = 12;
export const MIN_CHIP_FONT_SIZE = 11;
export const MAX_CHIP_FONT_SIZE = 18;
export const MIN_STICKY_BAR_HEIGHT = 28;
export const MAX_STICKY_BAR_HEIGHT = 64;

/**
 * True when the real actor headers have scrolled under the sticky bar,
 * so the overlay must be shown. Hidden otherwise (e.g. fitted view).
 */
export interface StickyViewport {
    /** Current vertical pan of the viewport. */
    panY: number;
    /** Scaled SVG height in px. */
    svgHeight: number;
    /** Scaled actor-header height in px. */
    headerHeight: number;
    /** Visible main-area height in px. */
    mainHeight: number;
    /** Sticky bar height in px. */
    barHeight?: number;
}

export function shouldShowStickyHeader(view: StickyViewport): boolean {
    const {
        panY,
        svgHeight,
        headerHeight,
        mainHeight,
        barHeight = STICKY_BAR_HEIGHT,
    } = view;
    if (!Number.isFinite(panY) || !Number.isFinite(svgHeight) || svgHeight <= 0) {
        return false;
    }
    if (!Number.isFinite(headerHeight) || headerHeight <= 0) {
        return false;
    }
    if (!Number.isFinite(mainHeight) || mainHeight <= 0) {
        return false;
    }
    const svgTop = mainHeight / 2 - svgHeight / 2 + panY;
    return svgTop + headerHeight < barHeight;
}

/** px offset of a chip from the horizontal center of main. */
export function computeChipCenterOffset(
    laneCx: number,
    svgWidth: number,
    zoom: number,
    panX: number,
): number {
    return (laneCx - svgWidth / 2) * zoom + panX;
}

/** panX value that centers the given lane in main. */
export function computeCenterPanX(laneCx: number, svgWidth: number, zoom: number): number {
    const panX = -(laneCx - svgWidth / 2) * zoom;
    return panX === 0 ? 0 : panX;
}

/** Keep chips readable: never tiny, never dominating the bar. */
export function clampChipWidth(raw: number, min: number = MIN_CHIP_WIDTH, max: number = MAX_CHIP_WIDTH): number {
    if (!Number.isFinite(raw)) {
        return min;
    }
    return Math.min(max, Math.max(min, raw));
}

/** Chip font size follows zoom so the sticky bar scales with the diagram. */
export function computeChipFontSize(
    zoom: number,
    base: number = BASE_CHIP_FONT_SIZE,
    min: number = MIN_CHIP_FONT_SIZE,
    max: number = MAX_CHIP_FONT_SIZE,
): number {
    if (!Number.isFinite(zoom) || !Number.isFinite(base)) {
        return BASE_CHIP_FONT_SIZE;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return BASE_CHIP_FONT_SIZE;
    }
    return Math.min(max, Math.max(min, base * zoom));
}

/** Sticky bar height follows zoom; clamped so it never collapses or dominates. */
export function computeStickyBarHeight(
    zoom: number,
    base: number = STICKY_BAR_HEIGHT,
    min: number = MIN_STICKY_BAR_HEIGHT,
    max: number = MAX_STICKY_BAR_HEIGHT,
): number {
    if (!Number.isFinite(zoom) || !Number.isFinite(base)) {
        return STICKY_BAR_HEIGHT;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return STICKY_BAR_HEIGHT;
    }
    return Math.round(Math.min(max, Math.max(min, base * zoom)));
}
