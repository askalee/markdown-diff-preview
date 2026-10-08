import test from 'node:test';
import assert from 'node:assert';
import {
    GIT_MAX_BUFFER,
    WORD_DIFF_THRESHOLD,
    DIAGRAM_DRAG_THRESHOLD,
    DIFF_FOCUS_MS,
    SCROLL_SETTLE_MS,
    SELECTION_DEBOUNCE_MS,
    MERMAID_WAIT_MS,
} from '../src/core/constants';

test('constants - named magic numbers', async (t) => {
    await t.test('git buffer is 10MB', () => {
        assert.strictEqual(GIT_MAX_BUFFER, 10 * 1024 * 1024);
    });
    await t.test('word-diff default threshold is 0.7', () => {
        assert.strictEqual(WORD_DIFF_THRESHOLD, 0.7);
    });
    await t.test('timing constants are positive', () => {
        assert.ok(DIFF_FOCUS_MS > 0 && SCROLL_SETTLE_MS > 0 && SELECTION_DEBOUNCE_MS > 0 && MERMAID_WAIT_MS > 0);
    });
    await t.test('drag threshold is 6px', () => {
        assert.strictEqual(DIAGRAM_DRAG_THRESHOLD, 6);
    });
});
