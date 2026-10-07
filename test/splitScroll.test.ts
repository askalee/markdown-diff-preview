import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readRoot(rel: string): string {
    return readFileSync(join(__dirname, '..', rel), 'utf-8');
}

describe('split independent scroll', () => {
    test('preview body uses app layout scope class', () => {
        const preview = readRoot('src/markdownPreview.ts');
        assert.ok(preview.includes('split-view-body'), 'preview body must carry split-view-body');
    });

    test('stylesheet pins the split view to the viewport with per-pane scroll', () => {
        const css = readRoot('media/styles.css');
        assert.ok(css.includes('body.split-view-body'), 'css must scope app layout to split-view-body');
        assert.ok(css.includes('overflow: hidden'), 'split body must not page-scroll');
        assert.ok(
            css.includes('.preview-pane') && css.includes('overflow-y: auto'),
            'preview pane must scroll independently',
        );
    });

    test('diagrams pane keeps a fixed viewport (no page scrollbar)', () => {
        const css = readRoot('media/styles.css');
        const idx = css.indexOf('.diagrams-pane');
        assert.ok(idx >= 0, 'css must define .diagrams-pane');
        const scope = css.slice(css.indexOf('body.split-view-body'), css.indexOf('body.split-view-body') + 4000);
        assert.ok(scope.includes('.diagrams-pane'), 'split scope must style the diagrams pane');
        assert.ok(scope.includes('overflow'), 'split scope must control pane overflow');
    });

    test('diff navigation follows the preview pane scroll, not window scroll', () => {
        const preview = readRoot('src/markdownPreview.ts');
        assert.ok(
            preview.includes("getElementById('preview-pane')"),
            'preview script must reference the preview pane for scroll metrics',
        );
        const scrollWiring = preview.match(/preview-pane[\s\S]{0,400}scroll/i);
        assert.ok(scrollWiring, 'preview script must wire scroll handling to the preview pane');
    });

    test('splitter does not force side-by-side flex in stacked narrow mode', () => {
        const preview = readRoot('src/markdownPreview.ts');
        assert.ok(preview.includes('matchMedia'), 'splitter must respect the narrow stacked breakpoint');
    });
});
