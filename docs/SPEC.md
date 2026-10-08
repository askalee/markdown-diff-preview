# Markdown Diff Preview — Feature Specification (SPEC)

> Scope: describes the "currently implemented" features of this extension. No future plans included.
> Format: each feature is described as a User Story (from the user's perspective) + Acceptance Criteria (verifiable conditions).
> Terms: Preview = the Markdown Diff Preview webview panel; Editor = the VS Code text editor.

---

## US-01 Open the Diff Preview

As a user writing Markdown documents, I want to open a preview with git diff highlighting in one step, so I can see what changed while reading the rendered output.

### AC

- [ ] AC-01: When the active editor is a Markdown file and I run the command `Markdown Diff Preview: Open Markdown Diff Preview` (or click the preview icon in the editor title, or press `Ctrl+Shift+V` / `Cmd+Shift+V`), the Preview opens beside the editor (`ViewColumn.Beside`).
- [ ] AC-02: When the active editor is not a Markdown file (or no file is open) and I run the open command, I see the warning `Please open a Markdown file first`, and no Preview opens.
- [ ] AC-03: When the Preview is already open and I run the open command again, the same panel is revealed and switches to the latest active document instead of opening a second panel.

---

## US-02 Live Markdown Rendering

As a document author, I want the Preview to reflect my typing in real time, so I can verify formatting without switching windows.

### AC

- [ ] AC-01: When I type in the Markdown editor (`onDidChangeTextDocument` with `languageId == markdown`), the Preview content updates automatically.
- [ ] AC-02: When I switch to another Markdown file (`onDidChangeActiveTextEditor`), a visible Preview switches to that file's content.
- [ ] AC-03: The Preview renders headings, paragraphs, blockquotes, horizontal rules, ordered/unordered (including nested) lists, tables, code blocks, and inline formatting (bold, italic, strikethrough, inline code, links, images).
- [ ] AC-04: An empty document shows an empty-state (icon + `Empty document`) instead of a blank page or an error.

---

## US-03 Line-Level Git Diff Highlighting

> Scope note: this US applies in Diff view mode only (see US-15). In Normal mode the same document renders without any diff chrome.

As a user reviewing document changes, I want to see added/removed lines directly on the rendered output, so I can grasp differences at a glance.

### AC

- [ ] AC-01: Lines added relative to `markdownDiffPreview.diffBase` (default `HEAD`) are marked with a green background + `+` style (`diff-line added`); removed content is shown in context in a red block above its corresponding new-line position (`diff-removed-block` + `removed` label).
- [ ] AC-02: The header shows stats: `+N added` (`addedLines.size`), `−N removed` (`removedLines.size`), and `vs <diffBase>`.
- [ ] AC-03: The header shows git info: the current branch (`git branch --show-current`) and the file status (`unchanged` / `new` / `modified` / `deleted` / `changed`, derived from `git status --porcelain`).
- [ ] AC-04: When `markdownDiffPreview.showLineNumbers == true`, added lines show line numbers (`line-number`); when set to `false` they do not.
- [ ] AC-05: `markdownDiffPreview.highlightStyle` controls how highlights are displayed: `inline` / `gutter` / `both` (default `both`).
- [ ] AC-06: Added table rows are marked with `diff-row-added`; a fully added table is wrapped in `diff-table-wrapper added`; removed table rows are shown as `diff-row-removed`.
- [ ] AC-07: Added/removed lists, code blocks, blockquotes, and headings keep their semantic structure and carry `data-line` without breaking the layout.

---

## US-04 Word-Level (Intra-Line) Diff

> Scope note: diff mode only (see US-15); Normal mode never emits `diff-word` markup.

As a user editing wording inside a sentence, I want to see exactly which words changed within a line instead of the whole line being marked as added, so I can review precisely.

### AC

- [ ] AC-01: When the same line has both removed and added content (a replacement pair) and `markdownDiffPreview.enableWordDiff == true`, replaced words are marked with `diff-word-removed` and new words with `diff-word-added`, with both sides sharing the same `data-diff-pair="wd-p<line>-<idx>"`.
- [ ] AC-02: When I hover over any `diff-word`, the paired counterpart is highlighted in sync (`diff-word-focus`); the highlight is removed on mouse-out.
- [ ] AC-03: Word-level diff tooltips show the mapping: the removed side has `title="Replace with: <new word>"` and the added side has `title="Originally: <old word>"`; pure additions show `Added fragment` and pure deletions show `Removed fragment`.
- [ ] AC-04: When the changed-token ratio exceeds the threshold (default 0.7, i.e. a fully rewritten line) or the two lines are identical, no word-level markup is produced and only line-level highlighting remains.
- [ ] AC-05: When `enableWordDiff == false`, the rendered output contains no `diff-word` markup, only line-level blocks.
- [ ] AC-06: Word tokenization supports Chinese and English (including CJK via `Intl.Segmenter` with `zh-TW`/`en`); rejoining tokens must reproduce the original text 100% with no character loss.

---

## US-05 Auto Refresh and Manual Refresh

As a user, I want the Preview to update automatically when the document or git state changes, with a manual refresh when needed, so I always see the latest diff.

### AC

- [ ] AC-01: The Preview refreshes automatically on document content changes, active editor switches, and `.git/**` filesystem events.
- [ ] AC-02: When I click the `↻ Refresh` button in the Preview header or run the `Markdown Diff Preview: Refresh` command, the Preview re-renders immediately.
- [ ] AC-03: When the panel becomes visible again (`onDidChangeViewState` → visible), the Preview refreshes once.

---

## US-06 Click Navigation and Selection Sync

As a user comparing the preview with the source, I want to click a line in the preview to jump to the matching line in the editor, so I can locate changes quickly.

### AC

- [ ] AC-01: When I single-click any element with `data-line` in the Preview, the Editor selects that whole line and centers it (`revealRange ... InCenter`).
- [ ] AC-02: When I select a text range with the mouse in the Preview, the Editor syncs the selection to the corresponding start/end line range (`selectLines`, 150ms debounce).
- [ ] AC-03: If the target document is not currently visible, the extension opens it first (`ViewColumn.One`) before selecting/scrolling.
- [ ] AC-04: Clicks on interactive controls inside `data-line` blocks (`button` / `a` / `input` / `select` / `textarea` / `summary` / `contenteditable` / `.comment-thread` / `.mermaid-toolbar`, e.g. mermaid `⧉ Open in View` and `</> Code`) never trigger click navigation, so using a control does not yank focus to the Editor.

---

## US-07 Navigate Between Diff Chunks

> Scope note: diff mode only (see US-15). In Normal mode the nav bar is hidden (no chunks exist).

As a user reviewing long documents, I want to jump through diff chunks one by one and know which one I am looking at, so I can go through all changes systematically.

### AC

- [ ] AC-01: The header shows Prev/Next buttons and a counter (`diff-counter`): `0 / 0` with disabled buttons when there is no diff; `- / N` before the position is set; `i / N` once positioned.
- [ ] AC-02: Adjacent diff elements are merged into one chunk: same table, same `pre`, or adjacent DOM siblings; nested diff children are filtered out to avoid double counting.
- [ ] AC-03: Navigation wraps around: Next on the last chunk goes back to the first, Prev on the first goes to the last; with a single chunk the index always stays at 0.
- [ ] AC-04: The following shortcuts work: `Alt+Down`/`Alt+Up` (VS Code standard), `F7`/`Shift+F7`, plus single keys `n`/`j`/`]` (next) and `p`/`k`/`[` (previous) when not editing; the `Go to Next/Previous Diff` command palette entries (bound to `Alt+Down`/`Alt+Up`) work the same way.
- [ ] AC-05: While double-click editing text (`isEditing`) or when focus is in an input/`contenteditable` (including comment edit boxes), single-key shortcuts do not fire; `Ctrl`/`Meta` modifier combinations also do not trigger single-key navigation.
- [ ] AC-06: Each navigation smoothly scrolls the target chunk to the viewport center with a brief highlight (`diff-focus-highlight` for ~1.5s) while the Editor scrolls to that chunk's `data-line`; when I scroll manually, the counter follows the chunk closest to the viewport center.

---

## US-08 New Files, No Changes, and Non-Git Cases

As a user, I want a sensible preview in edge states (new file, no modifications, non-git repo) instead of an error or a blank page.

### AC

- [ ] AC-01: For an untracked new file (`git ls-files --error-unmatch` fails): all lines are treated as added, with the banner `✨ This is a new file — all content shown as additions`.
- [ ] AC-02: When there is no diff against `diffBase` and no unstaged changes either, plain Markdown is shown with no markers, no banner, and no error.
- [ ] AC-03: When the file is outside the workspace or git commands fail (non-git repo, git missing from PATH), the Preview still shows the Markdown body (`diff == null`) without crashing.
- [ ] AC-04: Removed content positioned after the last line (`removedLines.get(lines.length + 1)`) is shown at the very end of the document.
- [ ] AC-05: When the Markdown file tracked by the open Preview panel is deleted from disk (or renamed away, via `onDidDeleteFiles` / `onDidRenameFiles` old URI), the panel closes automatically; closing the editor tab alone does not close it.

---

## US-09 Inline Mermaid Preview

As a user drawing flowcharts in documents, I want Mermaid code blocks to render as diagrams directly, so I can verify them.

### AC

- [ ] AC-01: A code block fenced with ` ```mermaid ` renders as a `mermaid-container` (with a `Mermaid` badge, title, diagram area, and source area); the source is stored hidden in `mermaid-raw` and the render target is `mermaid-rendered#mermaid-inline-<index>`.
- [ ] AC-02: Diagram title resolution order: (1) YAML frontmatter `title:` → (2) `%% title: ...` / `%% ...` comments (excluding `%%{init...}%%` directives) → (3) inference by diagram type (Flowchart / Sequence Diagram / Class Diagram / State Diagram / ER Diagram / Gantt / Pie / Git Graph / Mindmap / Quadrant / Journey / C4) → (4) fallback `Diagram N`.
- [ ] AC-03: When I click the `</> Code` button I can toggle between "diagram / source"; clicking `⧉ Open in View` reveals the in-panel diagrams pane on the right and focuses the requested diagram (see US-10).
- [ ] AC-04: A Mermaid syntax error shows `⚠️ Mermaid Syntax Error` + the error message instead of a blank area; a Mermaid library load failure shows a library-not-loaded error message.
- [ ] AC-05: A mermaid block containing a diff carries `has-diff` on its container; when its start line is added it is additionally wrapped in `diff-line added`.
- [ ] AC-06: A diagram requesting the ELK layout (`%%{init: {"layout": "elk"}}%%`, e.g. `stateDiagram-v2`) renders with the ELK engine instead of an `Unknown layout algorithm: elk` error; the vendored `media/mermaid.min.js` bundles `@mermaid-js/layout-elk` and registers it at load (rebuild via `npm run build:mermaid`).

---

## US-10 In-Panel Diagrams Split (Multi-Diagram Tabs)

As a user with multiple diagrams, I want the diagrams beside the preview inside the same panel, so dragging the preview to another window never strands the diagrams behind it.

### AC

- [ ] AC-01: The Preview panel is split left/right: the left `preview-pane` shows the rendered Markdown, the right `diagrams-pane` shows the diagrams, separated by a draggable `split-splitter`. Dragging the splitter (or `←`/`→` keys on the focused splitter) resizes both panes between 20%–80%; the ratio persists via webview state. The `📊 Diagrams (N)` header button shows the diagram count and reveals the pane; the pane's `✕` button collapses it. With no diagrams an empty-state is shown (`📊 No Mermaid diagrams found`).
- [ ] AC-02: Each diagram gets one tab (`tab-number` + `tab-title` + tooltip `title (Line N)`), supporting click switching, Previous/Next buttons; the footer shows `Diagram i of N — <title>`. `⧉ Open in View` on an inline diagram and the `Open Markdown Diagrams View` command both switch the in-panel tab in place (no second webview panel is ever created, no cross-window focus jump).
- [ ] AC-03: I can zoom directly with the scroll wheel (no Ctrl needed), pan by dragging, pinch-zoom with two fingers, and double-click to reset; the `−`/`+` buttons step zoom by ×1.2, the center button shows the percentage and clicks back to fit-to-view; zoom is clamped to 20%–5000%.
- [ ] AC-04: Switching tabs preserves each diagram's own zoom/pan; a diagram first opened is auto-fitted to the viewport size.
- [ ] AC-05: When I click `Copy SVG` the current diagram's SVG is copied, with a `SVG copied to clipboard ✓` toast; with no SVG the toast shows `No SVG available`.
- [ ] AC-06: When I click `⎘ Jump to line`, the Editor jumps to that diagram's start line in the Markdown.
- [ ] AC-07: When I keep typing in the editor, the diagrams pane updates automatically with the same document; the current tab index is retained when possible.
- [ ] AC-08: `markdownDiffPreview.classDiagramDetail` (`minimal` / `compact` / `full`, default `full`) controls how much detail class diagrams show in the diagrams pane: `minimal` shows class names + relationships only (emptied `class X { ... }` blocks collapse to bare `class X`, single compartment via Mermaid `hideEmptyMembersBox`), `compact` additionally shows properties (members whose text does not start with `+` / `-`, two compartments — the empty methods divider is hidden in the webview), `full` shows everything. Statements that are never members (`classDef`, `cssClass`, `style`, `click`/`link`, `note`, `direction`, `namespace`) are preserved at all levels so styling keeps working. Non-class diagrams are never filtered. The pane's `Class: minimal/compact/full` dropdown reflects the current value and writes back to the global setting on change; editing Settings JSON refreshes the view via `onDidChangeConfiguration`.
- [ ] AC-09: When the panel is too narrow to fit tabs and controls in one row, tabs wrap onto additional lines (`flex-wrap: wrap`, no horizontal scrollbar) and the controls group wraps onto a second header row (wrapping internally on extremely narrow widths), so tabs and controls never overlap. The tab bar uses a content-based flex basis (not `flex: 1`) so it never collapses to ~0px under the controls; a single overlong tab title is truncated with ellipsis (full title kept in the tooltip). Below 700px the two panes stack vertically instead of side-by-side.
- [ ] AC-10: When I click a class block in a class diagram or a lane header in a sequence diagram, all class blocks and lane headers with the same name in the current diagram are highlighted together (`diagram-highlight`) with a slow 3s infinite blink (`diagramHighlightBlink`, disabled under `prefers-reduced-motion`); name comparison ignores case, all whitespace, `<<stereotypes>>` and `~T~` / `<T>` generics. The selection persists across tab switches (re-applied on `selectTab`); clicking the same name again, clicking empty space, or pressing `Esc` clears it. Drag-panning (pointer move > 6px) never triggers a selection.
- [ ] AC-11: When I click `⧉ Open in View` on a diagram, the in-panel diagrams pane is revealed (uncollapsed if hidden) and switches to the requested tab in place via message (zoom/pan/highlight of other tabs preserved, no `webview.html` rebuild). Repeating it on the same tab only re-selects it; focus never leaves the single panel, so a preview dragged to its own window keeps working.
- [ ] AC-12: When a sequence diagram is panned so its actor headers scroll out of view, a sticky lane bar (`actor-sticky-bar`) appears pinned to the top of the diagram area showing one chip per lane (`actor-sticky-chip`), each horizontally aligned with its lifeline and following pan/zoom; the bar hides again when the real headers are visible (e.g. fitted view) and never appears for diagrams without lanes. Clicking a chip centers that lane and selects it (same `diagram-highlight` as clicking the lane header). Each chip samples its original header's text/box colors (`pickChipColorValue` → `--chip-fg/bg/border`, falling back to `text-primary`/`bg-tertiary`) so the chip text is never dimmer than the source title; CSS variables keep `:hover`/`.active` overrides working. Chip width (`computeLaneChipWidth`) grows with zoom from the lane's own scaled header width but is bounded by the scaled gap to the nearest neighbor lane (crowded lanes shrink with ellipsis instead of overlapping; a lone lane grows up to the `480px` safety cap). Chip font size (`computeChipFontSize`, `12px` at 100% clamped to `11–18px`) and bar height (`computeStickyBarHeight`, `36px` at 100% clamped to `28–64px`) scale with zoom. The header `Lanes` toggle (`actor-sticky-toggle`) hides/shows the bar manually and stays hidden when the diagram has no lanes.
- [ ] AC-13: `←`/`→` keys switch diagrams only when focus is inside the diagrams pane (so reading the preview with arrows is unaffected); `Esc` anywhere clears the diagram selection. In the legacy standalone view arrows always switched; that view no longer exists (`MarkdownDiagramsPanel` is a deprecated forwarder that never creates a webview).
- [ ] AC-14: The two panes scroll independently: the panel body is viewport-pinned (`split-view-body`, no page scrollbar) while the preview scrolls inside its own pane and the diagrams pane keeps a fixed viewport (pan/zoom via transform, as in the legacy standalone view), so scrolling the document never drags the diagram away. The diff Prev/Next counter follows the preview pane's scroll position. Below 700px the panes stack vertically and revert to normal document scroll.
- [ ] AC-15: I can show either pane alone to maximize visible range: the header `Preview | Both | Diagrams` toggle (`pane-visibility-toggle`, `setPaneVisibility()`) switches between preview-only, both panes, and diagrams-only. The diagrams pane `✕` shows preview-only and its `Preview: hide` button shows diagrams-only; the `📊 Diagrams (N)` button reveals the diagrams pane when hidden. In single-pane mode the hidden pane is `collapsed` (`display: none`) and the `split-splitter` is hidden; the visible pane takes `flex: 1 1 100%`. The choice persists per panel session via webview state (`paneVisibility`, legacy `diagramsVisible: false` resolves to preview-only) and survives typing updates and webview reloads. Commands `Show Preview Only` / `Show Diagrams Only` / `Show Preview and Diagrams` do the same. With no diagrams, diagrams-only shows the `📊 No Mermaid diagrams found` empty-state.

---

## US-11 In-Document Comments System

As a user reviewing documents collaboratively, I want to leave comments on words or blocks directly in Markdown and see AI replies/plans, so I can track follow-ups.

### AC

- [ ] AC-01: I can add `<!--comment:N-->` after inline text (inline) or on its own line before an element (block), and define each comment in the trailing `<!-- COMMENTS-DATA {...} -->` JSON (`id`, `target`, `thread[]`, `plan`, `response`); IDs must be sequential and unique.
- [ ] AC-02: The Preview shows a `[N]` badge (`comment-badge`, styled by status: `has-response` / `has-plan` / `active`) at each commented spot; inline-comment badges sit right after the target text with the whole segment wrapped in `comment-highlight`; block-comment badges appear at the start of the element.
- [ ] AC-03: When I click a badge, that comment thread opens (other threads close), showing the message thread (with the author `AI` label and timestamps) plus `Plan` and `Response` sections; clicking `×` closes it; opening a thread scrolls both the Preview and the Editor to the target line with a brief highlight.
- [ ] AC-04: The `Plan` and `Response` blocks are `contenteditable`; after I edit and blur, the content is written back to the trailing `COMMENTS-DATA` JSON in the Markdown file (a missing plan/response is created with `pending`/`draft` + `editable: true`), and the Preview refreshes automatically; an unknown `commentId` or a missing `COMMENTS-DATA` block shows a warning without corrupting the file.
- [ ] AC-05: I can cycle through comments in document order with the `←`/`→` buttons inside a thread; the nav buttons are disabled with ≤1 comment.
- [ ] AC-06: The `COMMENTS-DATA` block itself is never rendered; `<!--comment:N-->` markers never appear in the body text; when JSON parsing fails the Preview still shows the body normally.

---

## US-12 In-Preview Editing (WYSIWYG)

As a user fixing copy quickly, I want to double-click preview text to edit it in place and sync it back to the Markdown source, so I don't have to hunt for lines across two windows.

### AC

- [ ] AC-01: When I double-click the smallest editable unit in the preview (`strong` / `em` / `del` / `code` / `a` / `td` / `th` / `plain-text`, or a whole block with no formatted children), that element becomes editable (`contenteditable` + `editing` class); table rows (`tr`/`table`), `pre`, and removed blocks are not directly editable.
- [ ] AC-02: While editing, `Enter` confirms (writes back), `Esc` cancels (restores `originalText`), and blur auto-confirms; write-back preserves Markdown prefixes (`#`, `-`, ordered-list numbers, `>`) and inline markers (`**`, `__`, `*`, `_`, `~~`, `` ` ``, `[text](url)`).
- [ ] AC-03: Plain-text replacement during editing avoids already-formatted spans (no accidental replacement inside `**...**`, `*...*`, `` `...` ``, `~~...~~`, `[...](...)`).
- [ ] AC-04: While editing (`isEditing == true`), single-click navigation and single-key diff navigation are suspended; `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` (including `Cmd`) trigger editor undo/redo from the Preview, with focus returning to the Preview afterwards.
- [ ] AC-05: Write-back only runs when the text actually changed (`WorkspaceEdit.replace` on that line's range); unchanged text writes nothing.

---

## US-13 Relative-Path Images

As a user storing screenshots via relative paths, I want images to display correctly in the preview instead of being broken.

### AC

- [ ] AC-01: `![alt](<relative-path>)` in Markdown is resolved against the document's directory into a webview-safe URI (`asWebviewUri`); URLs starting with `http(s):`, `data:`, or `vscode-` are left unchanged.
- [ ] AC-02: URLs containing parentheses/special characters still resolve correctly; on resolution failure the original URL is kept as a fallback and full-page rendering never breaks.

---

## US-14 Extension Settings

As a user, I want settings to adjust the diff base and display options, so the extension fits different branching workflows and preferences.

### AC

- [ ] AC-01: `markdownDiffPreview.diffBase` (default `HEAD`): the git comparison base, e.g. `main`, `origin/main`; the header shows `vs <diffBase>`. Values containing characters outside `[A-Za-z0-9/._@{}^~:-]` (or longer than 256 chars) fall back to `HEAD` and never reach a shell.
- [ ] AC-02: `markdownDiffPreview.showLineNumbers` (default `true`): whether added lines show line numbers.
- [ ] AC-03: `markdownDiffPreview.highlightStyle` (default `both`, only `inline` / `gutter` / `both` allowed): how diff highlights are displayed.
- [ ] AC-04: `markdownDiffPreview.enableWordDiff` (default `true`): whether word-level diff is enabled (see US-04).
- [ ] AC-05: `markdownDiffPreview.classDiagramDetail` (default `full`, only `minimal` / `compact` / `full` allowed): how much detail class diagrams show in the Diagrams view (see US-10 AC-08).
- [ ] AC-06: `markdownDiffPreview.enableMath` (default `true`): whether LaTeX math is rendered with KaTeX (see US-16).

---

## US-16 LaTeX Math Rendering (KaTeX)

As a user writing technical documents, I want LaTeX math to render as typeset formulas directly in the Preview, so I can verify equations without leaving VS Code.

### AC

- [ ] AC-01: Inline `$...$` and `\(...\)` render via KaTeX (`math-inline` + `katex` classes); display blocks `$$...$$` (single-line or fenced multi-line) and `\[...\]` render centered (`math-display` + `katex-display`), e.g. `$$ M=\sum_{i=1}^{n}p_iq_i,\qquad T=M+F $$`.
- [ ] AC-02: Currency is never rendered as math: a lone `$10` stays literal, `\$` escapes to `$`, and pure-numeric `$...$` pairs are rejected; math inside fenced code blocks and inline `` ` `` code stays source text.
- [ ] AC-03: Invalid TeX shows a visible `math-error` fallback with the original source instead of a blank area; KaTeX assets (`media/katex.min.css` + `media/fonts/`) are vendored locally with no CDN (offline-safe, satisfies the webview CSP).
- [ ] AC-04: Math keeps working with diff chrome (added-line wrapper + `data-line` retained), click-to-navigate, and comments; KaTeX output is excluded from in-preview double-click editing so write-back can never corrupt the TeX source; math lines get line-level diff only (no word-diff markup inside TeX).
- [ ] AC-05: When `markdownDiffPreview.enableMath == false`, no `katex` / `math-error` markup is produced and `$` text renders literally.

---

## Non-Goals (Current State)

- Opening the Preview for languages other than Markdown is not supported.
- Diff display is not supported on VS Code below 1.85.0, or in environments without Git installed / on PATH (plain preview only).
- Exporting the Preview to a file is not provided.

---

## US-15 Preview View Mode (Normal / Diff)

As a user, I want to switch the Preview between Normal mode (current Markdown as-is) and Diff mode (git highlighting), defaulting to Normal, so I can read clean output and only show diffs when reviewing.

### AC

- [ ] AC-01: A newly opened Preview defaults to Normal mode: body carries `view-mode-normal`, the `Normal` toggle button is `active`, content renders as with `diff == null` (no `diff-line` / `diff-removed-block` / `diff-word` / `diff-row-*` / `diff-table-wrapper` / `has-diff`), while `data-line` is retained so click-to-navigate and selection sync still work.
- [ ] AC-02: The header shows a `Normal | Diff` segmented toggle (`view-mode-toggle`, `switchViewMode()`); the commands `Toggle Normal/Diff Mode`, `Show Normal Mode`, `Show Diff Mode` do the same. Switching re-renders the same document in the new mode.
- [ ] AC-03: The mode persists per panel session (extension `_viewMode` memory): typing updates, manual refresh, `.git/**` events, `onDidChangeViewState` refresh, and file switches keep the current mode; the webview mirrors it via `getState()/setState()` so a webview reload restores the UI. A brand-new panel always starts in Normal.
- [ ] AC-04: Diff mode restores the previous behaviour exactly: `view-mode-diff` body class, `+N added` / `−N removed` stats, `vs <diffBase>`, Prev/Next nav with counter, removed blocks, word diff, and the new-file banner; panel title gains a `• Diff` suffix.
- [ ] AC-05: Normal mode hides diff-only chrome: no stats, no `vs <diffBase>`, nav bar hidden, no new-file banner, no `has-diff` on Mermaid containers; Mermaid diagrams, comments, in-preview editing, and relative-path images keep working.
