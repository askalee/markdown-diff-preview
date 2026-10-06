import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

describe('mermaid elk layout support', () => {
    test('vendored bundle includes the elk layout loader', () => {
        const bundlePath = join(root, 'media', 'mermaid.min.js');
        assert.ok(existsSync(bundlePath), 'media/mermaid.min.js must exist');
        const bundle = readFileSync(bundlePath, 'utf-8');
        assert.ok(
            bundle.includes('elk.layered'),
            'bundle must register the elk layout (elk.layered); rebuild with npm run build:mermaid',
        );
    });

    test('both panels and demo load the vendored bundle', () => {
        for (const file of ['src/markdownPreview.ts', 'src/markdownDiagramsPanel.ts', 'scripts/generate-demo.ts']) {
            const src = readFileSync(join(root, file), 'utf-8');
            assert.ok(
                src.includes('mermaid.min.js'),
                `${file} must load media/mermaid.min.js`,
            );
        }
    });

    test('elk bundle build is reproducible from pinned deps', () => {
        const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
        assert.ok(
            pkg.scripts?.['build:mermaid'],
            'package.json must define a build:mermaid script',
        );
        assert.ok(
            pkg.devDependencies?.['mermaid'],
            'mermaid must be pinned in devDependencies',
        );
        assert.ok(
            pkg.devDependencies?.['@mermaid-js/layout-elk'],
            '@mermaid-js/layout-elk must be pinned in devDependencies',
        );
        assert.ok(
            existsSync(join(root, 'scripts', 'build-mermaid-bundle.mjs')),
            'scripts/build-mermaid-bundle.mjs must exist',
        );
    });
});
