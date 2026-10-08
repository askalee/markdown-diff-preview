import test from 'node:test';
import assert from 'node:assert';
import { buildDiagramsSplitPaneHtml } from '../src/splitDiagramsPane';

test('split pane JSON embedding escapes script-breaking chars', async (t) => {
    await t.test('escapes <, >, &, U+2028/2029 inside JSON payload', () => {
        const html = buildDiagramsSplitPaneHtml(
            [{ index: 0, title: '</script><b>&', line: 1, code: 'line\u2028sep\u2029end' }],
            'full',
            0
        );
        const payload = html.split('id="split-diagrams-data">')[1].split('</script>')[0];
        assert.ok(!payload.includes('</script>'), 'must not contain literal closing tag');
        assert.ok(payload.includes('\\u003c'), 'escapes <');
        assert.ok(payload.includes('\\u003e'), 'escapes >');
        assert.ok(payload.includes('\\u0026'), 'escapes &');
        assert.ok(payload.includes('\\u2028') && payload.includes('\\u2029'));
    });
});
