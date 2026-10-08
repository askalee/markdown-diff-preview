import test from 'node:test';
import assert from 'node:assert';
import { escapeHtml, escapeAttr } from '../src/core/html';

test('html utils - single source of truth for escaping', async (t) => {
    await t.test('escapes &, <, >, ", single-quote', () => {
        assert.strictEqual(
            escapeHtml(`&<>"'`),
            '&amp;&lt;&gt;&quot;&#039;'
        );
    });

    await t.test('escapeAttr escapes HTML-significant chars', () => {
        assert.strictEqual(
            escapeAttr(`a"b<c>d&e`),
            'a&quot;b&lt;c&gt;d&amp;e'
        );
    });

    await t.test('leaves plain text untouched', () => {
        assert.strictEqual(escapeHtml('hello 123'), 'hello 123');
    });
});
