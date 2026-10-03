# AGENTS.md

## 1. Test-First Principle (Mandatory, No Exceptions)

1. Test-first is mandatory for every code change, including new features, bug fixes, refactors, and other updates. Write a failing test before implementation and follow the Red → Green → Refactor workflow without exception. This is not limited to strict baby-step TDD; the goal is to capture the requirement or reproduce the bug with a test, implement the minimal fix, and then refine the code as needed.
2. Test location: `test/*.test.ts`, using the Node test runner + `ts-node/register`.
3. Naming mirrors the module under test, e.g. `src/gitDiff.ts` -> `test/gitDiff.test.ts`, or feature-based names such as `intraLineDiff.test.ts`.
4. No implementation without a failing test that proves the requirement or reproduces the problem.
5. Implement with the minimal change that makes the test pass; do not write large amounts of untested code at once.

Verification commands:

- `npm test`
- `npm run compile`
- `npm run lint`

## 2. Post-Implementation Clean Code Check (Mandatory)

After every Green and before closing, run one code smell scan:

1. Duplication: extract repeated logic into a function / module, prefer reuse under `src/core/`.
2. Function length and responsibility: one function does one thing; split anything over ~30 lines or with deep nesting.
3. Naming: variables, functions, and file names must express intent; avoid `data`, `tmp`, `handle1`.
4. Parameters and dependencies: avoid more than 3 parameters, avoid global state, keep VS Code API calls in `extension.ts` / panel layers.
5. Error handling and edge cases: `gitDiff.ts` and `markdownRenderer.ts` must explicitly handle empty input, non-git repos, and parse failures.

## 3. Refactor Rules

1. Refactor whenever there is a smell; do not accumulate tech debt.
2. After refactoring, re-run `npm test` and keep everything green.
3. Refactoring adds no new behavior; to add behavior, go back to step 1 and add a test first.
4. If existing duplicated logic is found (e.g. shared rendering between preview / diagrams panel), proactively extract a shared module instead of copy-pasting.

## 4. Definition of Done

- [ ] A failing test was written first
- [ ] `npm test` fully passes
- [ ] `npm run compile` + `npm run lint` report no errors
- [ ] Code smell check completed with necessary refactors done
- [ ] `docs/SPEC.md` updated if behavior changed, otherwise confirmed N/A
- [ ] UI/layout changes verified by self-rendered screenshots (see §6), otherwise confirmed N/A

## 5. Spec Sync (Mandatory)

1. `docs/SPEC.md` describes currently implemented features as User Story + Acceptance Criteria. No future plans.
2. Any behavior change (new feature, behavior tweak, bug fix that changes observable behavior, settings change, edge-case handling change) must update `docs/SPEC.md` in the same change: add / update the corresponding US + AC, keep Non-Goals accurate.
3. Pure refactor / internal cleanup with no observable behavior change needs no SPEC update.
4. SPEC update is part of Green, not a follow-up.

## 6. Visual Verification by Self-Rendering (Mandatory for UI Changes)

Do not judge layout/CSS fixes by reasoning alone. Any change affecting rendered output (webview HTML, CSS, header/panel layout) must be verified by actually rendering it and looking at the result before claiming it is fixed:

1. Reproduce faithfully: build a standalone HTML page using the real `media/styles.css` plus the real markup from the panel code (`src/markdownPreview.ts` / `src/markdownDiagramsPanel.ts`), with representative content (e.g. long CJK tab titles, full button groups). Verify the stylesheet actually loaded (e.g. check `body` margin is `0`, not the browser default `8px`).
2. Render headlessly: `google-chrome --headless --disable-gpu --no-sandbox --window-size=<W>,300 --screenshot=<file>.png <page>.html`. Cover multiple widths, including narrow ones the bug report shows (e.g. 500 / 540 / 700 / 1000).
3. Measure objectively: inject a script that dumps `getBoundingClientRect()` of the relevant elements and assert no overlap (e.g. write results to `document.title` and read them via `--dump-dom`).
4. Look with your own eyes: read the screenshot image yourself and confirm the layout matches the requirement.
5. Re-verify after every CSS revision; a "theoretically correct" fix that still overlaps on screen is not done.
