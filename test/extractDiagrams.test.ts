import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { extractDiagrams } from '../src/core/extractDiagrams';

describe('extractDiagrams', () => {
    test('no mermaid blocks -> empty list', () => {
        assert.deepStrictEqual(extractDiagrams('# hello\n\ntext\n'), []);
    });

    test('single mermaid block with backticks', () => {
        const md = 'blah\n```mermaid\nflowchart TD\nA-->B\n```\n';
        const res = extractDiagrams(md);
        assert.strictEqual(res.length, 1);
        assert.strictEqual(res[0].index, 0);
        assert.strictEqual(res[0].line, 2);
        assert.ok(res[0].code.includes('flowchart TD'));
        assert.ok(res[0].title.length > 0);
    });

    test('tilde fence and multiple blocks get sequential indexes', () => {
        const md = '```mermaid\nflowchart TD\nA-->B\n```\n\n~~~mermaid\nsequenceDiagram\nA->>B: hi\n~~~\n';
        const res = extractDiagrams(md);
        assert.strictEqual(res.length, 2);
        assert.strictEqual(res[0].index, 0);
        assert.strictEqual(res[1].index, 1);
    });

    test('empty mermaid block is skipped', () => {
        const md = '```mermaid\n   \n```\n';
        assert.deepStrictEqual(extractDiagrams(md), []);
    });

    test('crlf input is handled', () => {
        const md = '# t\r\n```mermaid\r\nflowchart TD\r\nA-->B\r\n```\r\n';
        const res = extractDiagrams(md);
        assert.strictEqual(res.length, 1);
        assert.strictEqual(res[0].line, 2);
    });
});
