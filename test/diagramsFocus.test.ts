import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSrc(name: string): string {
    return readFileSync(join(__dirname, '..', 'src', name), 'utf-8');
}

function extractBlock(src: string, anchor: string, maxLen = 800): string {
    const start = src.indexOf(anchor);
    assert.ok(start !== -1, `anchor not found: ${anchor}`);
    return src.slice(start, start + maxLen);
}

describe('diagrams focus (detached window)', () => {
    test('showDiagram keeps OS focus in detached preview window', () => {
        const preview = readSrc('markdownPreview.ts');
        const block = extractBlock(preview, 'public static showDiagram');
        assert.ok(
            block.includes('preserveFocus') && block.includes('true'),
            'showDiagram must reveal with preserveFocus=true, otherwise focus jumps back to the main window',
        );
    });

    test('scrollToLine from diagrams pane must not steal editor focus', () => {
        const preview = readSrc('markdownPreview.ts');
        const block = extractBlock(preview, 'private async _scrollEditorToLine');
        assert.ok(
            block.includes('showTextDocument') && block.includes('preserveFocus: true'),
            'scrollToLine must open/reveal the editor with preserveFocus, otherwise a detached preview loses OS focus',
        );
    });
});
