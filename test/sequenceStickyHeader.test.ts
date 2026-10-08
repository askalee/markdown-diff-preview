import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    shouldShowStickyHeader,
    computeChipCenterOffset,
    computeCenterPanX,
    clampChipWidth,
    computeLaneChipWidth,
    pickChipColorValue,
    computeChipFontSize,
    computeStickyBarHeight,
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
        assert.strictEqual(clampChipWidth(2000), 480);
    });

    test('chip font size follows zoom with clamps', () => {
        assert.strictEqual(computeChipFontSize(1), 12);
        assert.strictEqual(computeChipFontSize(0.2), 11);
        assert.strictEqual(computeChipFontSize(2), 18);
        assert.strictEqual(computeChipFontSize(NaN), 12);
    });

    test('sticky bar height follows zoom with clamps', () => {
        assert.strictEqual(computeStickyBarHeight(1), 36);
        assert.strictEqual(computeStickyBarHeight(0.2), 28);
        assert.strictEqual(computeStickyBarHeight(2), 64);
        assert.strictEqual(computeStickyBarHeight(NaN), 36);
    });
});

describe('sequenceStickyHeader chip colors', () => {
    test('passes through usable sampled colors', () => {
        assert.strictEqual(pickChipColorValue('rgb(230, 237, 243)'), 'rgb(230, 237, 243)');
        assert.strictEqual(pickChipColorValue('  #e6edf3  '), '#e6edf3');
    });

    test('rejects empty/transparent/none samples', () => {
        assert.strictEqual(pickChipColorValue(''), null);
        assert.strictEqual(pickChipColorValue('   '), null);
        assert.strictEqual(pickChipColorValue('none'), null);
        assert.strictEqual(pickChipColorValue('transparent'), null);
        assert.strictEqual(pickChipColorValue('rgba(0, 0, 0, 0)'), null);
        assert.strictEqual(pickChipColorValue(null), null);
        assert.strictEqual(pickChipColorValue(undefined), null);
    });
});

describe('sequenceStickyHeader lane chip width', () => {
    test('zoomed lane width is no longer capped at 220', () => {
        // lane 150 units at zoom 2 with a generous neighbor gap: desired 316
        assert.strictEqual(computeLaneChipWidth(150, 2, 400), 316);
    });

    test('width follows neighbor gap to avoid overlap', () => {
        // neighbors 100 units away at zoom 1: available 88 wins over desired 166
        assert.strictEqual(computeLaneChipWidth(150, 1, 100), 88);
    });

    test('crowded lanes shrink below minimum instead of overlapping', () => {
        assert.strictEqual(computeLaneChipWidth(150, 1, 60), 48);
    });

    test('single lane uses full header width up to the safety cap', () => {
        assert.strictEqual(computeLaneChipWidth(150, 1, Infinity), 166);
        assert.strictEqual(computeLaneChipWidth(2000, 1, Infinity), 480);
    });

    test('invalid inputs fall back to sane widths', () => {
        assert.strictEqual(computeLaneChipWidth(NaN, 1, 400), 64);
        assert.strictEqual(computeLaneChipWidth(150, NaN, 400), 166);
    });
});

describe('sequenceStickyHeader webview wiring', () => {
    test('diagrams pane contains the sticky bar container', () => {
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'splitDiagramsPane.ts'),
            'utf-8',
        );
        assert.ok(panel.includes('actor-sticky-bar'), 'must render the sticky bar element');
        assert.ok(panel.includes('StickyBar'), 'must sync the bar on pan/zoom/tab switch');
    });

    test('sticky bar supports zoom-scaled height/font and manual hide', () => {
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'splitDiagramsPane.ts'),
            'utf-8',
        );
        assert.ok(panel.includes('actor-sticky-toggle'), 'must render a hide/show toggle');
        assert.ok(panel.includes('computeStickyBarHeight'), 'must scale bar height with zoom');
        assert.ok(panel.includes('computeChipFontSize'), 'must scale chip font with zoom');
        assert.ok(panel.includes('splitStickyCollapsed'), 'must respect manual hide');
    });

    test('sticky bar chips sample original header colors', () => {
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'splitDiagramsPane.ts'),
            'utf-8',
        );
        assert.ok(panel.includes('--chip-fg'), 'must apply the sampled text color');
        assert.ok(panel.includes('pickChipColorValue'), 'must validate sampled colors');
        assert.ok(panel.includes('tspan'), 'must sample the tspan fill (mermaid colors text.actor>tspan, text inherits the dark box fill)');
        const css = readFileSync(join(__dirname, '..', 'media', 'styles.css'), 'utf-8');
        assert.ok(css.includes('--chip-fg'), 'chip color must come from the sampled variable');
        const chipRule = css.match(/\.actor-sticky-chip\s*\{[^}]*\}/)?.[0] ?? '';
        assert.ok(!chipRule.includes('text-secondary'), 'chip must not use the dim secondary text');
    });

    test('sticky bar chips size from neighbor gaps', () => {
        const panel = readFileSync(
            join(__dirname, '..', 'src', 'splitDiagramsPane.ts'),
            'utf-8',
        );
        assert.ok(panel.includes('computeLaneChipWidth'), 'must size chips from neighbor gaps');
    });

    test('sticky bar styles exist and overlay the top without page scroll', () => {
        const css = readFileSync(join(__dirname, '..', 'media', 'styles.css'), 'utf-8');
        assert.ok(css.includes('.actor-sticky-bar'), 'must define .actor-sticky-bar rules');
        assert.ok(css.includes('.actor-sticky-chip'), 'must define chip rules');
        assert.ok(css.includes('.actor-sticky-toggle'), 'must define toggle rules');
    });
});
