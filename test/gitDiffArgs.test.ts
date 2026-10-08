import test from 'node:test';
import assert from 'node:assert';
import { validateDiffBase, buildGitDiffArgs, classifyLsFilesError } from '../src/core/gitDiffArgs';

test('gitDiffArgs - diffBase validation and arg building', async (t) => {
    await t.test('accepts plain refs', () => {
        assert.strictEqual(validateDiffBase('HEAD'), 'HEAD');
        assert.strictEqual(validateDiffBase('main'), 'main');
        assert.strictEqual(validateDiffBase('origin/main'), 'origin/main');
        assert.strictEqual(validateDiffBase('HEAD~3'), 'HEAD~3');
    });

    await t.test('rejects shell metacharacters, falls back to HEAD', () => {
        assert.strictEqual(validateDiffBase('HEAD; rm -rf /'), 'HEAD');
        assert.strictEqual(validateDiffBase('$(whoami)'), 'HEAD');
        assert.strictEqual(validateDiffBase('`id`'), 'HEAD');
        assert.strictEqual(validateDiffBase('a"b'), 'HEAD');
        assert.strictEqual(validateDiffBase(''), 'HEAD');
    });

    await t.test('builds argv without shell interpolation', () => {
        assert.deepStrictEqual(
            buildGitDiffArgs('HEAD', 'docs/a b.md'),
            ['diff', 'HEAD', '--', 'docs/a b.md']
        );
    });

    await t.test('classifies ls-files failures: exit 1 means untracked, other codes mean unknown', () => {
        assert.strictEqual(classifyLsFilesError(Object.assign(new Error('x'), { code: 1 })), false);
        assert.strictEqual(classifyLsFilesError(Object.assign(new Error('x'), { code: 128 })), null);
        assert.strictEqual(classifyLsFilesError(Object.assign(new Error('x'), { code: 'ENOENT' })), null);
    });
});
