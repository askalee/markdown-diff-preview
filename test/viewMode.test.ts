import test from 'node:test';
import assert from 'node:assert';
import { renderMarkdownWithDiff } from '../src/core/markdownRenderer';
import type { FileDiff } from '../src/core/types';

function makeDiff(): FileDiff {
    return {
        filePath: 'test.md',
        isNew: false,
        isDeleted: false,
        hunks: [],
        addedLines: new Set<number>([1]),
        removedLines: new Map<number, string>([[1, '舊版內容']])
    };
}

test('ViewMode - core helpers (default normal, toggle, effective diff)', async (t) => {
    await t.test('default view mode is normal', async () => {
        const { DEFAULT_VIEW_MODE } = await import('../src/core/viewMode');
        assert.strictEqual(DEFAULT_VIEW_MODE, 'normal');
    });

    await t.test('toggleViewMode flips between normal and diff', async () => {
        const { toggleViewMode } = await import('../src/core/viewMode');
        assert.strictEqual(toggleViewMode('normal'), 'diff');
        assert.strictEqual(toggleViewMode('diff'), 'normal');
    });

    await t.test('normal mode resolves effective diff to null', async () => {
        const { resolveEffectiveDiff } = await import('../src/core/viewMode');
        const diff = makeDiff();
        assert.strictEqual(resolveEffectiveDiff('normal', diff), null);
        assert.strictEqual(resolveEffectiveDiff('normal', null), null);
    });

    await t.test('diff mode passes through the real diff', async () => {
        const { resolveEffectiveDiff } = await import('../src/core/viewMode');
        const diff = makeDiff();
        assert.strictEqual(resolveEffectiveDiff('diff', diff), diff);
        assert.strictEqual(resolveEffectiveDiff('diff', null), null);
    });

    await t.test('shouldShowDiffChrome is false in normal mode', async () => {
        const { shouldShowDiffChrome } = await import('../src/core/viewMode');
        assert.strictEqual(shouldShowDiffChrome('normal'), false);
        assert.strictEqual(shouldShowDiffChrome('diff'), true);
    });
});

test('ViewMode - normal rendering shows current content without diff chrome', async (t) => {
    await t.test('null diff renders content with data-line but no diff classes', async () => {
        const html = await renderMarkdownWithDiff('# 標題\n\n新版內容', null, true);
        assert.match(html, /<h1[\s>]/);
        assert.match(html, /data-line="1"/);
        assert.strictEqual(html.includes('diff-line'), false);
        assert.strictEqual(html.includes('diff-removed-block'), false);
        assert.strictEqual(html.includes('diff-word'), false);
        assert.strictEqual(html.includes('diff-row-added'), false);
        assert.strictEqual(html.includes('diff-table-wrapper'), false);
        assert.strictEqual(html.includes('has-diff'), false);
    });

    await t.test('same markdown with diff renders diff chrome', async () => {
        const html = await renderMarkdownWithDiff('新版內容', makeDiff(), true);
        assert.match(html, /diff-line added/);
        assert.match(html, /diff-removed-block/);
    });

    await t.test('trailing removed content is not rendered when diff is null', async () => {
        const html = await renderMarkdownWithDiff('最後一行', null, true);
        assert.strictEqual(html.includes('diff-removed-block'), false);
        assert.match(html, /最後一行/);
    });
});
