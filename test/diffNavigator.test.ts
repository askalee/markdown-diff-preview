import test from 'node:test';
import assert from 'node:assert';
import {
    groupDiffElements,
    resolveDiffShortcut,
    calculateNextChunkIndex,
    formatDiffCounter,
    DiffElementDescriptor
} from '../src/core/diffNavigator';

test('Diff Navigator - Chunk Grouping', async (t) => {
    await t.test('should return empty array when elements is empty', () => {
        const chunks = groupDiffElements([]);
        assert.strictEqual(chunks.length, 0);
    });

    await t.test('should group consecutive added lines in paragraph into one chunk', () => {
        const elements: DiffElementDescriptor[] = [
            { id: '1', line: 10, isBlock: true, isConsecutiveSibling: false, parentType: 'content' },
            { id: '2', line: 11, isBlock: true, isConsecutiveSibling: true, parentType: 'content' },
            { id: '3', line: 12, isBlock: true, isConsecutiveSibling: true, parentType: 'content' }
        ];

        const chunks = groupDiffElements(elements);
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].elements.length, 3);
        assert.strictEqual(chunks[0].line, 10);
        assert.strictEqual(chunks[0].targetId, '1');
    });

    await t.test('should separate diffs that have unmodified content between them', () => {
        const elements: DiffElementDescriptor[] = [
            { id: '1', line: 5, isBlock: true, isConsecutiveSibling: false, parentType: 'content' },
            // gap in between, so next element is NOT consecutive sibling
            { id: '2', line: 20, isBlock: true, isConsecutiveSibling: false, parentType: 'content' }
        ];

        const chunks = groupDiffElements(elements);
        assert.strictEqual(chunks.length, 2);
        assert.strictEqual(chunks[0].line, 5);
        assert.strictEqual(chunks[1].line, 20);
    });

    await t.test('should group consecutive table rows into one chunk', () => {
        const elements: DiffElementDescriptor[] = [
            { id: 'tr1', line: 30, isBlock: false, isConsecutiveSibling: false, parentType: 'table', parentId: 'tbl1' },
            { id: 'tr2', line: 31, isBlock: false, isConsecutiveSibling: false, parentType: 'table', parentId: 'tbl1' },
            { id: 'tr3', line: 32, isBlock: false, isConsecutiveSibling: false, parentType: 'table', parentId: 'tbl1' }
        ];

        const chunks = groupDiffElements(elements);
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].elements.length, 3);
        assert.strictEqual(chunks[0].line, 30);
    });

    await t.test('should group consecutive code block lines into one chunk', () => {
        const elements: DiffElementDescriptor[] = [
            { id: 'c1', line: 50, isBlock: false, isConsecutiveSibling: false, parentType: 'pre', parentId: 'pre1' },
            { id: 'c2', line: 51, isBlock: false, isConsecutiveSibling: false, parentType: 'pre', parentId: 'pre1' }
        ];

        const chunks = groupDiffElements(elements);
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].elements.length, 2);
        assert.strictEqual(chunks[0].line, 50);
    });

    await t.test('should group adjacent removed block and added block (replacement diff)', () => {
        const elements: DiffElementDescriptor[] = [
            { id: 'del1', line: 15, isBlock: true, isConsecutiveSibling: false, parentType: 'content' },
            { id: 'add1', line: 15, isBlock: true, isConsecutiveSibling: true, parentType: 'content' }
        ];

        const chunks = groupDiffElements(elements);
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].elements.length, 2);
        assert.strictEqual(chunks[0].line, 15);
    });

    await t.test('should filter out nested child diff elements', () => {
        const elements: DiffElementDescriptor[] = [
            { id: 'wrapper', line: 10, isBlock: true, isConsecutiveSibling: false, parentType: 'content' },
            // Child element marked with hasDiffAncestor: true
            { id: 'inner', line: 10, isBlock: false, isConsecutiveSibling: false, parentType: 'div', hasDiffAncestor: true }
        ];

        const chunks = groupDiffElements(elements);
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].elements.length, 1);
        assert.strictEqual(chunks[0].targetId, 'wrapper');
    });
});

