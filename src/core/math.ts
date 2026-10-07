/**
 * KaTeX math support - pure functions, no VS Code dependencies.
 *
 * Delimiters: inline `$...$` / `\(...\)`, display `$$...$$` / `\[...\]`.
 * Math is extracted into \x00 placeholders BEFORE HTML-escaping and
 * character formatting so that `_`, `*`, `\` inside TeX are never mangled,
 * then restored AFTER plain-text wrapping (like word-diff placeholders).
 */

import katex from 'katex';

const MATH_PREFIX = '\x00MATH';
const CODE_PREFIX = '\x00CODE';
const ESCAPED_DOLLAR = '\x00ESCD\x00';

export function mathPlaceholder(id: number): string {
    return `${MATH_PREFIX}${id}\x00`;
}

export function codePlaceholder(id: number): string {
    return `${CODE_PREFIX}${id}\x00`;
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
    return escapeHtml(text);
}

/**
 * Render TeX to KaTeX HTML. Never throws: invalid TeX falls back to a
 * visible math-error span so the page never goes blank.
 */
export function renderTex(tex: string, displayMode: boolean): string {
    const attr = escapeAttr(tex);
    try {
        const html = katex.renderToString(tex, {
            throwOnError: true,
            displayMode,
            strict: false,
            trust: false
        });
        const cls = displayMode ? 'math-display' : 'math-inline';
        return `<span class="${cls}" data-tex="${attr}">${html}</span>`;
    } catch {
        const open = displayMode ? '$$' : '$';
        return `<span class="math-error" data-tex="${attr}">${open}${escapeHtml(tex)}${open}</span>`;
    }
}

/**
 * Stash inline `code` spans into placeholders. Must run BEFORE math
 * extraction so `$` inside backticks is never treated as math.
 */
export function stashInlineCode(text: string, codeStash: string[]): string {
    return text.replace(/`([^`\n]+)`/g, (_, code: string) => {
        const id = codeStash.length;
        codeStash.push(`<code>${escapeHtml(code)}</code>`);
        return codePlaceholder(id);
    });
}

export function restoreCodePlaceholders(text: string, codeStash: string[]): string {
    return text.replace(/\x00CODE(\d+)\x00/g, (_, id: string) => codeStash[parseInt(id, 10)]);
}

function isWhitespace(ch: string | undefined): boolean {
    return ch === undefined || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/**
 * Extract inline math from RAW markdown text (before HTML-escaping).
 * Handles `$$...$$`, `\(...\)`, `$...$` with conservative rules so that
 * currency like `$10` paired across words is not rendered as math.
 */
export function stashInlineMath(text: string, mathStash: string[]): string {
    // Protect escaped dollars: `\$` is always literal.
    const protected_text = text.replace(/\\\$/g, ESCAPED_DOLLAR);

    const stash = (tex: string, displayMode: boolean): string => {
        const id = mathStash.length;
        mathStash.push(renderTex(tex, displayMode));
        return mathPlaceholder(id);
    };

    let result = '';
    let i = 0;
    const n = protected_text.length;

    while (i < n) {
        const ch = protected_text[i];

        // Display `$$...$$` on a single line
        if (ch === '$' && protected_text[i + 1] === '$') {
            const close = protected_text.indexOf('$$', i + 2);
            if (close !== -1) {
                const tex = protected_text.slice(i + 2, close);
                if (tex.trim().length > 0) {
                    result += stash(tex, true);
                    i = close + 2;
                    continue;
                }
            }
            result += '$$';
            i += 2;
            continue;
        }

        // Inline `\(...\)`
        if (ch === '\\' && protected_text[i + 1] === '(') {
            const close = protected_text.indexOf('\\)', i + 2);
            if (close !== -1) {
                const tex = protected_text.slice(i + 2, close);
                if (tex.trim().length > 0) {
                    result += stash(tex, false);
                    i = close + 2;
                    continue;
                }
            }
            result += ch;
            i += 1;
            continue;
        }

        // Inline `$...$`
        if (ch === '$') {
            const next = protected_text[i + 1];
            if (next !== undefined && !isWhitespace(next)) {
                let j = i + 1;
                let found = -1;
                while (j < n) {
                    if (protected_text[j] === '$' && protected_text[j + 1] !== '$') {
                        const tex = protected_text.slice(i + 1, j);
                        const trimmed = tex.trim();
                        const after = protected_text[j + 1];
                        if (
                            trimmed.length > 0 &&
                            !isWhitespace(protected_text[j - 1]) &&
                            !/\$/.test(tex) &&
                            !/^\d+(\.\d+)?$/.test(trimmed) &&
                            (after === undefined || !/\d/.test(after))
                        ) {
                            found = j;
                            break;
                        }
                    }
                    j += 1;
                }
                if (found !== -1) {
                    result += stash(protected_text.slice(i + 1, found), false);
                    i = found + 1;
                    continue;
                }
            }
            result += ch;
            i += 1;
            continue;
        }

        result += ch;
        i += 1;
    }

    return result;
}

export function restoreMathPlaceholders(text: string, mathStash: string[]): string {
    const withMath = text.replace(/\x00MATH(\d+)\x00/g, (_, id: string) => mathStash[parseInt(id, 10)]);
    return withMath.split(ESCAPED_DOLLAR).join('$');
}

/**
 * Render a display-math block element with click-navigation support.
 */
export function renderDisplayBlock(tex: string, lineNumber: number): string {
    const attr = escapeAttr(tex);
    try {
        const html = katex.renderToString(tex, {
            throwOnError: true,
            displayMode: true,
            strict: false,
            trust: false
        });
        return `<div class="math-display" data-line="${lineNumber}" data-tex="${attr}">${html}</div>`;
    } catch {
        return `<div class="math-display math-error-block" data-line="${lineNumber}" data-tex="${attr}"><span class="math-error">$$${escapeHtml(tex)}$$</span></div>`;
    }
}
