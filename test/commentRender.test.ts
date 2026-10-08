import test from 'node:test';
import assert from 'node:assert';
import { renderMarkdownWithDiff } from '../src/core/markdownRenderer';

const COMMENTS_JSON = JSON.stringify({
    '1': {
        id: 1,
        target: { type: 'block', line: 2 },
        thread: [{ id: 't1', author: 'user', content: 'fix heading', timestamp: '2026-01-01T00:00:00.000Z' }],
        plan: null,
        response: null,
    },
    '2': {
        id: 2,
        target: { type: 'inline', line: 4, text: 'important' },
        thread: [{ id: 't2', author: 'ai', content: 'noted', timestamp: '2026-01-01T00:00:00.000Z' }],
        plan: { content: 'do it', status: 'pending', editable: true },
        response: null,
    },
});

const MARKDOWN_WITH_COMMENTS = [
    '<!--comment:1-->',
    '# Title',
    '',
    'Some important text here. <!--comment:2-->',
    '',
    '<!--',
    'COMMENTS-DATA',
    COMMENTS_JSON,
    '-->',
].join('\n');

test('comment rendering - badges, threads, and metadata stripping', async (t) => {
    await t.test('block comment before heading renders badge + hidden thread', async () => {
        const html = await renderMarkdownWithDiff(MARKDOWN_WITH_COMMENTS, null, false);
        assert.match(html, /comment-badge[^>]*data-comment-id="1"/);
        assert.match(html, /id="comment-thread-1"/);
    });

    await t.test('inline marker renders badge after target text', async () => {
        const html = await renderMarkdownWithDiff(MARKDOWN_WITH_COMMENTS, null, false);
        assert.match(html, /comment-badge[^>]*data-comment-id="2"/);
        assert.match(html, /id="comment-thread-2"/);
    });

    await t.test('COMMENTS-DATA block and markers never appear in output', async () => {
        const html = await renderMarkdownWithDiff(MARKDOWN_WITH_COMMENTS, null, false);
        assert.ok(!html.includes('COMMENTS-DATA'));
        assert.ok(!html.includes('<!--comment:'));
    });
});
