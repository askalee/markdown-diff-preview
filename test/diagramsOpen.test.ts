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

describe('diagramsOpen webview wiring', () => {
    test('webview handles showDiagram message with in-place tab switch', () => {
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'markdownDiagramsPanel.ts'),
            'utf-8',
        );
        assert.ok(
            panel.includes('showDiagram'),
            'panel must support in-place diagram switching via message',
        );
        assert.ok(
            panel.includes("addEventListener('message'"),
            'webview must listen for extension messages',
        );
    });

    test('existing panel is never moved across groups (no column passed to reveal)', () => {
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'markdownDiagramsPanel.ts'),
            'utf-8',
        );
        assert.ok(
            !panel.includes('.reveal(column)'),
            'reveal() must not move the panel into the Preview group (verified: reveal(Beside) covers Preview)',
        );
    });
});
