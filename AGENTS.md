# AGENTS.md

## 1. Test-First Principle (Mandatory, No Exceptions)

1. Always test-first: any code change (new feature, bug fix, refactor, misc change) must start with a failing test, then implementation: Red -> Green -> Refactor, no exceptions.
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

## 5. Spec Sync (Mandatory)

1. `docs/SPEC.md` describes currently implemented features as User Story + Acceptance Criteria. No future plans.
2. Any behavior change (new feature, behavior tweak, bug fix that changes observable behavior, settings change, edge-case handling change) must update `docs/SPEC.md` in the same change: add / update the corresponding US + AC, keep Non-Goals accurate.
3. Pure refactor / internal cleanup with no observable behavior change needs no SPEC update.
4. SPEC update is part of Green, not a follow-up.
