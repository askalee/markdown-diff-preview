import test from 'node:test';
import assert from 'node:assert';
import { renderMarkdownWithDiff } from '../src/core/markdownRenderer';

test('Math (KaTeX) - inline and display rendering', async (t) => {
    await t.test('renders inline $...$ via KaTeX', async () => {
        const html = await renderMarkdownWithDiff('論文提出 $M+F$ 作為總量', null, true);
        assert.match(html, /class="katex"/);
        assert.doesNotMatch(html, /\$M\+F\$/);
    });

    await t.test('renders inline \\(...\\) via KaTeX', async () => {
        const html = await renderMarkdownWithDiff('論文提出 \\(M+F\\) 作為總量', null, true);
        assert.match(html, /class="katex"/);
    });

    await t.test('renders display $$...$$ block from user example', async () => {
        const md = '$$\nM=\\sum_{i=1}^{n}p_iq_i,\\qquad T=M+F\n$$';
        const html = await renderMarkdownWithDiff(md, null, true);
        assert.match(html, /math-display/);
        assert.match(html, /class="katex"/);
    });

    await t.test('renders display \\[...\\] block', async () => {
        const html = await renderMarkdownWithDiff('\\[M+F\\]', null, true);
        assert.match(html, /math-display/);
        assert.match(html, /class="katex"/);
    });

    await t.test('does not render currency $10 as math', async () => {
        const html = await renderMarkdownWithDiff('今天花了 $10 買咖啡', null, true);
        assert.doesNotMatch(html, /class="katex"/);
        assert.match(html, /\$10/);
    });

    await t.test('escaped \\$ stays literal and renders no math', async () => {
        const html = await renderMarkdownWithDiff('價格 \\$10', null, true);
        assert.doesNotMatch(html, /class="katex"/);
        assert.match(html, /\$10/);
    });

    await t.test('does not render math inside fenced code blocks', async () => {
        const md = '```\n$x+y$\n```';
        const html = await renderMarkdownWithDiff(md, null, true);
        assert.doesNotMatch(html, /class="katex"/);
    });

    await t.test('does not render math inside inline code', async () => {
        const html = await renderMarkdownWithDiff('請看 `$x$` 語法', null, true);
        assert.doesNotMatch(html, /class="katex"/);
    });

    await t.test('invalid TeX falls back to visible source, never blank', async () => {
        const html = await renderMarkdownWithDiff('$\\invalidcmd$', null, true);
        assert.match(html, /math-error/);
        assert.match(html, /invalidcmd/);
    });

    await t.test('math on added diff line keeps data-line and diff styling', async () => {
        const diff = {
            filePath: 'doc.md',
            isNew: false,
            isDeleted: false,
            hunks: [],
            addedLines: new Set<number>([1]),
            removedLines: new Map<number, string>([[1, '舊行']])
        };
        const html = await renderMarkdownWithDiff('論文提出 $M+F$ 作為總量', diff, true);
        assert.match(html, /diff-line added/);
        assert.match(html, /data-line="1"/);
        assert.match(html, /class="katex"/);
    });

    await t.test('enableMath=false disables rendering', async () => {
        const render = renderMarkdownWithDiff as (...args: unknown[]) => Promise<string>;
        const html = await render('論文提出 $M+F$ 作為總量', null, true, null, undefined, true, false);
        assert.doesNotMatch(html, /class="katex"/);
    });
});
