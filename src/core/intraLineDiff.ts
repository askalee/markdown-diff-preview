/**
 * Word-level (intra-line) diff calculation and placeholder stashing.
 * Pure TypeScript, no VS Code dependencies - safe for Node.js & browser.
 */

export interface IntraLineDiffResult {
    hasWordDiff: boolean;
    oldLinePrepared: string;
    newLinePrepared: string;
    placeholders: string[];
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Tokenize text into words/symbols while preserving 100% of characters (including whitespace).
 * Uses Intl.Segmenter with zh-TW and en locales to support CJK word boundaries.
 */
export function tokenize(text: string): string[] {
    const segmenter = new Intl.Segmenter(['zh-TW', 'en'], { granularity: 'word' });
    return Array.from(segmenter.segment(text)).map(s => s.segment);
}

export interface DiffToken {
    type: 'added' | 'removed' | 'unchanged';
    value: string;
}

/**
 * Compute LCS sequence diff between token arrays with common prefix/suffix optimization.
 */
export function lcsDiffTokens(tokens1: string[], tokens2: string[]): DiffToken[] {
    // 1. Common prefix
    let start = 0;
    while (start < tokens1.length && start < tokens2.length && tokens1[start] === tokens2[start]) {
        start++;
    }

    // 2. Common suffix
    let end1 = tokens1.length - 1;
    let end2 = tokens2.length - 1;
    while (end1 >= start && end2 >= start && tokens1[end1] === tokens2[end2]) {
        end1--;
        end2--;
    }

    const prefix: DiffToken[] = tokens1.slice(0, start).map(v => ({ type: 'unchanged', value: v }));
    const suffix: DiffToken[] = tokens1.slice(end1 + 1).map(v => ({ type: 'unchanged', value: v }));

    const mid1 = tokens1.slice(start, end1 + 1);
    const mid2 = tokens2.slice(start, end2 + 1);

    const m = mid1.length;
    const n = mid2.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            dp[i + 1][j + 1] = mid1[i] === mid2[j] ? dp[i][j] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    let i = m;
    let j = n;
    const midDiff: DiffToken[] = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && mid1[i - 1] === mid2[j - 1]) {
            midDiff.push({ type: 'unchanged', value: mid1[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            midDiff.push({ type: 'added', value: mid2[j - 1] });
            j--;
        } else {
            midDiff.push({ type: 'removed', value: mid1[i - 1] });
            i--;
        }
    }
    midDiff.reverse();

    return [...prefix, ...midDiff, ...suffix];
}

/**
 * Compute word-level diff between an old line and a new line, returning prepared lines with
 * placeholders (\x00WD{id}\x00) and the stashed HTML elements.
 */
export function computeIntraLineDiff(
    oldLine: string,
    newLine: string,
    lineId: number = 1,
    threshold: number = 0.7
): IntraLineDiffResult {
    // If identical, no word diff needed
    if (oldLine === newLine) {
        return {
            hasWordDiff: false,
            oldLinePrepared: oldLine,
            newLinePrepared: newLine,
            placeholders: []
        };
    }

    const tokens1 = tokenize(oldLine);
    const tokens2 = tokenize(newLine);

    const diff = lcsDiffTokens(tokens1, tokens2);

    // Noise suppression: if changed tokens ratio exceeds threshold, fallback to line-level diff
    // Count non-whitespace content tokens so whitespace matches don't falsely deflate the change ratio
    let changedContentTokens = 0;
    let totalContentTokens = 0;
    for (const d of diff) {
        if (!/^\s+$/.test(d.value)) {
            if (d.type !== 'unchanged') {
                changedContentTokens++;
            }
            totalContentTokens++;
        }
    }
    if (totalContentTokens > 0 && (changedContentTokens / totalContentTokens) > threshold) {
        return {
            hasWordDiff: false,
            oldLinePrepared: oldLine,
            newLinePrepared: newLine,
            placeholders: []
        };
    }

    const placeholders: string[] = [];
    const stash = (html: string): string => {
        const id = placeholders.length;
        placeholders.push(html);
        return `\x00WD${id}\x00`;
    };

    let oldResult = '';
    let newResult = '';
    let pairIndex = 0;

    let idx = 0;
    while (idx < diff.length) {
        const item = diff[idx];
        if (item.type === 'unchanged') {
            oldResult += item.value;
            newResult += item.value;
            idx++;
        } else {
            // Collect adjacent change cluster
            let removedChunk = '';
            let addedChunk = '';
            while (idx < diff.length && diff[idx].type === 'removed') {
                removedChunk += diff[idx].value;
                idx++;
            }
            while (idx < diff.length && diff[idx].type === 'added') {
                addedChunk += diff[idx].value;
                idx++;
            }

            const pairId = `wd-p${lineId}-${pairIndex++}`;
            if (removedChunk && addedChunk) {
                // Replacement pair (Scheme A + C)
                const remHtml = `<span class="diff-word diff-word-removed" data-diff-pair="${pairId}" title="替換為: ${escapeAttr(addedChunk)}">${escapeHtml(removedChunk)}</span>`;
                const addHtml = `<span class="diff-word diff-word-added" data-diff-pair="${pairId}" title="原為: ${escapeAttr(removedChunk)}">${escapeHtml(addedChunk)}</span>`;
                oldResult += stash(remHtml);
                newResult += stash(addHtml);
            } else if (removedChunk) {
                const remHtml = `<span class="diff-word diff-word-removed" data-diff-pair="${pairId}" title="已刪除片段">${escapeHtml(removedChunk)}</span>`;
                oldResult += stash(remHtml);
            } else if (addedChunk) {
                const addHtml = `<span class="diff-word diff-word-added" data-diff-pair="${pairId}" title="已新增片段">${escapeHtml(addedChunk)}</span>`;
                newResult += stash(addHtml);
            }
        }
    }

    return {
        hasWordDiff: placeholders.length > 0,
        oldLinePrepared: oldResult,
        newLinePrepared: newResult,
        placeholders
    };
}

/**
 * Restore word-diff placeholders in HTML string.
 */
export function restoreWordDiffPlaceholders(html: string, placeholders: string[]): string {
    if (!placeholders || placeholders.length === 0) {
        return html;
    }
    return html.replace(/\x00WD(\d+)\x00/g, (_, id) => placeholders[parseInt(id, 10)] ?? '');
}
