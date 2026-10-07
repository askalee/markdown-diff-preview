import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shouldClosePreviewOnRemove } from '../src/core/previewLifecycle';

describe('shouldClosePreviewOnRemove', () => {
    test('no tracked document -> never close', () => {
        assert.strictEqual(
            shouldClosePreviewOnRemove(undefined, ['file:///a.md']),
            false,
        );
    });

    test('empty removal list -> never close', () => {
        assert.strictEqual(
            shouldClosePreviewOnRemove('file:///a.md', []),
            false,
        );
    });

    test('tracked file deleted -> close', () => {
        assert.strictEqual(
            shouldClosePreviewOnRemove('file:///a.md', ['file:///a.md']),
            true,
        );
    });

    test('other file deleted -> keep open', () => {
        assert.strictEqual(
            shouldClosePreviewOnRemove('file:///a.md', ['file:///b.md']),
            false,
        );
    });

    test('multi-file delete containing tracked file -> close', () => {
        assert.strictEqual(
            shouldClosePreviewOnRemove('file:///a.md', ['file:///b.md', 'file:///a.md']),
            true,
        );
    });

    test('renamed old URI matches tracked file -> close', () => {
        const oldUris = ['file:///a.md'];
        assert.strictEqual(shouldClosePreviewOnRemove('file:///a.md', oldUris), true);
        assert.strictEqual(shouldClosePreviewOnRemove('file:///b.md', oldUris), false);
    });
});

describe('preview auto-close wiring', () => {
    const extensionSrc = readFileSync(join(__dirname, '..', 'src', 'extension.ts'), 'utf-8');
    const previewSrc = readFileSync(join(__dirname, '..', 'src', 'markdownPreview.ts'), 'utf-8');
    const legacyShimSrc = readFileSync(join(__dirname, '..', 'src', 'markdownDiagramsPanel.ts'), 'utf-8');

    test('extension subscribes to file deletion', () => {
        assert.ok(
            extensionSrc.includes('onDidDeleteFiles'),
            'extension must close previews via workspace.onDidDeleteFiles',
        );
    });

    test('rename old URI is treated as removal', () => {
        assert.ok(
            extensionSrc.includes('onDidRenameFiles'),
            'extension must treat rename oldUri as removal',
        );
    });

    test('preview exposes its tracked document URI (legacy shim forwards it)', () => {
        assert.ok(
            previewSrc.includes('currentDocumentUri'),
            'preview panel must expose currentDocumentUri',
        );
        assert.ok(
            legacyShimSrc.includes('currentDocumentUri'),
            'legacy diagrams shim must forward currentDocumentUri',
        );
    });

    test('tracked panel is closed on removal (single panel)', () => {
        assert.ok(
            extensionSrc.includes('MarkdownDiffPreviewPanel.dispose'),
            'deleted file must close the Preview panel',
        );
    });
});
