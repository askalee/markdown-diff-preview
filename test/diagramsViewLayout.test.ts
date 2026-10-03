import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadStyles(): string {
    return readFileSync(join(__dirname, '..', 'media', 'styles.css'), 'utf-8');
}

/** Extract the declaration block of a top-level class selector. */
function ruleBody(css: string, selector: string): string | null {
    const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`, 's'));
    return match ? match[1] : null;
}

test('Diagrams View Layout - narrow widths must not overlap tabs and controls', async (t) => {
    await t.test('tabs wrap onto multiple lines instead of scrolling when too narrow', () => {
        const body = ruleBody(loadStyles(), '.diagrams-tab-bar');
        assert.ok(body, '.diagrams-tab-bar rule must exist');
        assert.match(body, /flex-wrap\s*:\s*wrap/);
        assert.ok(!/overflow-x\s*:\s*auto/.test(body), 'tab bar must not use horizontal scrolling');
    });

    await t.test('tab bar uses content-based flex basis so controls wrap instead of bar collapsing', () => {
        const body = ruleBody(loadStyles(), '.diagrams-tab-bar');
        assert.ok(body, '.diagrams-tab-bar rule must exist');
        // flex-basis 0% lets the bar collapse to ~0px while actions hog the line (overlap);
        // auto basis forces the wrap decision on real content width.
        assert.ok(!/flex\s*:\s*1\s*;/.test(body), 'tab bar must not use flex: 1 (basis 0%)');
        assert.ok(/flex-basis\s*:\s*auto/.test(body) || /flex\s*:\s*1\s+1\s+auto/.test(body),
            'tab bar must use a content-based flex basis');
    });

    await t.test('single overlong tab is truncated instead of overflowing under controls', () => {
        const css = loadStyles();
        const tabBody = ruleBody(css, '.diagrams-tab');
        assert.ok(tabBody, '.diagrams-tab rule must exist');
        assert.match(tabBody, /max-width\s*:\s*100%/);
        const titleBody = ruleBody(css, '.diagrams-tab .tab-title');
        assert.ok(titleBody, '.diagrams-tab .tab-title rule must exist');
        assert.match(titleBody, /text-overflow\s*:\s*ellipsis/);
    });

    await t.test('header wraps controls onto a second row when too narrow', () => {
        const body = ruleBody(loadStyles(), '.diagrams-view-header');
        assert.ok(body, '.diagrams-view-header rule must exist');
        assert.match(body, /flex-wrap\s*:\s*wrap/);
    });

    await t.test('actions group wraps internally on extremely narrow widths', () => {
        const body = ruleBody(loadStyles(), '.diagrams-view-actions');
        assert.ok(body, '.diagrams-view-actions rule must exist');
        assert.match(body, /flex-wrap\s*:\s*wrap/);
        assert.match(body, /min-width\s*:\s*0/);
        assert.ok(!/flex-shrink\s*:\s*0/.test(body), 'actions must be allowed to shrink so internal wrapping can trigger');
    });
});
