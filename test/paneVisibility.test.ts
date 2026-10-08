import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function readSrc(name: string): string {
    return readFileSync(join(__dirname, '..', 'src', name), 'utf-8');
}

describe('pane visibility (preview / diagrams toggle)', () => {
    test('core module resolves visibility with legacy fallback', async () => {
        const modPath = join(__dirname, '..', 'src', 'core', 'paneVisibility.ts');
        assert.ok(existsSync(modPath), 'src/core/paneVisibility.ts must exist');
        const mod = await import('../src/core/paneVisibility');
        assert.strictEqual(mod.DEFAULT_PANE_VISIBILITY, 'both');
        assert.strictEqual(mod.isPaneVisibility('preview'), true);
        assert.strictEqual(mod.isPaneVisibility('diagrams'), true);
        assert.strictEqual(mod.isPaneVisibility('both'), true);
        assert.strictEqual(mod.isPaneVisibility('other'), false);
        // Legacy boolean compat: diagramsVisible=false -> preview-only
        assert.strictEqual(mod.resolvePaneVisibility(undefined, false), 'preview');
        assert.strictEqual(mod.resolvePaneVisibility(undefined, true), 'both');
        assert.strictEqual(mod.resolvePaneVisibility('diagrams', false), 'diagrams');
    });

    test('preview html exposes three-way pane toggle', () => {
        const preview = readSrc('markdownPreview.ts');
        assert.ok(preview.includes('pane-visibility-toggle'), 'header must have pane visibility toggle');
        assert.ok(preview.includes('setPaneVisibility'), 'webview must define setPaneVisibility');
        assert.ok(preview.includes('showPreviewOnly') || preview.includes('preview-only'), 'must support preview-only mode');
        assert.ok(preview.includes('showDiagramsOnly') || preview.includes('diagrams-only'), 'must support diagrams-only mode');
    });

    test('styles hide single panes and splitter', () => {
        const css = readFileSync(join(__dirname, '..', 'media', 'styles.css'), 'utf-8');
        assert.ok(css.includes('.preview-pane.collapsed'), 'css must hide collapsed preview pane');
        assert.ok(css.includes('.split-splitter.hidden') || css.includes('.split-splitter.hide'), 'css must hide splitter in single-pane mode');
    });

    test('extension registers pane visibility commands', () => {
        const ext = readSrc('extension.ts');
        const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
        const ids = pkg.contributes.commands.map((c: { command: string }) => c.command);
        assert.ok(ids.includes('markdownDiffPreview.showPreviewOnly'), 'package.json must contribute showPreviewOnly');
        assert.ok(ids.includes('markdownDiffPreview.showDiagramsOnly'), 'package.json must contribute showDiagramsOnly');
        assert.ok(ids.includes('markdownDiffPreview.showBothPanes'), 'package.json must contribute showBothPanes');
        assert.ok(ext.includes('showPreviewOnly'), 'extension must register showPreviewOnly');
        assert.ok(ext.includes('showDiagramsOnly'), 'extension must register showDiagramsOnly');
        assert.ok(ext.includes('showBothPanes'), 'extension must register showBothPanes');
    });

    test('single-pane mode overrides inline split flex so the visible pane fills', () => {
        // setupSplitSplitter writes inline `flex: 0 0 50%`, which beats any
        // stylesheet rule. Without an inline override the single pane stays
        // at half width instead of filling the window.
        const preview = readSrc('markdownPreview.ts');
        assert.ok(
            preview.includes("'1 1 100%'") || preview.includes('"1 1 100%"'),
            'applyPaneVisibility must set inline 100% flex for single-pane fill',
        );
    });

    test('splitter ratio applier respects single-pane mode', () => {
        const preview = readSrc('markdownPreview.ts');
        const idx = preview.indexOf('function setupSplitSplitter');
        assert.ok(idx >= 0, 'setupSplitSplitter must exist');
        const block = preview.slice(idx, idx + 5000);
        assert.ok(
            block.includes('pane-preview-only') || block.includes('pane-diagrams-only'),
            'applyRatio must guard single-pane mode instead of forcing 50/50 inline flex',
        );
    });
});
