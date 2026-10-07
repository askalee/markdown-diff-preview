# Changelog

All notable changes to the "Markdown Diff Preview" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-10-08

### Changed

- Diagrams view merged into the Preview panel: a single panel with left preview + draggable splitter + right diagrams pane (ratio persists, 20%–80%, collapsible, stacks vertically below 700px); a preview dragged to its own window no longer yanks focus back to the main window; `Open Markdown Diagrams View` and `⧉ Open in View` switch the in-pane tab in place (`MarkdownDiagramsPanel` is now a deprecated forwarder that never creates a webview)
- Panes scroll independently: the preview scrolls inside its own pane while the diagrams pane keeps a fixed viewport (pan/zoom via transform); the diff Prev/Next counter follows the preview pane scroll

### Fixed

- Restored click-to-highlight for class blocks / sequence lane headers in the merged pane (merge regression: `Function.toString()`-serialized helpers lost their sibling scope, throwing `ReferenceError` on first click); serialized bodies are now closure-complete via aliases

## [1.3.0] - 2026-10-07

### Fixed

- Class diagram click highlight broken after mermaid 11 upgrade: node ids now carry a renderId prefix (`<renderId>-classId-<Name>-<N>`), so the `^=` selector never matched; selector and `extractClassIdName` now use substring matching

### Added

- ELK layout support for Mermaid diagrams: `media/mermaid.min.js` now bundles `@mermaid-js/layout-elk` (mermaid 11.17.2) and registers it at load, so `%%{init: {"layout": "elk"}}%%` diagrams (e.g. `stateDiagram-v2`) render instead of failing with `Unknown layout algorithm: elk`; rebuild with `npm run build:mermaid`
- LaTeX math rendering with KaTeX (offline, vendored `media/katex.min.css` + `media/fonts/`): inline `$...$` / `\\(...\\)`, display `$$...$$` / `\\[...\\]`; currency (`$10`), `\\$` escapes, and code blocks never render as math; invalid TeX shows a visible `math-error` fallback; new `markdownDiffPreview.enableMath` setting (default `true`)

## [1.2.4] - 2026-10-07

### Added

- Diagrams view class/lane highlight now blinks slowly on a 3s cycle (`diagramHighlightBlink`, disabled under `prefers-reduced-motion`) so the selection stays visible in diagrams with many components

## [1.2.2] - 2026-10-03

### Fixed

- Diagrams view header overlap root cause: tab bar used `flex: 1` (basis 0%) so it collapsed to ~0px under the controls; now uses content-based basis so controls wrap to the next row, plus ellipsis truncation for overlong tab titles

## [1.2.1] - 2026-10-03

### Fixed

- Diagrams view header no longer overlaps tabs and controls on narrow widths: tabs wrap onto multiple lines, controls drop to a second row and wrap internally

## [1.2.0] - 2026-10-03

### Added

- Preview view mode toggle: Normal (current Markdown as-is, default) / Diff (git highlighting) via header `Normal | Diff` buttons and `Toggle / Show Normal / Show Diff` commands; mode persists per panel session

## [1.1.1] - 2026-10-03

### Fixed

- Class diagram `minimal` filter no longer drops `classDef` / `cssClass` / `style` / `click` / `note` statements containing colons, so class colors survive detail filtering

## [1.1.0] - 2026-10-02

### Added

- Class diagram detail control in the Diagrams view (`markdownDiffPreview.classDiagramDetail`: `minimal` / `compact` / `full`, default `full`); members starting with `+` / `-` are treated as methods, all others as properties
- `minimal` collapses emptied `class X { ... }` blocks to bare `class X` and hides empty compartments via Mermaid `hideEmptyMembersBox`
- `compact` shows properties only with the empty methods divider hidden
- Header dropdown in the Diagrams view to switch class detail level (writes back to the global setting)

## [1.0.0] - 2026-01-23

### Added

- Live Markdown preview with real-time rendering
- Git diff highlighting with green background for added lines
- Red highlighting for removed lines shown in context
- Auto-refresh when document or git state changes
- Dark theme with GitHub-inspired design
- Click-to-navigate: click on diff lines to jump to that line in the editor
- Configurable diff base ref (HEAD, main, origin/main, etc.)
- Optional line numbers display
- Configurable highlight style (inline, gutter, or both)
- Keyboard shortcut: `Cmd+Shift+V` (Mac) / `Ctrl+Shift+V` (Windows/Linux)
