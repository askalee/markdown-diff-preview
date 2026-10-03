import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveNavigationLine } from '../src/core/clickNavigation';

function stubTarget(line: string | null, interactive: boolean) {
    return {
        closest: (sel: string) => {
            if (sel !== '[data-line]') return interactive ? {} : null;
            return line === null ? null : { dataset: { line } };
        },
    };
}

describe('resolveNavigationLine', () => {
    test('returns the data-line number for plain content clicks', () => {
        assert.strictEqual(resolveNavigationLine(stubTarget('42', false)), 42);
    });

    test('ignores clicks on buttons/links/inputs (e.g. Open in View, Code toggle)', () => {
        assert.strictEqual(resolveNavigationLine(stubTarget('12', true)), null);
    });

    test('returns null with no data-line ancestor or bad target', () => {
        assert.strictEqual(resolveNavigationLine(stubTarget(null, false)), null);
        assert.strictEqual(resolveNavigationLine(null), null);
        assert.strictEqual(resolveNavigationLine({} as never), null);
        assert.strictEqual(resolveNavigationLine(stubTarget('abc', false)), null);
    });
});

describe('clickNavigation preview wiring', () => {
    test('delegated content click routes through the guard (no raw closest data-line nav)', () => {
        const preview = readFileSync(
            join(__dirname, '..', 'src', 'markdownPreview.ts'),
            'utf-8',
        );
        assert.ok(
            preview.includes('resolveNavigationLine(e.target)'),
            'single-click navigation must go through the interactive-element guard',
        );
    });
});
