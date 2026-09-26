/**
 * Core Diff Navigator module - pure logic with no VS Code or DOM dependencies.
 * Can be tested directly and reused in both webview and demo scripts.
 */

export interface DiffElementDescriptor {
    id?: string;
    line?: number | null;
    isBlock?: boolean;
    isConsecutiveSibling?: boolean;
    parentType?: string;
    parentId?: string;
    hasDiffAncestor?: boolean;
}

export interface DiffChunk {
    elements: DiffElementDescriptor[];
    targetId?: string;
    line?: number | null;
}

export interface KeyEventLike {
    key: string;
    altKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
}

export interface DiffEditorState {
    isEditing: boolean;
    isInputFocused: boolean;
}

/**
 * Group diff elements into logical chunks (hunks).
 * Filters out nested children and combines adjacent/contiguous elements.
 */
export function groupDiffElements(elements: DiffElementDescriptor[]): DiffChunk[] {
    // 1. Filter out nested diff elements
    const topElements = elements.filter(el => !el.hasDiffAncestor);
    if (topElements.length === 0) return [];

    const chunks: DiffChunk[] = [];
    let currentChunkElements: DiffElementDescriptor[] = [topElements[0]];

    const finalizeChunk = (els: DiffElementDescriptor[]): DiffChunk => {
        const firstWithLine = els.find(e => e.line != null && !Number.isNaN(e.line));
        return {
            elements: els,
            targetId: els[0].id,
            line: firstWithLine?.line ?? null
        };
    };

    for (let i = 1; i < topElements.length; i++) {
        const prev = topElements[i - 1];
        const curr = topElements[i];

        // Determine if prev and curr belong to the same logical chunk
        const sameTable = prev.parentType === 'table' && curr.parentType === 'table' && prev.parentId === curr.parentId;
        const sameCode = prev.parentType === 'pre' && curr.parentType === 'pre' && prev.parentId === curr.parentId;
        const isConsecutiveSibling = Boolean(curr.isConsecutiveSibling);

        if (sameTable || sameCode || isConsecutiveSibling) {
            currentChunkElements.push(curr);
        } else {
            chunks.push(finalizeChunk(currentChunkElements));
            currentChunkElements = [curr];
        }
    }

    if (currentChunkElements.length > 0) {
        chunks.push(finalizeChunk(currentChunkElements));
    }

    return chunks;
}

/**
 * Resolves a keyboard shortcut event to a diff navigation action ('next' | 'prev' | null).
 * Guards against firing single-key shortcuts when the user is editing text or an input is focused.
 */
export function resolveDiffShortcut(
    event: KeyEventLike,
    state: DiffEditorState
): 'next' | 'prev' | null {
    // Alt + Down / Alt + Up (VS Code standard)
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === 'ArrowDown' || event.key === 'Down') {
            return 'next';
        }
        if (event.key === 'ArrowUp' || event.key === 'Up') {
            return 'prev';
        }
    }

    // F7 / Shift + F7 (VS Code standard for Go to Next/Previous Difference)
    if (event.key === 'F7') {
        return event.shiftKey ? 'prev' : 'next';
    }

    // Single keys (only allowed when NOT editing and NO input is focused)
    if (state.isEditing || state.isInputFocused) {
        return null;
    }

    // Ignore if Ctrl or Meta or Alt is pressed with normal keys
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return null;
    }

    // Next shortcuts: 'n', 'j', ']'
    if (event.key === 'n' || event.key === 'j' || event.key === ']') {
        return 'next';
    }

    // Previous shortcuts: 'p', 'k', '['
    if (event.key === 'p' || event.key === 'k' || event.key === '[') {
        return 'prev';
    }

    return null;
}

/**
 * Calculate the target chunk index for navigation with wrap-around support.
 */
export function calculateNextChunkIndex(
    currentIndex: number,
    totalChunks: number,
    direction: 'next' | 'prev'
): number {
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

/**
 * Format the diff counter display string (e.g., '1 / 5', '0 / 0', '- / 5').
 */
export function formatDiffCounter(currentIndex: number, totalChunks: number): string {
    if (totalChunks <= 0) {
        return '0 / 0';
    }
    if (currentIndex < 0 || currentIndex >= totalChunks) {
        return `- / ${totalChunks}`;
    }
    return `${currentIndex + 1} / ${totalChunks}`;
}
