import test from 'node:test';
import assert from 'node:assert';
import { parseDiff, extractNewFileContent } from '../src/core/diffParser';

test('diffParser - malformed input never throws, yields empty diff', async (t) => {
    await t.test('garbage without hunks returns empty FileDiff', () => {
        const parsed = parseDiff('test.md', 'not a diff\n+++ weird\n--- stuff\n');
        assert.strictEqual(parsed.hunks.length, 0);
        assert.strictEqual(parsed.addedLines.size, 0);
        assert.strictEqual(parsed.removedLines.size, 0);
        assert.strictEqual(parsed.isNew, false);
    });

    await t.test('empty string returns empty FileDiff', () => {
        const parsed = parseDiff('test.md', '');
        assert.strictEqual(parsed.hunks.length, 0);
    });

    await t.test('extractNewFileContent ignores non-hunk lines', () => {
        assert.strictEqual(extractNewFileContent('garbage\nno hunks here\n'), '');
    });
});
