import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { extractMermaidTitle, renderMarkdownWithDiff } from '../src/core/markdownRenderer';
import { FileDiff } from '../src/core/types';

describe('Mermaid Rendering & Title Extraction', () => {
    test('should extract title from frontmatter', () => {
        const code = `---
title: System Architecture Diagram
---
flowchart TD
    A --> B`;
        const title = extractMermaidTitle(code, 0);
        assert.strictEqual(title, 'System Architecture Diagram');
    });

    test('should extract title from comment %% title: ...', () => {
        const code = `%% title: Authentication Sequence
sequenceDiagram
    Alice->>Bob: Hello`;
        const title = extractMermaidTitle(code, 0);
        assert.strictEqual(title, 'Authentication Sequence');
    });

    test('should infer diagram type when no title is provided', () => {
        const flow = `flowchart TD\n    A --> B`;
        assert.strictEqual(extractMermaidTitle(flow, 0), 'Flowchart 1');

        const seq = `sequenceDiagram\n    Alice->>Bob: Hi`;
        assert.strictEqual(extractMermaidTitle(seq, 1), 'Sequence Diagram 2');

        const cls = `classDiagram\n    class BankAccount`;
        assert.strictEqual(extractMermaidTitle(cls, 2), 'Class Diagram 3');

        const state = `stateDiagram-v2\n    [*] --> Still`;
        assert.strictEqual(extractMermaidTitle(state, 3), 'State Diagram 4');

        const er = `erDiagram\n    CUSTOMER ||--o{ ORDER : places`;
        assert.strictEqual(extractMermaidTitle(er, 4), 'ER Diagram 5');
    });

    test('should render markdown with mermaid container and attributes', async () => {
        const md = `# Diagrams Test

Here is a diagram:

\`\`\`mermaid
flowchart LR
    Start --> Stop
\`\`\`
`;
        const html = await renderMarkdownWithDiff(md, null, true);

        assert.ok(html.includes('class="mermaid-container'), 'Should contain mermaid-container');
        assert.ok(html.includes('data-diagram-index="0"'), 'Should contain data-diagram-index 0');
        assert.ok(html.includes('data-diagram-title="Flowchart 1"'), 'Should contain title');
        assert.ok(html.includes('class="mermaid-raw" style="display:none;"'), 'Should store raw mermaid code');
        assert.ok(html.includes('id="mermaid-inline-0"'), 'Should contain target rendered div with id');
        assert.ok(html.includes('openDiagramsView(0)'), 'Should contain openDiagramsView button');
    });

    test('should handle multiple mermaid diagrams sequentially', async () => {
        const md = `\`\`\`mermaid
%% title: First
graph TD
    A --> B
\`\`\`

Some intermediate text

\`\`\`mermaid
%% title: Second
graph LR
    C --> D
\`\`\`
`;
        const html = await renderMarkdownWithDiff(md, null, true);

        assert.ok(html.includes('data-diagram-index="0"'), 'Should contain index 0');
        assert.ok(html.includes('data-diagram-title="First"'), 'Should contain First title');
        assert.ok(html.includes('data-diagram-index="1"'), 'Should contain index 1');
        assert.ok(html.includes('data-diagram-title="Second"'), 'Should contain Second title');
        assert.ok(html.includes('id="mermaid-inline-0"'));
        assert.ok(html.includes('id="mermaid-inline-1"'));
    });

    test('should apply diff highlight when mermaid block is added', async () => {
        const md = `\`\`\`mermaid
graph TD
    X --> Y
\`\`\``;
        const diff: FileDiff = {
            filePath: 'doc.md',
            addedLines: new Set([1, 2, 3]),
            removedLines: new Map(),
            isNew: false,
            isDeleted: false,
            hunks: []
        };

        const html = await renderMarkdownWithDiff(md, diff, true);
        assert.ok(html.includes('diff-line added') || html.includes('has-diff'), 'Should mark container as added');
    });
});
