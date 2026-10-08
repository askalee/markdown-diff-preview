import { test, describe } from 'node:test';
import * as assert from 'node:assert';

async function loadTool(): Promise<any> {
    // @ts-ignore - plain ESM helper without type declarations
    return await import('../scripts/install-vsix.mjs');
}

describe('install-vsix tool: pure helpers', () => {
    test('KNOWN_VSCODE_CLIS is a non-empty English-labelled table without duplicates', async () => {
        const tool = await loadTool();
        assert.ok(Array.isArray(tool.KNOWN_VSCODE_CLIS), 'must export KNOWN_VSCODE_CLIS');
        assert.ok(tool.KNOWN_VSCODE_CLIS.length >= 2, 'must list at least VS Code and Cursor');
        const clis = tool.KNOWN_VSCODE_CLIS.map((entry: any) => entry.cli);
        assert.ok(clis.includes('code'), 'must include `code`');
        assert.ok(clis.includes('cursor'), 'must include `cursor`');
        assert.strictEqual(new Set(clis).size, clis.length, 'CLI names must be unique');
        for (const entry of tool.KNOWN_VSCODE_CLIS as any[]) {
            assert.ok(/^[\x20-\x7E]+$/.test(entry.label), `label must be ASCII English: ${entry.label}`);
        }
    });

    test('parseEditorSelection: empty/all selects every detected editor', async () => {
        const tool = await loadTool();
        const detected = ['code', 'cursor', 'windsurf'];
        assert.deepStrictEqual(tool.parseEditorSelection('', detected), detected);
        assert.deepStrictEqual(tool.parseEditorSelection('all', detected), detected);
        assert.deepStrictEqual(tool.parseEditorSelection('ALL', detected), detected);
    });

    test('parseEditorSelection: numbers and names pick a subset in detected order', async () => {
        const tool = await loadTool();
        const detected = ['code', 'cursor', 'windsurf'];
        assert.deepStrictEqual(tool.parseEditorSelection('3,1', detected), ['code', 'windsurf']);
        assert.deepStrictEqual(tool.parseEditorSelection('cursor', detected), ['cursor']);
        assert.deepStrictEqual(tool.parseEditorSelection('windsurf code', detected), ['code', 'windsurf']);
    });

    test('parseEditorSelection: unknown tokens are ignored, never thrown', async () => {
        const tool = await loadTool();
        const detected = ['code', 'cursor'];
        assert.deepStrictEqual(tool.parseEditorSelection('99,nope,1', detected), ['code']);
        assert.deepStrictEqual(tool.parseEditorSelection('nope', detected), []);
    });

    test('buildInstallArgs wraps the vsix path for --install-extension', async () => {
        const tool = await loadTool();
        assert.deepStrictEqual(tool.buildInstallArgs('pkg-1.0.0.vsix'), [
            '--install-extension',
            'pkg-1.0.0.vsix',
        ]);
    });

    test('findLatestVsix picks the highest semantic version', async () => {
        const tool = await loadTool();
        assert.strictEqual(
            tool.findLatestVsix([
                'markdown-diff-preview-1.0.3.vsix',
                'markdown-diff-preview-1.5.1.vsix',
                'markdown-diff-preview-1.4.0.vsix',
            ]),
            'markdown-diff-preview-1.5.1.vsix',
        );
        assert.strictEqual(tool.findLatestVsix([]), null);
    });
});
