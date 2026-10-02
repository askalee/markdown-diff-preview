import test from 'node:test';
import assert from 'node:assert';
import {
    tokenize,
    lcsDiffTokens,
    computeIntraLineDiff,
    restoreWordDiffPlaceholders
} from '../src/core/intraLineDiff';
import { renderMarkdownWithDiff } from '../src/core/markdownRenderer';
import { parseDiff } from '../src/core/diffParser';

test('Intra-line Diff - Tokenization & Rejoin Fidelity', async (t) => {
    await t.test('should accurately tokenize Traditional Chinese and English text', () => {
        const text = '目前顯示diff時，如果一行被修改的原文';
        const tokens = tokenize(text);
        assert.ok(tokens.includes('目前'));
        assert.ok(tokens.includes('顯示'));
        assert.ok(tokens.includes('diff'));
        assert.ok(tokens.includes('修改'));
    });

    await t.test('should rejoin 100% of characters identically without data loss', () => {
        const testCases = [
            '目前顯示diff時，如果一行被修改的原文',
            'The quick brown fox jumps over the lazy dog.',
            '這是 **快速** 的 `code` [連結](https://example.com)',
            '   \t\n mixed spaces and tabs \n  ',
            '123 + 456 == 579; /* symbols & emojis 🚀🎉 */'
        ];

        for (const str of testCases) {
            const tokens = tokenize(str);
            assert.strictEqual(tokens.join(''), str);
        }
    });
});

test('Intra-line Diff - LCS Diff & Pairing (Scheme A + Scheme C)', async (t) => {
    await t.test('should identify Chinese word modifications and generate matching data-diff-pair', () => {
        const oldLine = '目前顯示diff時，如果一行被修改的原文';
        const newLine = '目前顯示diff時，如果一行被刪除的原文';

        const result = computeIntraLineDiff(oldLine, newLine, 10);
        assert.strictEqual(result.hasWordDiff, true);
        assert.strictEqual(result.placeholders.length, 2);

        // Removed word
        assert.match(result.placeholders[0], /class="diff-word diff-word-removed"/);
        assert.match(result.placeholders[0], /data-diff-pair="wd-p10-0"/);
        assert.match(result.placeholders[0], />修改<\/span>/);
        assert.match(result.placeholders[0], /title="替換為: 刪除"/);

        // Added word
        assert.match(result.placeholders[1], /class="diff-word diff-word-added"/);
        assert.match(result.placeholders[1], /data-diff-pair="wd-p10-0"/);
        assert.match(result.placeholders[1], />刪除<\/span>/);
        assert.match(result.placeholders[1], /title="原為: 修改"/);
    });

    await t.test('should handle multiple word replacements within a single English sentence', () => {
        const oldLine = 'The quick brown fox jumps over the lazy dog.';
        const newLine = 'The fast brown fox leaps over the lazy dog.';

        const result = computeIntraLineDiff(oldLine, newLine, 5);
        assert.strictEqual(result.hasWordDiff, true);
        assert.strictEqual(result.placeholders.length, 4);

        // First pair: quick -> fast
        assert.match(result.placeholders[0], /data-diff-pair="wd-p5-0"/);
        assert.match(result.placeholders[0], />quick<\/span>/);
        assert.match(result.placeholders[1], /data-diff-pair="wd-p5-0"/);
        assert.match(result.placeholders[1], />fast<\/span>/);

        // Second pair: jumps -> leaps
        assert.match(result.placeholders[2], /data-diff-pair="wd-p5-1"/);
        assert.match(result.placeholders[2], />jumps<\/span>/);
        assert.match(result.placeholders[3], /data-diff-pair="wd-p5-1"/);
        assert.match(result.placeholders[3], />leaps<\/span>/);
    });

    await t.test('should suppress word diff when change ratio exceeds threshold (entirely rewritten)', () => {
        const oldLine = 'This is an old completely unrelated text about cats.';
        const newLine = 'Quantum mechanics explains subatomic particles behavior.';

        const result = computeIntraLineDiff(oldLine, newLine, 1, 0.7);
        assert.strictEqual(result.hasWordDiff, false);
        assert.strictEqual(result.placeholders.length, 0);
    });

    await t.test('should return hasWordDiff false when lines are identical', () => {
        const line = 'Unchanged content across lines.';
        const result = computeIntraLineDiff(line, line, 1);
        assert.strictEqual(result.hasWordDiff, false);
        assert.strictEqual(result.placeholders.length, 0);
    });
});

