import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { buildDiagramsSplitPaneHtml } from '../src/splitDiagramsPane';

const SHARED_HELPERS = [
    'normalizeDiagramName',
    'isSameDiagramName',
    'extractClassIdName',
    'isDragMovement',
    'shouldShowStickyHeader',
    'computeChipCenterOffset',
    'computeCenterPanX',
    'clampChipWidth',
    'STICKY_BAR_HEIGHT',
    'MIN_CHIP_WIDTH',
    'MAX_CHIP_WIDTH',
];

function extractMainScript(): string {
    const html = buildDiagramsSplitPaneHtml(
        [{ index: 0, title: 'Class Diagram 1', line: 5, code: 'classDiagram\nclass Order' }],
        'full',
        0,
    );
    const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(blocks.length > 0, 'pane html must embed its client script');
    return blocks[blocks.length - 1];
}

function runHelpersInSandbox(): vm.Context {
    const script = extractMainScript();
    const fakeEl = () => ({
        dataset: {},
        classList: { add() { /* noop */ }, remove() { /* noop */ }, toggle() { /* noop */ },
            contains() { return false; } },
        style: {},
        children: [],
        hidden: true,
        innerHTML: '',
        textContent: '[]',
        addEventListener() { /* noop */ },
        querySelectorAll() { return []; },
        querySelector() { return null; },
    });
    const sandbox: Record<string, unknown> = {
        document: {
            readyState: 'loading',
            getElementById: () => null,
            createElement: fakeEl,
            addEventListener() { /* noop */ },
            querySelectorAll: () => [],
            body: { classList: { contains: () => false } },
        },
        window: { addEventListener() { /* noop */ } },
        navigator: {},
        console,
        setTimeout: (fn: () => void) => 0,
        clearTimeout: () => undefined,
    };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(
        `${script}\n;globalThis.__splitTest = { splitIsSameDiagramName, splitClampChipWidth, splitShouldShowStickyHeader };`,
        ctx,
        { filename: 'split-pane.js' },
    );
    return ctx;
}

describe('split pane script closure (no dangling helper references)', () => {
    test('every shared helper referenced by embedded bodies is defined', () => {
        const script = extractMainScript();
        const defined = new Set(
            [...script.matchAll(/^\s*const (\w+) =/gm)].map((m) => m[1]),
        );
        for (const name of SHARED_HELPERS) {
            const used = new RegExp(`[^\\w$]${name}[^\\w$]`).test(script);
            if (used) {
                assert.ok(defined.has(name), `pane script uses ${name} but never defines it`);
            }
        }
    });

    test('highlight name matching runs without ReferenceError', () => {
        const ctx = runHelpersInSandbox() as unknown as Record<string, unknown>;
        const exported = (ctx.__splitTest ?? {}) as Record<string, (a: string, b: string) => boolean>;
        assert.strictEqual(typeof exported.splitIsSameDiagramName, 'function');
        assert.strictEqual(exported.splitIsSameDiagramName(' Order ', 'order'), true);
    });

    test('sticky defaults resolve without ReferenceError', () => {
        const ctx = runHelpersInSandbox() as unknown as Record<string, unknown>;
        const exported = (ctx.__splitTest ?? {}) as Record<string, (...args: never[]) => number | boolean>;
        const clamp = exported.splitClampChipWidth as unknown as (raw: number) => number;
        assert.strictEqual(clamp(10), 64);
        const shouldShow = exported.splitShouldShowStickyHeader as unknown as (v: object) => boolean;
        assert.strictEqual(
            shouldShow({ panY: -1000, svgHeight: 800, headerHeight: 40, mainHeight: 600 }),
            true,
        );
    });
});
