/**
 * Class diagram detail filtering - no VS Code dependencies.
 * Rule (per spec): a member starting with `+` / `-` is a method,
 * anything else is a property.
 *
 * Filtering goals per level:
 * - minimal: no members at all. Emptied `class X { ... }` blocks collapse
 *   to bare `class X` so Mermaid renders a single compartment instead of
 *   three boxes with empty content. Annotations (`<<...>>`) are kept.
 * - compact: properties only. Blank lines inside blocks are stripped.
 * - full: untouched.
 */

export type ClassDiagramDetail = 'minimal' | 'compact' | 'full';

export function isClassDiagram(code: string): boolean {
    const lines = code.split('\n');
    let inFrontmatter = false;
    for (const raw of lines) {
        const line = raw.trim();
        if (line === '---') {
            inFrontmatter = !inFrontmatter;
            continue;
        }
        if (inFrontmatter || !line || line.startsWith('%%')) continue;
        return /^classDiagram\b/i.test(line);
    }
    return false;
}

function isMethodMember(member: string): boolean {
    const trimmed = member.trimStart();
    return trimmed.startsWith('+') || trimmed.startsWith('-');
}

function isAnnotation(trimmed: string): boolean {
    return trimmed.startsWith('<<');
}

function isRelationLine(trimmed: string): boolean {
    return (
        trimmed.includes('--') ||
        trimmed.includes('..') ||
        trimmed.includes('|>') ||
        trimmed.includes('<|') ||
        trimmed.includes('*--') ||
        trimmed.includes('o--')
    );
}

const colonMemberPattern = /^([\w~<>,.\s$]+?)\s*:\s*(.+?)\s*$/;
const emptyBlockPattern = /^class\s+([^\s{]+)\s*\{\s*\}\s*$/;

interface FilterState {
    braceDepth: number;
    blockOpenKeptIndex: number;
    blockHasContent: boolean;
    kept: string[];
}

function collapseBlockIfEmpty(state: FilterState): boolean {
    if (state.blockOpenKeptIndex >= 0 && !state.blockHasContent) {
        const opener = state.kept[state.blockOpenKeptIndex];
        const collapsed = opener.replace(/\s*\{\s*$/, '');
        if (collapsed !== opener) {
            state.kept[state.blockOpenKeptIndex] = collapsed;
            return true;
        }
    }
    return false;
}

function handleBlockMember(raw: string, trimmed: string, level: ClassDiagramDetail, state: FilterState): void {
    if (isAnnotation(trimmed)) {
        state.kept.push(raw);
        state.blockHasContent = true;
    } else if (level === 'minimal') {
        // Drop every member.
    } else if (isMethodMember(trimmed)) {
        // compact: drop methods.
    } else {
        state.kept.push(raw);
        state.blockHasContent = true;
    }
}

// Returns true when the line was a `ClassName : member` line (handled).
function handleColonMember(raw: string, trimmed: string, level: ClassDiagramDetail, state: FilterState): boolean {
    if (isRelationLine(trimmed)) return false;
    const match = trimmed.match(colonMemberPattern);
    if (!match) return false;
    if (level === 'minimal' || isMethodMember(match[2])) {
        // minimal drops all members; compact drops methods.
    } else {
        state.kept.push(raw);
    }
    return true;
}

export function filterClassDiagram(code: string, level: ClassDiagramDetail): string {
    if (!code || level === 'full' || !isClassDiagram(code)) return code;

    const lines = code.split('\n');
    const state: FilterState = { braceDepth: 0, blockOpenKeptIndex: -1, blockHasContent: false, kept: [] };

    for (const raw of lines) {
        const trimmed = raw.trim();
        const opens = (raw.match(/\{/g) || []).length;
        const closes = (raw.match(/\}/g) || []).length;

        if (!trimmed || trimmed.startsWith('%%') || trimmed === '---' || /^classDiagram\b/i.test(trimmed)) {
            if (!trimmed && state.braceDepth > 0) continue; // strip blank lines inside blocks
            state.kept.push(raw);
            state.braceDepth += opens - closes;
            continue;
        }

        // Single-line empty block: `class Foo {}` -> `class Foo` in minimal.
        if (level === 'minimal' && state.braceDepth === 0) {
            const emptyBlock = trimmed.match(emptyBlockPattern);
            if (emptyBlock) {
                state.kept.push(`class ${emptyBlock[1]}`);
                continue;
            }
        }

        // Block opener: `class Foo {`
        if (state.braceDepth === 0 && opens > closes && trimmed.startsWith('class ')) {
            state.kept.push(raw);
            state.blockOpenKeptIndex = /\{\s*$/.test(raw) ? state.kept.length - 1 : -1;
            state.blockHasContent = false;
            state.braceDepth += opens - closes;
            continue;
        }

        // Block closer: `}`
        if (state.braceDepth > 0 && state.braceDepth + opens - closes === 0 && trimmed === '}') {
            if (level === 'minimal' && collapseBlockIfEmpty(state)) {
                state.braceDepth = 0;
                state.blockOpenKeptIndex = -1;
                continue; // drop the `}`; opener already collapsed
            }
            state.kept.push(raw);
            state.braceDepth = 0;
            state.blockOpenKeptIndex = -1;
            continue;
        }

        // Inside a `class X { ... }` block.
        if (state.braceDepth > 0) {
            handleBlockMember(raw, trimmed, level, state);
            state.braceDepth += opens - closes;
            continue;
        }

        // `ClassName : member` lines (but not relations like `A --|> B : label`).
        if (handleColonMember(raw, trimmed, level, state)) {
            state.braceDepth += opens - closes;
            continue;
        }

        state.kept.push(raw);
        state.braceDepth += opens - closes;
    }

    return state.kept.join('\n');
}
