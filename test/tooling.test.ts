import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Rationale for `.eslintrc.json` rule choices:
// - `no-control-regex` is off because `\x00`-wrapped sentinels (e.g. `\x00WD<n>\x00`,
//   `\x00CODE<n>\x00`) are an intentional cross-file placeholder convention in
//   `math.ts` / `intraLineDiff.ts` / `markdownRenderer.ts`, not accidental regex.
// - `@typescript-eslint/no-explicit-any` is off: the webview bridge deals with
//   untyped DOM/JSON payloads where `any` is the pragmatic type.
describe('tooling: eslint config', () => {
    test('eslint config exists and is valid JSON with TS parser', () => {
        const configPath = join(__dirname, '..', '.eslintrc.json');
        assert.ok(existsSync(configPath), 'missing .eslintrc.json so `npm run lint` cannot run');
        const raw = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(raw) as { parser?: string };
        assert.ok(
            typeof config.parser === 'string' && config.parser.includes('@typescript-eslint'),
            'config must use @typescript-eslint/parser for src/*.ts',
        );
    });
});
