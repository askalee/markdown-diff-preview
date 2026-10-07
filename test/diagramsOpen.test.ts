import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decideDiagramsOpen } from '../src/core/diagramsOpen';

describe('decideDiagramsOpen', () => {
    test('no panel yet -> create', () => {
        assert.strictEqual(
            decideDiagramsOpen({ hasPanel: false, sameDocument: false, sameIndex: false, panelActive: false }),
            'create',
        );
    });

    test('same doc + same diagram + panel already focused -> noop (no reveal, no reload)', () => {
        assert.strictEqual(
            decideDiagramsOpen({ hasPanel: true, sameDocument: true, sameIndex: true, panelActive: true }),
            'noop',
        );
    });

    test('same doc + same diagram but panel in background -> reveal only (stay in group, no reload)', () => {
        assert.strictEqual(
            decideDiagramsOpen({ hasPanel: true, sameDocument: true, sameIndex: true, panelActive: false }),
            'reveal',
        );
    });

    test('same doc + different diagram -> reveal + in-place tab switch (no html rebuild)', () => {
        assert.strictEqual(
            decideDiagramsOpen({ hasPanel: true, sameDocument: true, sameIndex: false, panelActive: false }),
            'reveal-select',
        );
    });

    test('different document -> reveal + full rebuild', () => {
        assert.strictEqual(
            decideDiagramsOpen({ hasPanel: true, sameDocument: false, sameIndex: false, panelActive: true }),
            'reveal-rebuild',
        );
    });
});

describe('diagramsOpen webview wiring (single-panel mode)', () => {
    test('preview handles showDiagram message with in-place tab switch', () => {
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'markdownPreview.ts'),
            'utf-8',
        );
        assert.ok(
            panel.includes('showDiagram'),
            'panel must support in-place diagram switching via message',
        );
        assert.ok(
            panel.includes('split-container'),
            'single panel must embed the diagrams split pane',
        );
    });

    test('legacy diagrams module never creates its own webview panel', () => {
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'markdownDiagramsPanel.ts'),
            'utf-8',
        );
        assert.ok(
            !panel.includes('createWebviewPanel'),
            'legacy shim must not create a webview (deprecated forwarder only)',
        );
    });
});
