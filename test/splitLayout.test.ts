import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import {
    DEFAULT_SPLIT_RATIO,
    MIN_SPLIT_RATIO,
    MAX_SPLIT_RATIO,
    clampSplitRatio,
    ratioToPercent,
    computeNextRatio,
} from '../src/core/splitLayout';

describe('splitLayout', () => {
    test('default ratio is centered', () => {
        assert.strictEqual(DEFAULT_SPLIT_RATIO, 0.5);
    });

    test('clamp keeps ratio within bounds', () => {
        assert.strictEqual(clampSplitRatio(0.5), 0.5);
        assert.strictEqual(clampSplitRatio(0), MIN_SPLIT_RATIO);
        assert.strictEqual(clampSplitRatio(1), MAX_SPLIT_RATIO);
        assert.strictEqual(clampSplitRatio(NaN), DEFAULT_SPLIT_RATIO);
    });

    test('ratioToPercent renders css percent', () => {
        assert.strictEqual(ratioToPercent(0.5), '50%');
    });

    test('computeNextRatio moves with pointer delta', () => {
        assert.strictEqual(computeNextRatio(0.5, 100, 1000), 0.6);
        assert.strictEqual(computeNextRatio(0.5, -1000, 1000), MIN_SPLIT_RATIO);
        assert.strictEqual(computeNextRatio(0.5, 0, 0), 0.5);
    });
});
