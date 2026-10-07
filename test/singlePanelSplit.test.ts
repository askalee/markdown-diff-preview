import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSrc(name: string): string {
    return readFileSync(join(__dirname, '..', 'src', name), 'utf-8');
}

describe('single panel split (replaces dual panels)', () => {
    test('preview hosts in-panel split: preview pane + draggable splitter + diagrams pane', () => {
        const preview = readSrc('markdownPreview.ts');
        assert.ok(preview.includes('split-container'), 'preview html must have split-container');
        assert.ok(preview.includes('split-splitter'), 'preview html must have draggable splitter');
        assert.ok(preview.includes('diagrams-pane'), 'preview html must embed diagrams pane');
    });

    test('preview handles showDiagram message in place (no second panel)', () => {
        const preview = readSrc('markdownPreview.ts');
        assert.ok(preview.includes('showDiagram'), 'preview webview must handle showDiagram');
        assert.ok(preview.includes("command === 'showDiagram'") || preview.includes('command==="showDiagram"') || preview.includes("'showDiagram'"), 'preview must switch diagram in place');
    });

    test('openDiagramsView command stays in the single preview panel', () => {
        const ext = readSrc('extension.ts');
        assert.ok(!ext.includes('MarkdownDiagramsPanel.createOrShow'), 'must not create a second diagrams panel');
    });

    test('legacy diagrams panel no longer creates its own webview panel', () => {
        const legacy = readSrc('markdownDiagramsPanel.ts');
        assert.ok(!legacy.includes('createWebviewPanel'), 'legacy panel must not create a webview (deprecated shim only)');
    });
});
