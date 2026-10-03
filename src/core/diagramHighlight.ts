/**
 * Diagram cross-highlight helpers - no VS Code / DOM dependencies.
 * Used by the Diagrams view webview (embedded via Function.toString())
 * and unit-tested here in Node.
 */

/** Selector for clickable class nodes in Mermaid classDiagram SVG output. */
export const CLASS_NODE_SELECTOR = 'g.node[id^="classId-"]';

/** Selectors for lane headers in Mermaid sequenceDiagram SVG output. */
export const ACTOR_HEADER_SELECTOR = 'rect.actor, g.actor-man, text.actor';

/** CSS class applied to highlighted SVG nodes. */
export const DIAGRAM_HIGHLIGHT_CLASS = 'diagram-highlight';

/**
 * Normalize a class / lane display name for cross-diagram comparison.
 * Ignores case, all whitespace, <<stereotypes>>, ~T~ / <T> generics
 * and surrounding quotes.
 */
export function normalizeDiagramName(raw: string): string {
    if (!raw) return '';
    let normalized = raw.replace(/<<[^<>]*>>/g, '');
    normalized = normalized.replace(/<[^<>]*>/g, '');
    normalized = normalized.replace(/~[^~]*~/g, '');
    normalized = normalized.replace(/~/g, '');
    normalized = normalized.trim().replace(/^["'`]+|["'`]+$/g, '');
    normalized = normalized.toLowerCase().replace(/\s+/g, '');
    return normalized;
}

export function isSameDiagramName(a: string, b: string): boolean {
    const left = normalizeDiagramName(a);
    const right = normalizeDiagramName(b);
    return left.length > 0 && left === right;
}

/** Parse `classId-<Name>-<index>` into `<Name>`; null when not a class id. */
export function extractClassIdName(idAttr: string): string | null {
    if (!idAttr) return null;
    const match = idAttr.match(/^classId-(.+)-(\d+)$/);
    return match ? match[1] : null;
}

/**
 * True when the pointer moved far enough between down and up
 * to count as a pan drag rather than a click.
 */
export function isDragMovement(downX: number, downY: number, upX: number, upY: number, threshold = 6): boolean {
    return Math.hypot(upX - downX, upY - downY) > threshold;
}