test('Diff Navigator - Shortcut Resolution', async (t) => {
    const idleState = { isEditing: false, isInputFocused: false };
    const editingState = { isEditing: true, isInputFocused: false };
    const inputFocusedState = { isEditing: false, isInputFocused: true };

    await t.test('should resolve Alt+Down and Alt+Up regardless of text focus', () => {
        assert.strictEqual(resolveDiffShortcut({ key: 'ArrowDown', altKey: true }, idleState), 'next');
        assert.strictEqual(resolveDiffShortcut({ key: 'Down', altKey: true }, idleState), 'next');
        assert.strictEqual(resolveDiffShortcut({ key: 'ArrowUp', altKey: true }, idleState), 'prev');
        assert.strictEqual(resolveDiffShortcut({ key: 'Up', altKey: true }, idleState), 'prev');
    });

    await t.test('should resolve F7 and Shift+F7', () => {
        assert.strictEqual(resolveDiffShortcut({ key: 'F7', shiftKey: false }, idleState), 'next');
        assert.strictEqual(resolveDiffShortcut({ key: 'F7', shiftKey: true }, idleState), 'prev');
    });

    await t.test('should resolve single keys (n, p, j, k, ], [) when idle', () => {
        assert.strictEqual(resolveDiffShortcut({ key: 'n' }, idleState), 'next');
        assert.strictEqual(resolveDiffShortcut({ key: 'j' }, idleState), 'next');
        assert.strictEqual(resolveDiffShortcut({ key: ']' }, idleState), 'next');

        assert.strictEqual(resolveDiffShortcut({ key: 'p' }, idleState), 'prev');
        assert.strictEqual(resolveDiffShortcut({ key: 'k' }, idleState), 'prev');
        assert.strictEqual(resolveDiffShortcut({ key: '[' }, idleState), 'prev');
    });

    await t.test('should NEVER trigger single-key shortcuts while editing or input focused', () => {
        // While user is double-click editing text
        assert.strictEqual(resolveDiffShortcut({ key: 'n' }, editingState), null);
        assert.strictEqual(resolveDiffShortcut({ key: 'p' }, editingState), null);
        assert.strictEqual(resolveDiffShortcut({ key: 'j' }, editingState), null);
        assert.strictEqual(resolveDiffShortcut({ key: 'k' }, editingState), null);
        assert.strictEqual(resolveDiffShortcut({ key: ']' }, editingState), null);
        assert.strictEqual(resolveDiffShortcut({ key: '[' }, editingState), null);

        // While typing in comments or input
        assert.strictEqual(resolveDiffShortcut({ key: 'n' }, inputFocusedState), null);
        assert.strictEqual(resolveDiffShortcut({ key: 'p' }, inputFocusedState), null);
    });

    await t.test('should ignore modifier combinations with Ctrl or Meta', () => {
        assert.strictEqual(resolveDiffShortcut({ key: 'n', ctrlKey: true }, idleState), null);
        assert.strictEqual(resolveDiffShortcut({ key: 'p', metaKey: true }, idleState), null);
        assert.strictEqual(resolveDiffShortcut({ key: 'j', ctrlKey: true }, idleState), null);
    });

    await t.test('should ignore other unrelated keys', () => {
        assert.strictEqual(resolveDiffShortcut({ key: 'a' }, idleState), null);
        assert.strictEqual(resolveDiffShortcut({ key: 'Enter' }, idleState), null);
        assert.strictEqual(resolveDiffShortcut({ key: 'Space' }, idleState), null);
    });
});

test('Diff Navigator - Navigation Index & Wrap-around', async (t) => {
    await t.test('should handle empty chunks', () => {
        assert.strictEqual(calculateNextChunkIndex(-1, 0, 'next'), -1);
        assert.strictEqual(calculateNextChunkIndex(-1, 0, 'prev'), -1);
    });

    await t.test('should handle single chunk', () => {
        assert.strictEqual(calculateNextChunkIndex(-1, 1, 'next'), 0);
        assert.strictEqual(calculateNextChunkIndex(0, 1, 'next'), 0);
        assert.strictEqual(calculateNextChunkIndex(0, 1, 'prev'), 0);
    });

    await t.test('should navigate forward and wrap around', () => {
        const total = 3;
        assert.strictEqual(calculateNextChunkIndex(-1, total, 'next'), 0);
        assert.strictEqual(calculateNextChunkIndex(0, total, 'next'), 1);
        assert.strictEqual(calculateNextChunkIndex(1, total, 'next'), 2);
        assert.strictEqual(calculateNextChunkIndex(2, total, 'next'), 0); // Wrap around to first
    });

    await t.test('should navigate backward and wrap around', () => {
        const total = 3;
        assert.strictEqual(calculateNextChunkIndex(-1, total, 'prev'), 2);
        assert.strictEqual(calculateNextChunkIndex(2, total, 'prev'), 1);
        assert.strictEqual(calculateNextChunkIndex(1, total, 'prev'), 0);
        assert.strictEqual(calculateNextChunkIndex(0, total, 'prev'), 2); // Wrap around to last
    });
});

test('Diff Navigator - Counter Formatting', async (t) => {
    await t.test('should format counter string properly', () => {
        assert.strictEqual(formatDiffCounter(-1, 0), '0 / 0');
        assert.strictEqual(formatDiffCounter(-1, 5), '- / 5');
        assert.strictEqual(formatDiffCounter(0, 5), '1 / 5');
        assert.strictEqual(formatDiffCounter(2, 5), '3 / 5');
        assert.strictEqual(formatDiffCounter(4, 5), '5 / 5');
    });
});

test('Markdown Renderer - Removed Block data-line Integration', async (t) => {
    const { renderMarkdownWithDiff } = await import('../src/core/markdownRenderer');
    await t.test('should include data-line on diff-removed-block', async () => {
        const markdown = '# Hello World\n\nSome paragraph';
        const diff = {
            filePath: 'test.md',
            isNew: false,
            isDeleted: false,
            hunks: [],
            addedLines: new Set<number>(),
            removedLines: new Map<number, string>([[2, 'Old removed line']])
        };

        const html = await renderMarkdownWithDiff(markdown, diff, true);
        assert.match(html, /<div class="diff-removed-block" data-line="2">/);
    });
});
