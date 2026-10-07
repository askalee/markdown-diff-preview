import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    shouldShowStickyHeader,
    computeChipCenterOffset,
    computeCenterPanX,
    clampChipWidth,
} from '../src/core/sequenceStickyHeader';

describe('sequenceStickyHeader visibility', () => {
    test('hidden when fitted: header sits below the bar', () => {
        // main 600px, svg 500px centered => svgTop=50, header 40px => bottom=90 > bar 36
        assert.strictEqual(
            shouldShowStickyHeader({ panY: 0, svgHeight: 500, headerHeight: 40, mainHeight: 600 }),
            false,
        );
    });

    test('shown once the header scrolls under the bar', () => {
        // panned up 100px => svgTop=-50, header bottom=-10 < bar 36
        assert.strictEqual(
            shouldShowStickyHeader({ panY: -100, svgHeight: 500, headerHeight: 40, mainHeight: 600 }),
            true,
        );
    });

    test('panning down never shows the bar', () => {
        assert.strictEqual(
            shouldShowStickyHeader({ panY: 200, svgHeight: 500, headerHeight: 40, mainHeight: 600 }),
            false,
        );
    });

    test('empty svg never shows the bar', () => {
        assert.strictEqual(
            shouldShowStickyHeader({ panY: 0, svgHeight: 0, headerHeight: 0, mainHeight: 600 }),
            false,
        );
    });
});

describe('sequenceStickyHeader geometry', () => {
    test('centered lane has zero offset and zero pan', () => {
        // svg 1000 wide, lane at center 500, zoom 1, no pan
        assert.strictEqual(computeChipCenterOffset(500, 1000, 1, 0), 0);
        assert.strictEqual(computeCenterPanX(500, 1000, 1), 0);
    });

    test('chip follows pan and zoom', () => {
        // lane at 250 in a 1000-wide svg, zoom 2 => (250-500)*2 = -500, plus pan 100
        assert.strictEqual(computeChipCenterOffset(250, 1000, 2, 100), -400);
    });

    test('centering a side lane produces the negated offset', () => {
        const laneCx = 250;
        const svgWidth = 1000;
        const zoom = 2;
        const panX = computeCenterPanX(laneCx, svgWidth, zoom);
        assert.strictEqual(panX, 500);
        // applying that pan centers the chip
        assert.strictEqual(computeChipCenterOffset(laneCx, svgWidth, zoom, panX), 0);
    });

    test('chip width is clamped for readability', () => {
        assert.strictEqual(clampChipWidth(10), 64);
        assert.strictEqual(clampChipWidth(150), 150);
        assert.strictEqual(clampChipWidth(2000), 220);
    });
});

describe('sequenceStickyHeader webview wiring', () => {
    test('diagrams panel contains the sticky bar container', () => {
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'markdownDiagramsPanel.ts'),
            'utf-8',
        );
        assert.ok(panel.includes('actor-sticky-bar'), 'must render the sticky bar element');
        assert.ok(panel.includes('syncStickyBar'), 'must sync the bar on pan/zoom/tab switch');
    });

    test('sticky bar styles exist and overlay the top without page scroll', () => {
        const css = readFileSync(join(__dirname, '..', 'media', 'styles.css'), 'utf-8');
        assert.ok(css.includes('.actor-sticky-bar'), 'must define .actor-sticky-bar rules');
        assert.ok(css.includes('.actor-sticky-chip'), 'must define chip rules');
    });
});
