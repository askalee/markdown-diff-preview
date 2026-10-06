import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    normalizeDiagramName,
    isSameDiagramName,
    extractClassIdName,
    isDragMovement,
    CLASS_NODE_SELECTOR,
} from '../src/core/diagramHighlight';

describe('diagramHighlight normalize', () => {
    test('trims and ignores case', () => {
        assert.strictEqual(normalizeDiagramName('  Order '), 'order');
        assert.strictEqual(normalizeDiagramName('ORDERSVC'), 'ordersvc');
    });

    test('ignores all whitespace differences', () => {
        assert.strictEqual(normalizeDiagramName('Order Svc'), normalizeDiagramName('ordersvc'));
        assert.strictEqual(normalizeDiagramName('API  Gateway'), normalizeDiagramName('apigateway'));
    });

    test('strips <<stereotypes>>', () => {
        assert.strictEqual(normalizeDiagramName('<<interface>> Order'), 'order');
        assert.strictEqual(normalizeDiagramName('Order <<service>>'), 'order');
    });

    test('strips generics (~T~ and <T>)', () => {
        assert.strictEqual(normalizeDiagramName('Order~T~'), 'order');
        assert.strictEqual(normalizeDiagramName('List~int~'), 'list');
        assert.strictEqual(normalizeDiagramName('Order<T>'), 'order');
        assert.strictEqual(normalizeDiagramName('Map~String,int~'), 'map');
    });

    test('strips surrounding quotes', () => {
        assert.strictEqual(normalizeDiagramName('"Order"'), 'order');
    });

    test('empty input stays empty', () => {
        assert.strictEqual(normalizeDiagramName(''), '');
        assert.strictEqual(normalizeDiagramName('   '), '');
        assert.strictEqual(normalizeDiagramName('<<interface>>'), '');
    });
});

describe('diagramHighlight isSameDiagramName', () => {
    test('matches across case/space/stereotype/generic noise', () => {
        assert.ok(isSameDiagramName('Order', 'order'));
        assert.ok(isSameDiagramName('OrderSvc', 'Order Svc'));
        assert.ok(isSameDiagramName('<<interface>> Order', 'Order~T~'));
        assert.ok(isSameDiagramName('List<int>', 'List'));
    });

    test('empty never matches', () => {
        assert.strictEqual(isSameDiagramName('', 'Order'), false);
        assert.strictEqual(isSameDiagramName('', ''), false);
    });

    test('different names do not match', () => {
        assert.strictEqual(isSameDiagramName('Order', 'User'), false);
    });
});

describe('diagramHighlight extractClassIdName', () => {
    test('parses classId-<Name>-<index>', () => {
        assert.strictEqual(extractClassIdName('classId-Order-0'), 'Order');
        assert.strictEqual(extractClassIdName('classId-OrderSvc-12'), 'OrderSvc');
    });

    test('returns null for non-class ids', () => {
        assert.strictEqual(extractClassIdName('actor0'), null);
        assert.strictEqual(extractClassIdName(''), null);
    });
});

describe('diagramHighlight drag threshold', () => {
    test('small pointer jitter is a click, larger movement is a drag', () => {
        assert.strictEqual(isDragMovement(100, 100, 103, 102), false);
        assert.strictEqual(isDragMovement(100, 100, 100, 100), false);
        assert.strictEqual(isDragMovement(100, 100, 120, 100), true);
        assert.strictEqual(isDragMovement(100, 100, 100, 107), true);
    });
});

describe('diagramHighlight styles', () => {
    test('highlight and clickable rules exist in styles.css', () => {
        const css = readFileSync(join(__dirname, '..', 'media', 'styles.css'), 'utf-8');
        assert.ok(css.includes('.diagram-highlight'), 'must define .diagram-highlight rules');
        assert.ok(
            css.includes('g.node[id*="classId-"]'),
            'class nodes must have clickable/highlight rules',
        );
        assert.ok(css.includes('rect.actor'), 'sequence lane headers must have rules');
    });
});

describe('diagramHighlight renderId-prefixed ids (mermaid 11 regression)', () => {
    test('CLASS_NODE_SELECTOR matches renderId-prefixed class node ids', () => {
        // mermaid >= 11 prefixes node ids with the render id, e.g.
        // `diagram-panel-svg-0-1717334400000-classId-Order-0`.
        // A ^= (starts-with) selector never matches those, which broke
        // click highlight after the ELK bundle upgrade.
        assert.ok(
            CLASS_NODE_SELECTOR.includes('*='),
            `selector must use substring match, got: ${CLASS_NODE_SELECTOR}`,
        );
        assert.ok(
            !CLASS_NODE_SELECTOR.includes('^='),
            `selector must not use starts-with match, got: ${CLASS_NODE_SELECTOR}`,
        );
    });

    test('extractClassIdName parses renderId-prefixed ids', () => {
        assert.strictEqual(
            extractClassIdName('diagram-panel-svg-0-1717334400000-classId-Order-0'),
            'Order',
        );
        assert.strictEqual(extractClassIdName('test-svg-classId-User-1'), 'User');
        // legacy unprefixed ids keep working
        assert.strictEqual(extractClassIdName('classId-Order-0'), 'Order');
    });

    test('styles.css clickable rule matches renderId-prefixed class nodes', () => {
        const css = readFileSync(join(__dirname, '..', 'media', 'styles.css'), 'utf-8');
        assert.ok(
            css.includes('g.node[id*="classId-"]'),
            'clickable rule must use substring match for renderId-prefixed ids',
        );
    });
});

describe('diagramHighlight webview wiring', () => {
    test('click handler survives pan pointer-capture (bound on pan container, uses elementFromPoint)', () => {
        // Regression: setupPanZoom calls setPointerCapture on #diagrams-view-main,
        // which retargets click to main — a listener on #diagrams-viewport never fires.
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'markdownDiagramsPanel.ts'),
            'utf-8',
        );
        assert.ok(
            panel.includes("getElementById('diagrams-view-main')"),
            'highlight click handling must be bound where capture-retargeted clicks land',
        );
        assert.ok(
            panel.includes('elementFromPoint'),
            'must recover the real element under the cursor geometrically',
        );
    });
});