test('Markdown Renderer - Word-level Diff Integration', async (t) => {
    await t.test('should render word-level diff for paragraph replacement', async () => {
        const markdown = '目前顯示diff時，如果一行被刪除的原文';
        const diff = {
            filePath: 'test.md',
            isNew: false,
            isDeleted: false,
            hunks: [],
            addedLines: new Set<number>([1]),
            removedLines: new Map<number, string>([[1, '目前顯示diff時，如果一行被修改的原文']])
        };

        const html = await renderMarkdownWithDiff(markdown, diff, true);

        // Verify removed block has diff-word-removed
        assert.match(html, /<div class="diff-removed-block" data-line="1">/);
        assert.match(html, /<span class="diff-word diff-word-removed" data-diff-pair="wd-p1-0" title="替換為: 刪除">修改<\/span>/);

        // Verify added line has diff-word-added
        assert.match(html, /<div class="diff-line added clickable" data-line="1">/);
        assert.match(html, /<span class="diff-word diff-word-added" data-diff-pair="wd-p1-0" title="原為: 修改">刪除<\/span>/);
    });

    await t.test('should preserve Markdown formatting with word-diff tags', async () => {
        const markdown = '這是 **智慧** 的工具';
        const diff = {
            filePath: 'test.md',
            isNew: false,
            isDeleted: false,
            hunks: [],
            addedLines: new Set<number>([1]),
            removedLines: new Map<number, string>([[1, '這是 **快速** 的工具']])
        };

        const html = await renderMarkdownWithDiff(markdown, diff, true);

        // Verify <strong> correctly wraps the diff-word span
        assert.match(html, /<strong><span class="plain-text"><span class="diff-word diff-word-removed"/);
        assert.match(html, /<strong><span class="plain-text"><span class="diff-word diff-word-added"/);
    });

    await t.test('should render word diff for headings', async () => {
        const markdown = '# 新版系統核心標題';
        const diff = {
            filePath: 'test.md',
            isNew: false,
            isDeleted: false,
            hunks: [],
            addedLines: new Set<number>([1]),
            removedLines: new Map<number, string>([[1, '# 舊版系統核心標題']])
        };

        const html = await renderMarkdownWithDiff(markdown, diff, true);
        assert.match(html, /<h1 class="removed-content">.*<span class="diff-word diff-word-removed".*>舊版<\/span>.*<\/h1>/);
        assert.match(html, /<h1>.*<span class="diff-word diff-word-added".*>新版<\/span>.*<\/h1>/);
    });

    await t.test('should respect enableWordDiff = false parameter', async () => {
        const markdown = '這是新版內容';
        const diff = {
            filePath: 'test.md',
            isNew: false,
            isDeleted: false,
            hunks: [],
            addedLines: new Set<number>([1]),
            removedLines: new Map<number, string>([[1, '這是舊版內容']])
        };

        // Pass enableWordDiff = false
        const html = await renderMarkdownWithDiff(markdown, diff, true, null, undefined, false);

        assert.strictEqual(html.includes('diff-word'), false);
        assert.match(html, /<div class="diff-removed-block"/);
        assert.match(html, /<div class="diff-line added clickable"/);
    });

    await t.test('should handle N:N line replacement pairing via parseDiff', async () => {
        const diffOutput = `@@ -10,2 +10,2 @@
-第一行舊文本內容
-第二行舊文本內容
+第一行新文本內容
+第二行新文本內容
`;
        const parsed = parseDiff('test.md', diffOutput);
        assert.strictEqual(parsed.removedLines.get(10), '第一行舊文本內容');
        assert.strictEqual(parsed.removedLines.get(11), '第二行舊文本內容');
        assert.ok(parsed.addedLines.has(10));
        assert.ok(parsed.addedLines.has(11));
    });
});
