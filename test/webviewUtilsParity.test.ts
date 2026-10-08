import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { normalizeDiagramName, isSameDiagramName, extractClassIdName, isDragMovement } from '../src/core/diagramHighlight';
import { shouldShowStickyHeader, computeChipCenterOffset, computeCenterPanX, clampChipWidth } from '../src/core/sequenceStickyHeader';
import { resolveNavigationLine, NON_NAVIGABLE_SELECTOR } from '../src/core/clickNavigation';
import { calculateNextChunkIndex, formatDiffCounter } from '../src/core/diffNavigator';

function loadWebviewGlobal(file: string, globalName: string): Record<string, (...args: never[]) => unknown> {
    const filePath = path.join(__dirname, '..', 'media', file);
    const src = fs.readFileSync(filePath, 'utf8');
    const sandbox: Record<string, unknown> = { window: {} };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`${src}\n;globalThis.__underTest = window.${globalName};`, sandbox, { filename: file });
    return (sandbox as unknown as Record<string, unknown>).__underTest as Record<string, (...args: never[]) => unknown>;
}

test('webview static utils stay in parity with core (no Function.toString embedding)', async (t) => {
    await t.test('DiagramUtils mirrors diagramHighlight + sequenceStickyHeader', () => {
        const utils = loadWebviewGlobal('diagram-utils.js', 'DiagramUtils');
        const cases: Array<[string, unknown[], unknown]> = [
            ['normalizeDiagramName', [' <<Order>> '], normalizeDiagramName(' <<Order>> ')],
            ['isSameDiagramName', [' Order ', 'order'], isSameDiagramName(' Order ', 'order')],
            ['extractClassIdName', ['x-classId-Order-3'], extractClassIdName('x-classId-Order-3')],
            ['isDragMovement', [0, 0, 3, 4], isDragMovement(0, 0, 3, 4)],
            ['shouldShowStickyHeader', [{ panY: -1000, svgHeight: 800, headerHeight: 40, mainHeight: 600 }],
                shouldShowStickyHeader({ panY: -1000, svgHeight: 800, headerHeight: 40, mainHeight: 600 })],
            ['computeChipCenterOffset', [10, 100, 2, 5], computeChipCenterOffset(10, 100, 2, 5)],
            ['computeCenterPanX', [10, 100, 2], computeCenterPanX(10, 100, 2)],
            ['clampChipWidth', [10], clampChipWidth(10)],
        ];
        for (const [name, args, expected] of cases) {
            assert.deepStrictEqual(
                (utils[name] as (...a: unknown[]) => unknown)(...args),
                expected,
                `DiagramUtils.${name} must match core`
            );
        }
    });

    await t.test('PreviewNav mirrors clickNavigation', () => {
        const nav = loadWebviewGlobal('preview-nav.js', 'PreviewNav');
        assert.strictEqual(
            (nav.NON_NAVIGABLE_SELECTOR as unknown),
            NON_NAVIGABLE_SELECTOR
        );
        const fakeTarget = { closest: (sel: string) => (sel === '[data-line]' ? { dataset: { line: '7' } } : null) };
        assert.strictEqual(
            (nav.resolveNavigationLine as unknown as typeof resolveNavigationLine)(fakeTarget),
            resolveNavigationLine(fakeTarget)
        );
    });

    await t.test('PreviewNav mirrors diffNavigator chunk helpers', () => {
        const nav = loadWebviewGlobal('preview-nav.js', 'PreviewNav');
        const next = nav.calculateNextChunkIndex as unknown as typeof calculateNextChunkIndex;
        const fmt = nav.formatDiffCounter as unknown as typeof formatDiffCounter;
        assert.strictEqual(next(-1, 5, 'next'), calculateNextChunkIndex(-1, 5, 'next'));
        assert.strictEqual(next(4, 5, 'next'), calculateNextChunkIndex(4, 5, 'next'));
        assert.strictEqual(next(0, 5, 'prev'), calculateNextChunkIndex(0, 5, 'prev'));
        assert.strictEqual(next(0, 0, 'next'), calculateNextChunkIndex(0, 0, 'next'));
        assert.strictEqual(fmt(0, 5), formatDiffCounter(0, 5));
        assert.strictEqual(fmt(-1, 5), formatDiffCounter(-1, 5));
        assert.strictEqual(fmt(0, 0), formatDiffCounter(0, 0));
    });
});
