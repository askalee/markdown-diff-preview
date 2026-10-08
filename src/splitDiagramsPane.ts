/**
 * In-panel diagrams split pane - no VS Code dependencies.
 *
 * Builds the right-hand diagrams pane HTML + client script for the single
 * preview panel. All client identifiers are `split`-prefixed so they never
 * collide with the preview's own webview script (which already declares
 * `vscode`, `waitForMermaid`, `initMermaid`, `navigate`, ...).
 */
import type { ClassDiagramDetail } from './core/classDiagramDetail';
import type { ParsedDiagram } from './core/extractDiagrams';

export function buildDiagramsSplitPaneHtml(
    diagrams: ParsedDiagram[],
    detailLevel: ClassDiagramDetail,
    currentIndex: number,
): string {
    const safeDiagramsJson = JSON.stringify(diagrams)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    // Client helpers come from media/diagram-utils.js (loaded via <script src>
    // in the host page). They are intentionally NOT embedded with
    // Function.toString(): compiled TS output is not a stable serialization
    // format. Parity is enforced by test/webviewUtilsParity.test.ts.
    const safeIndex = diagrams.length === 0 ? 0 : Math.min(Math.max(0, currentIndex), diagrams.length - 1);

    return `
    <div class="diagrams-pane" id="diagrams-pane">
        <div class="diagrams-view-container">
            <div class="diagrams-view-header">
                <div class="diagrams-tab-bar" id="diagrams-tab-bar" role="tablist"></div>
                <div class="diagrams-view-actions">
                    <select class="diagrams-ctrl-btn" id="class-detail-select" onchange="splitChangeClassDetail(this.value)" title="Class diagram detail (applies to class diagrams only)" aria-label="Class diagram detail">
                        <option value="minimal"${detailLevel === 'minimal' ? ' selected' : ''}>Class: minimal</option>
                        <option value="compact"${detailLevel === 'compact' ? ' selected' : ''}>Class: compact</option>
                        <option value="full"${detailLevel === 'full' ? ' selected' : ''}>Class: full</option>
                    </select>
                    <button class="diagrams-ctrl-btn" onclick="splitZoomDiagram(1/1.2)" title="Zoom Out" aria-label="Zoom Out"><span class="ctrl-icon">−</span></button>
                    <button class="diagrams-ctrl-btn" id="diagrams-zoom-level" onclick="splitResetZoom()" title="Reset Zoom (fit to view)" aria-label="Reset Zoom">100%</button>
                    <button class="diagrams-ctrl-btn" onclick="splitZoomDiagram(1.2)" title="Zoom In" aria-label="Zoom In"><span class="ctrl-icon">+</span></button>
                    <button class="diagrams-ctrl-btn" onclick="splitCopySvg()" title="Copy Diagram SVG to Clipboard" aria-label="Copy SVG">Copy SVG</button>
                    <button class="diagrams-ctrl-btn actor-sticky-toggle" id="actor-sticky-toggle" onclick="splitToggleStickyBar(event)" title="Hide lane bar" aria-label="Hide lane bar" aria-pressed="true">Lanes</button>
                    <button class="diagrams-ctrl-btn" onclick="splitJumpToEditorLine()" title="Jump to Line in Markdown Editor" aria-label="Jump to line">⎘ Jump to line</button>
                    <button class="diagrams-ctrl-btn" onclick="window.setPaneVisibility ? window.setPaneVisibility('diagrams') : toggleDiagramsPane(true)" title="Hide preview, show diagrams only" aria-label="Show diagrams only">🗖 Preview: hide</button>
                    <button class="diagrams-ctrl-btn" onclick="toggleDiagramsPane(false)" title="Hide diagrams, show preview only" aria-label="Show preview only">✕</button>
                </div>
            </div>
            <div class="diagrams-view-main" id="diagrams-view-main">
                <div class="actor-sticky-bar" id="actor-sticky-bar" hidden>
                    <div class="actor-sticky-inner" id="actor-sticky-inner"></div>
                </div>
                <div class="diagrams-stage" id="diagrams-stage">
                    <div class="diagrams-viewport" id="diagrams-viewport">
                        <div class="mermaid-loading">Rendering diagram...</div>
                    </div>
                </div>
            </div>
            <div class="diagrams-view-footer">
                <button class="diagrams-nav-btn" id="split-prev-btn" onclick="splitNavigate('prev')" title="Previous Diagram (Left Arrow)">← Previous</button>
                <span class="diagrams-footer-info" id="split-footer-info">Diagram 1 of 1</span>
                <button class="diagrams-nav-btn" id="split-next-btn" onclick="splitNavigate('next')" title="Next Diagram (Right Arrow)">Next →</button>
            </div>
        </div>
    </div>
    <script type="application/json" id="split-diagrams-data">${safeDiagramsJson}</script>
    <script>
        let splitRawDiagrams = [];
        try {
            const splitRawEl = document.getElementById('split-diagrams-data');
            splitRawDiagrams = splitRawEl ? JSON.parse(splitRawEl.textContent || '[]') : [];
        } catch (e) {
            console.error('Failed to parse diagrams data:', e);
        }

        let splitCurrentIndex = ${safeIndex};
        let splitCurrentZoom = 1.0;
        let splitPanX = 0;
        let splitPanY = 0;
        const SPLIT_MIN_ZOOM = 0.2;
        const SPLIT_MAX_ZOOM = 50.0;
        const splitClassDetail = '${detailLevel}';
        const splitRenderedSvgs = {};
        const splitViewStates = {};
        const splitNormalizeDiagramName = window.DiagramUtils.normalizeDiagramName;
        const splitIsSameDiagramName = window.DiagramUtils.isSameDiagramName;
        const splitExtractClassIdName = window.DiagramUtils.extractClassIdName;
        const splitIsDragMovement = window.DiagramUtils.isDragMovement;
        const SPLIT_CLASS_NODE_SELECTOR = window.DiagramUtils.CLASS_NODE_SELECTOR;
        const SPLIT_ACTOR_HEADER_SELECTOR = window.DiagramUtils.ACTOR_HEADER_SELECTOR;
        const SPLIT_HIGHLIGHT_CLASS = window.DiagramUtils.DIAGRAM_HIGHLIGHT_CLASS;
        const SPLIT_STICKY_BAR_HEIGHT = window.DiagramUtils.STICKY_BAR_HEIGHT;
        const splitShouldShowStickyHeader = window.DiagramUtils.shouldShowStickyHeader;
        const splitComputeChipCenterOffset = window.DiagramUtils.computeChipCenterOffset;
        const splitComputeCenterPanX = window.DiagramUtils.computeCenterPanX;
        const splitClampChipWidth = window.DiagramUtils.clampChipWidth;
        const splitPickChipColorValue = window.DiagramUtils.pickChipColorValue;
        const splitComputeLaneChipWidth = window.DiagramUtils.computeLaneChipWidth;
        const splitComputeChipFontSize = window.DiagramUtils.computeChipFontSize;
        const splitComputeStickyBarHeight = window.DiagramUtils.computeStickyBarHeight;
        // Aliases for helper bodies that reference their original sibling
        // names (e.g. isSameDiagramName calls normalizeDiagramName).
        const normalizeDiagramName = splitNormalizeDiagramName;
        const isSameDiagramName = splitIsSameDiagramName;
        const extractClassIdName = splitExtractClassIdName;
        const isDragMovement = splitIsDragMovement;
        const shouldShowStickyHeader = splitShouldShowStickyHeader;
        const computeChipCenterOffset = splitComputeChipCenterOffset;
        const computeCenterPanX = splitComputeCenterPanX;
        const clampChipWidth = splitClampChipWidth;
        const pickChipColorValue = splitPickChipColorValue;
        const computeLaneChipWidth = splitComputeLaneChipWidth;
        const computeChipFontSize = splitComputeChipFontSize;
        const computeStickyBarHeight = splitComputeStickyBarHeight;
        const STICKY_BAR_HEIGHT = window.DiagramUtils.STICKY_BAR_HEIGHT;
        const MIN_CHIP_WIDTH = window.DiagramUtils.MIN_CHIP_WIDTH;
        const MAX_CHIP_WIDTH = window.DiagramUtils.MAX_CHIP_WIDTH;
        let splitSelectedName = null;
        let splitSelectedNormalized = null;
        let splitStickyLanes = [];
        let splitStickySvgWidth = 0;
        let splitStickyHeaderH = 0;
        let splitStickyCollapsed = false;

        function splitGetViewState(index) {
            if (!splitViewStates[index]) {
                splitViewStates[index] = { zoom: 1.0, panX: 0, panY: 0 };
            }
            return splitViewStates[index];
        }

        function splitSaveViewState(index) {
            if (index === null || index === undefined || index < 0) return;
            splitViewStates[index] = { zoom: splitCurrentZoom, panX: splitPanX, panY: splitPanY };
        }

        function splitRestoreViewState(index) {
            const s = splitGetViewState(index);
            splitCurrentZoom = s.zoom;
            splitPanX = s.panX;
            splitPanY = s.panY;
            splitApplyZoom();
        }

        function splitSyncViewState() {
            if (splitCurrentIndex !== null && splitCurrentIndex !== undefined && splitCurrentIndex >= 0) {
                splitViewStates[splitCurrentIndex] = { zoom: splitCurrentZoom, panX: splitPanX, panY: splitPanY };
            }
        }

        function splitHasViewState(index) {
            return Object.prototype.hasOwnProperty.call(splitViewStates, index);
        }

        const splitBaseSizes = {};

        function splitMeasureIntrinsicSize() {
            const viewport = document.getElementById('diagrams-viewport');
            if (!viewport) return null;
            const svg = viewport.querySelector('svg');
            if (!svg) return null;
            try {
                const vb = svg.viewBox && svg.viewBox.baseVal;
                if (vb && vb.width > 0 && vb.height > 0) {
                    return { w: vb.width, h: vb.height };
                }
            } catch (e) { /* fall through */ }
            const aw = svg.getAttribute('width') || '';
            const ah = svg.getAttribute('height') || '';
            const pw = parseFloat(aw);
            const ph = parseFloat(ah);
            if (aw.indexOf('%') === -1 && ah.indexOf('%') === -1 && pw > 0 && ph > 0) {
                return { w: pw, h: ph };
            }
            try {
                const probe = document.createElement('div');
                probe.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;';
                const clone = svg.cloneNode(true);
                probe.appendChild(clone);
                document.body.appendChild(probe);
                const r = clone.getBoundingClientRect();
                probe.remove();
                if (r.width > 0 && r.height > 0) {
                    return { w: r.width, h: r.height };
                }
            } catch (e) { /* fall through */ }
            const rect = svg.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                return { w: rect.width, h: rect.height };
            }
            return null;
        }

        function splitResolveBaseSize(index) {
            if (splitBaseSizes[index]) return splitBaseSizes[index];
            const s = splitMeasureIntrinsicSize();
            if (s) splitBaseSizes[index] = s;
            return s;
        }

        function splitComputeFitZoom(index) {
            const main = document.getElementById('diagrams-view-main');
            const size = splitResolveBaseSize(index !== undefined ? index : splitCurrentIndex);
            if (!main || !size) return 1.0;
            const availW = main.clientWidth - 48;
            const availH = main.clientHeight - 48;
            if (availW <= 0 || availH <= 0) return 1.0;
            const fit = Math.min(availW / size.w, availH / size.h) * 0.95;
            return Math.max(SPLIT_MIN_ZOOM, Math.min(SPLIT_MAX_ZOOM, fit));
        }

        function splitGetTheme() {
            if (document.body.classList.contains('vscode-light') || document.body.classList.contains('theme-light')) {
                return 'default';
            }
            if (document.body.classList.contains('vscode-high-contrast')) {
                return 'forest';
            }
            return 'dark';
        }

        async function splitWaitForMermaid(maxWaitMs = 3000) {
            const start = Date.now();
            while (!window.mermaid && (Date.now() - start) < maxWaitMs) {
                await new Promise(r => setTimeout(r, 50));
            }
            return window.mermaid;
        }

        async function splitInitDiagrams() {
            const m = await splitWaitForMermaid();
            if (m) {
                try {
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: splitGetTheme(),
                        securityLevel: 'loose',
                        class: { hideEmptyMembersBox: splitClassDetail !== 'full' },
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    });
                } catch (e) {
                    console.error('Failed to initialize mermaid:', e);
                }
            }
            splitRenderTabs();
            if (splitRawDiagrams.length > 0) {
                await splitSelectTab(splitCurrentIndex >= 0 && splitCurrentIndex < splitRawDiagrams.length ? splitCurrentIndex : 0, true);
            } else {
                const viewport = document.getElementById('diagrams-viewport');
                if (viewport) {
                    viewport.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>No Mermaid diagrams found in this Markdown document</p></div>';
                }
                const info = document.getElementById('split-footer-info');
                if (info) info.textContent = '0 diagrams';
            }
        }

        function splitRenderTabs() {
            const tabBar = document.getElementById('diagrams-tab-bar');
            if (!tabBar) return;
            tabBar.innerHTML = '';
            splitRawDiagrams.forEach((d, idx) => {
                const tab = document.createElement('button');
                tab.className = 'diagrams-tab' + (idx === splitCurrentIndex ? ' active' : '');
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-selected', idx === splitCurrentIndex ? 'true' : 'false');
                tab.dataset.tabIndex = String(idx);
                tab.title = d.title + ' (Line ' + d.line + ')';
                tab.innerHTML = '<span class="tab-number">' + (idx + 1) + '.</span> <span class="tab-title"></span>';
                tab.querySelector('.tab-title').textContent = d.title;
                tab.onclick = () => splitSelectTab(idx);
                tabBar.appendChild(tab);
            });
        }

        async function splitRenderDiagram(index) {
            if (splitRenderedSvgs[index]) {
                return splitRenderedSvgs[index];
            }
            const item = splitRawDiagrams[index];
            if (!item) return '';
            const m = await splitWaitForMermaid();
            if (!m) {
                return '<div class="mermaid-error"><div class="mermaid-error-title">⚠️ Mermaid Library Not Loaded</div></div>';
            }
            try {
                const renderId = 'split-diagram-svg-' + index + '-' + Date.now();
                const res = await mermaid.render(renderId, item.code);
                splitRenderedSvgs[index] = res.svg;
                return res.svg;
            } catch (err) {
                const errMsg = (err && err.message) || String(err);
                const safe = errMsg.replace(/</g, '&lt;');
                return '<div class="mermaid-error"><div class="mermaid-error-title">⚠️ Mermaid Syntax Error</div><div class="mermaid-error-msg">' + safe + '</div></div>';
            }
        }

        function splitCollapseEmptyClassBoxes(viewport) {
            if (splitClassDetail === 'full' || !viewport) return;
            viewport.querySelectorAll('g.node').forEach((node) => {
                const members = node.querySelector('.members-group');
                const methods = node.querySelector('.methods-group');
                if (!members && !methods) return;
                const membersEmpty = !members || members.textContent.trim() === '';
                const methodsEmpty = !methods || methods.textContent.trim() === '';
                if (!membersEmpty && !methodsEmpty) return;
                const dividers = node.querySelectorAll('.divider');
                if (dividers.length === 0) return;
                if (membersEmpty && methodsEmpty) {
                    dividers.forEach((d) => { d.style.display = 'none'; });
                } else if (methodsEmpty) {
                    dividers[dividers.length - 1].style.display = 'none';
                } else {
                    dividers[0].style.display = 'none';
                }
            });
        }

        function splitClassNodeName(node) {
            if (!node) return '';
            const label = node.querySelector('.nodeLabel');
            if (label && label.textContent && label.textContent.trim() !== '') {
                return label.textContent;
            }
            return splitExtractClassIdName(node.getAttribute('id') || '') || '';
        }

        function splitActorHeaderName(el) {
            if (!el) return '';
            const tag = (el.tagName || '').toLowerCase();
            if (tag === 'text') return el.textContent || '';
            if (el.classList && el.classList.contains('actor-man')) {
                const t = el.querySelector('text');
                if (t && t.textContent && t.textContent.trim() !== '') return t.textContent;
                return el.getAttribute('name') || '';
            }
            const parent = el.parentElement;
            const sib = parent ? parent.querySelector('text') : null;
            if (sib && sib.textContent && sib.textContent.trim() !== '') return sib.textContent;
            return el.getAttribute('name') || '';
        }

        function splitResolveClickedName(target) {
            if (!target || !target.closest) return null;
            const classNode = target.closest(SPLIT_CLASS_NODE_SELECTOR);
            if (classNode) {
                const name = splitClassNodeName(classNode);
                return name && splitNormalizeDiagramName(name) ? name : null;
            }
            const seq = target.closest(SPLIT_ACTOR_HEADER_SELECTOR);
            if (seq) {
                const name = splitActorHeaderName(seq);
                return name && splitNormalizeDiagramName(name) ? name : null;
            }
            return null;
        }

        function splitApplyHighlight() {
            const viewport = document.getElementById('diagrams-viewport');
            if (!viewport) return;
            viewport.querySelectorAll('.' + SPLIT_HIGHLIGHT_CLASS).forEach((el) => {
                el.classList.remove(SPLIT_HIGHLIGHT_CLASS);
            });
            if (splitSelectedNormalized) {
                viewport.querySelectorAll(SPLIT_CLASS_NODE_SELECTOR).forEach((node) => {
                    if (splitIsSameDiagramName(splitClassNodeName(node), splitSelectedName)) {
                        node.classList.add(SPLIT_HIGHLIGHT_CLASS);
                    }
                });
                viewport.querySelectorAll(SPLIT_ACTOR_HEADER_SELECTOR).forEach((el) => {
                    if (splitIsSameDiagramName(splitActorHeaderName(el), splitSelectedName)) {
                        el.classList.add(SPLIT_HIGHLIGHT_CLASS);
                    }
                });
            }
            splitSyncStickyBar();
        }

        function splitSetSelected(name) {
            if (!name || !splitNormalizeDiagramName(name)) {
                splitSelectedName = null;
                splitSelectedNormalized = null;
            } else {
                const norm = splitNormalizeDiagramName(name);
                if (splitSelectedNormalized === norm) {
                    splitSelectedName = null;
                    splitSelectedNormalized = null;
                } else {
                    splitSelectedName = name;
                    splitSelectedNormalized = norm;
                }
            }
            splitApplyHighlight();
        }

        function splitClearSelection() {
            if (!splitSelectedNormalized) return;
            splitSelectedName = null;
            splitSelectedNormalized = null;
            splitApplyHighlight();
        }

        function splitSetupHighlight() {
            const main = document.getElementById('diagrams-view-main');
            if (!main || main.dataset.highlightBound === '1') return;
            main.dataset.highlightBound = '1';
            let downX = 0;
            let downY = 0;
            main.addEventListener('pointerdown', (e) => {
                downX = e.clientX;
                downY = e.clientY;
            });
            main.addEventListener('click', (e) => {
                if (splitIsDragMovement(downX, downY, e.clientX, e.clientY)) return;
                const under = document.elementFromPoint(e.clientX, e.clientY) || e.target;
                const name = splitResolveClickedName(under);
                if (name) {
                    splitSetSelected(name);
                } else {
                    splitClearSelection();
                }
            });
        }

        function splitMeasureActorBox(el, isRect) {
            let cx = NaN;
            let top = Infinity;
            let bottom = -Infinity;
            let w = 0;
            try {
                const b = el.getBBox();
                cx = b.x + b.width / 2; top = b.y; bottom = b.y + b.height; w = b.width;
            } catch (e) {
                const x = parseFloat(el.getAttribute('x') || '');
                const ww = parseFloat(el.getAttribute('width') || '');
                if (isFinite(x) && isRect && isFinite(ww)) { cx = x + ww / 2; w = ww; }
                else if (isFinite(x)) { cx = x; }
                const y = parseFloat(el.getAttribute('y') || '');
                if (isFinite(y)) { top = y; bottom = y; }
            }
            return isFinite(cx) ? { cx: cx, top: top, bottom: bottom, width: w } : null;
        }

        function splitSampleElementPaint(el, property) {
            try {
                if (!el) return null;
                let computed = '';
                if (typeof getComputedStyle === 'function') {
                    computed = getComputedStyle(el)[property] || '';
                }
                const picked = splitPickChipColorValue(computed);
                if (picked) return picked;
                const attr = typeof el.getAttribute === 'function' ? el.getAttribute(property) : '';
                return splitPickChipColorValue(attr);
            } catch (e) { return null; }
        }

        function splitSampleTextFill(t) {
            // Mermaid paints sequence labels on text.actor>tspan; the <text>
            // itself inherits the dark actor box fill, so sample the tspan.
            let inner = null;
            try { inner = t ? t.querySelector('tspan') : null; } catch (e) { inner = null; }
            return splitSampleElementPaint(inner || t, 'fill');
        }

        function splitMeasureLaneLabel(t, rectBoxes, rectEls, midY, minX, seenNames) {
            const rawName = t.textContent || '';
            if (!splitNormalizeDiagramName(rawName)) return null;
            const box = splitMeasureActorBox(t, false);
            if (!box || box.top >= midY) return null;
            const key = splitNormalizeDiagramName(rawName);
            if (seenNames[key]) return null;
            seenNames[key] = 1;
            const xAttr = parseFloat(t.getAttribute('x') || '');
            let cx = box.cx;
            let width = box.width + 28;
            let matchedRect = null;
            for (let i = 0; i < rectBoxes.length; i++) {
                if (rectBoxes[i].top < midY
                    && (Math.abs(rectBoxes[i].cx - box.cx) <= 12
                        || (isFinite(xAttr) && Math.abs(rectBoxes[i].cx - xAttr) <= 2))) {
                    cx = rectBoxes[i].cx;
                    width = rectBoxes[i].width;
                    matchedRect = rectEls[i] || null;
                    break;
                }
            }
            if (cx === box.cx && isFinite(xAttr) && Math.abs(xAttr - box.cx) <= 12) {
                cx = xAttr;
            }
            return {
                name: rawName.trim(),
                cx: cx - minX,
                width: width,
                bottom: box.bottom,
                fg: splitSampleTextFill(t),
                bg: splitSampleElementPaint(matchedRect, 'fill'),
                border: splitSampleElementPaint(matchedRect, 'stroke'),
            };
        }

        function splitMeasureStickyLanes(svg) {
            let minX = 0;
            let minY = 0;
            let svgW = 0;
            let svgH = 0;
            try {
                const vb = svg.viewBox && svg.viewBox.baseVal;
                if (vb && vb.width > 0 && vb.height > 0) {
                    minX = vb.x; minY = vb.y; svgW = vb.width; svgH = vb.height;
                }
            } catch (e) { /* fall through to base size */ }
            if (!svgW) {
                const base = splitResolveBaseSize(splitCurrentIndex);
                if (!base) return null;
                svgW = base.w; svgH = base.h;
            }
            const midY = minY + svgH / 2;
            const rectBoxes = [];
            const rectEls = [];
            svg.querySelectorAll('rect.actor').forEach((r) => {
                const box = splitMeasureActorBox(r, true);
                if (box) { rectBoxes.push(box); rectEls.push(r); }
            });
            const seenNames = {};
            const lanes = [];
            let headerBottom = minY;
            rectBoxes.forEach((rb) => {
                if (rb.top < midY && rb.bottom > headerBottom) headerBottom = rb.bottom;
            });
            svg.querySelectorAll('text.actor').forEach((t) => {
                const lane = splitMeasureLaneLabel(t, rectBoxes, rectEls, midY, minX, seenNames);
                if (!lane) return;
                lanes.push(lane);
                if (lane.bottom > headerBottom) headerBottom = lane.bottom;
            });
            svg.querySelectorAll('g.actor-man').forEach((g) => {
                try {
                    const b = g.getBBox();
                    if (b.y < midY && b.y + b.height > headerBottom) headerBottom = b.y + b.height;
                } catch (e) { /* ignore */ }
            });
            if (lanes.length === 0) return null;
            lanes.sort((a, b) => a.cx - b.cx);
            return { lanes: lanes, svgWidth: svgW, headerH: Math.max(0, headerBottom - minY) };
        }

        function splitRebuildStickyBar() {
            const bar = document.getElementById('actor-sticky-bar');
            const inner = document.getElementById('actor-sticky-inner');
            splitStickyLanes = [];
            splitStickySvgWidth = 0;
            splitStickyHeaderH = 0;
            if (!bar || !inner) return;
            inner.innerHTML = '';
            bar.hidden = true;
            const viewport = document.getElementById('diagrams-viewport');
            const svg = viewport ? viewport.querySelector('svg') : null;
            if (!svg) return;
            const measured = splitMeasureStickyLanes(svg);
            if (!measured) return;
            splitStickyLanes = measured.lanes;
            splitStickySvgWidth = measured.svgWidth;
            splitStickyHeaderH = measured.headerH;
            measured.lanes.forEach((lane, i) => {
                const chip = document.createElement('button');
                chip.className = 'actor-sticky-chip';
                chip.type = 'button';
                chip.textContent = lane.name;
                chip.title = lane.name;
                chip.setAttribute('aria-label', 'Center lane ' + lane.name);
                if (lane.fg) chip.style.setProperty('--chip-fg', lane.fg);
                if (lane.bg) chip.style.setProperty('--chip-bg', lane.bg);
                if (lane.border) chip.style.setProperty('--chip-border', lane.border);
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    splitCenterStickyLane(i);
                });
                inner.appendChild(chip);
            });
            splitSyncStickyBar();
        }

        function splitUpdateStickyToggle(hasLanes) {
            const toggle = document.getElementById('actor-sticky-toggle');
            if (!toggle) return;
            toggle.hidden = !hasLanes;
            toggle.setAttribute('aria-pressed', splitStickyCollapsed ? 'false' : 'true');
            toggle.title = splitStickyCollapsed ? 'Show lane bar' : 'Hide lane bar';
            toggle.setAttribute('aria-label', splitStickyCollapsed ? 'Show lane bar' : 'Hide lane bar');
            toggle.classList.toggle('off', splitStickyCollapsed);
        }

        function splitLayoutStickyChips(inner, fontSize) {
            const chips = inner.children;
            for (let i = 0; i < splitStickyLanes.length && i < chips.length; i++) {
                const lane = splitStickyLanes[i];
                const chip = chips[i];
                const offset = Math.round(splitComputeChipCenterOffset(lane.cx, splitStickySvgWidth, splitCurrentZoom, splitPanX));
                const leftGap = i > 0 ? lane.cx - splitStickyLanes[i - 1].cx : Infinity;
                const rightGap = i < splitStickyLanes.length - 1 ? splitStickyLanes[i + 1].cx - lane.cx : Infinity;
                chip.style.left = 'calc(50% + ' + offset + 'px)';
                chip.style.width = splitComputeLaneChipWidth(lane.width, splitCurrentZoom, Math.min(leftGap, rightGap)) + 'px';
                chip.style.fontSize = fontSize + 'px';
                chip.classList.toggle('active', !!splitSelectedName && splitIsSameDiagramName(lane.name, splitSelectedName));
            }
        }

        function splitSyncStickyBar() {
            const bar = document.getElementById('actor-sticky-bar');
            const inner = document.getElementById('actor-sticky-inner');
            const hasLanes = splitStickyLanes.length > 0 && splitStickySvgWidth > 0;
            splitUpdateStickyToggle(hasLanes);
            if (!bar || !inner) return;
            if (!hasLanes) {
                bar.hidden = true;
                return;
            }
            const main = document.getElementById('diagrams-view-main');
            const base = splitResolveBaseSize(splitCurrentIndex);
            if (!main || !base) {
                bar.hidden = true;
                return;
            }
            const barHeight = splitComputeStickyBarHeight(splitCurrentZoom);
            const show = !splitStickyCollapsed && splitShouldShowStickyHeader({
                panY: splitPanY,
                svgHeight: base.h * splitCurrentZoom,
                headerHeight: splitStickyHeaderH * splitCurrentZoom,
                mainHeight: main.clientHeight,
                barHeight: barHeight,
            });
            bar.hidden = !show;
            if (!show) return;
            bar.style.height = barHeight + 'px';
            splitLayoutStickyChips(inner, splitComputeChipFontSize(splitCurrentZoom));
        }

        function splitToggleStickyBar(e) {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            splitStickyCollapsed = !splitStickyCollapsed;
            splitSyncStickyBar();
        }

        function splitCenterStickyLane(i) {
            const lane = splitStickyLanes[i];
            if (!lane || !(splitStickySvgWidth > 0)) return;
            splitPanX = splitComputeCenterPanX(lane.cx, splitStickySvgWidth, splitCurrentZoom);
            const norm = splitNormalizeDiagramName(lane.name);
            if (norm) {
                splitSelectedName = lane.name;
                splitSelectedNormalized = norm;
            }
            splitSyncViewState();
            splitApplyZoom();
            splitApplyHighlight();
            splitSyncStickyBar();
        }

        function splitSetupStickyBar() {
            const bar = document.getElementById('actor-sticky-bar');
            if (!bar || bar.dataset.bound === '1') return;
            bar.dataset.bound = '1';
            bar.addEventListener('pointerdown', (e) => e.stopPropagation());
            bar.addEventListener('dblclick', (e) => e.stopPropagation());
        }

        async function splitSelectTab(index, silent) {
            if (index < 0 || index >= splitRawDiagrams.length) return;
            if (index !== splitCurrentIndex) {
                splitSaveViewState(splitCurrentIndex);
            }
            splitCurrentIndex = index;
            if (!silent) {
                try { vscode.postMessage({ command: 'tabChanged', index: index }); } catch (e) { /* ignore */ }
            }
            document.querySelectorAll('#diagrams-tab-bar .diagrams-tab').forEach((tab, idx) => {
                const isActive = idx === index;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
                if (isActive && tab.scrollIntoView) {
                    try { tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ }
                }
            });
            const viewport = document.getElementById('diagrams-viewport');
            if (viewport) {
                viewport.innerHTML = '<div class="mermaid-loading">Rendering diagram...</div>';
                const svg = await splitRenderDiagram(index);
                viewport.innerHTML = svg;
                splitCollapseEmptyClassBoxes(viewport);
                splitApplyHighlight();
                splitRebuildStickyBar();
            }
            if (splitHasViewState(index)) {
                splitRestoreViewState(index);
            } else {
                splitResolveBaseSize(index);
                splitCurrentZoom = splitComputeFitZoom(index);
                splitPanX = 0;
                splitPanY = 0;
                splitSyncViewState();
                splitApplyZoom();
            }
            const info = document.getElementById('split-footer-info');
            if (info) {
                info.textContent = 'Diagram ' + (index + 1) + ' of ' + splitRawDiagrams.length + ' — ' + splitRawDiagrams[index].title;
            }
            const prevBtn = document.getElementById('split-prev-btn');
            const nextBtn = document.getElementById('split-next-btn');
            if (prevBtn) prevBtn.disabled = splitRawDiagrams.length <= 1;
            if (nextBtn) nextBtn.disabled = splitRawDiagrams.length <= 1;
        }

        function splitZoomDiagram(factor) {
            splitSetZoom(splitCurrentZoom * factor);
        }

        function splitResetZoom() {
            splitCurrentZoom = splitComputeFitZoom(splitCurrentIndex);
            splitPanX = 0;
            splitPanY = 0;
            splitSyncViewState();
            splitApplyZoom();
        }

        function splitSetZoom(newZoom, cursorX, cursorY) {
            const clamped = Math.max(SPLIT_MIN_ZOOM, Math.min(SPLIT_MAX_ZOOM, newZoom));
            if (clamped === splitCurrentZoom) return;
            const main = document.getElementById('diagrams-view-main');
            if (main && typeof cursorX === 'number' && typeof cursorY === 'number') {
                const rect = main.getBoundingClientRect();
                const cx = cursorX - (rect.left + rect.width / 2);
                const cy = cursorY - (rect.top + rect.height / 2);
                const ratio = clamped / splitCurrentZoom;
                splitPanX = cx - (cx - splitPanX) * ratio;
                splitPanY = cy - (cy - splitPanY) * ratio;
            }
            splitCurrentZoom = clamped;
            splitSyncViewState();
            splitApplyZoom();
        }

        function splitApplyZoom() {
            const viewport = document.getElementById('diagrams-viewport');
            const zoomLevelEl = document.getElementById('diagrams-zoom-level');
            if (viewport) {
                const base = splitResolveBaseSize(splitCurrentIndex);
                const svg = viewport.querySelector('svg');
                if (svg && base) {
                    svg.style.width = (base.w * splitCurrentZoom) + 'px';
                    svg.style.height = (base.h * splitCurrentZoom) + 'px';
                    svg.style.maxWidth = 'none';
                    svg.style.maxHeight = 'none';
                }
                viewport.style.transform = 'translate(' + Math.round(splitPanX) + 'px, ' + Math.round(splitPanY) + 'px)';
            }
            if (zoomLevelEl) {
                zoomLevelEl.textContent = Math.round(splitCurrentZoom * 100) + '%';
            }
            splitSyncStickyBar();
        }

        function splitSetupPanZoom() {
            const main = document.getElementById('diagrams-view-main');
            if (!main || main.dataset.panZoomBound === '1') return;
            main.dataset.panZoomBound = '1';
            main.addEventListener('wheel', (e) => {
                e.preventDefault();
                const factor = Math.exp(-e.deltaY * 0.0015);
                splitSetZoom(splitCurrentZoom * factor, e.clientX, e.clientY);
            }, { passive: false });
            const pointers = new Map();
            let panStartX = 0;
            let panStartY = 0;
            let basePanX = 0;
            let basePanY = 0;
            let pinchStartDist = 0;
            let pinchStartZoom = 1.0;
            main.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                try { main.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
                pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pointers.size === 1) {
                    panStartX = e.clientX;
                    panStartY = e.clientY;
                    basePanX = splitPanX;
                    basePanY = splitPanY;
                    main.classList.add('dragging');
                } else if (pointers.size === 2) {
                    const pts = Array.from(pointers.values());
                    pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                    pinchStartZoom = splitCurrentZoom;
                }
            });
            main.addEventListener('pointermove', (e) => {
                if (!pointers.has(e.pointerId)) return;
                pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pointers.size === 2) {
                    const pts = Array.from(pointers.values());
                    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                    if (pinchStartDist > 0) {
                        const cx = (pts[0].x + pts[1].x) / 2;
                        const cy = (pts[0].y + pts[1].y) / 2;
                        const target = pinchStartZoom * (dist / pinchStartDist);
                        const clamped = Math.max(SPLIT_MIN_ZOOM, Math.min(SPLIT_MAX_ZOOM, target));
                        if (clamped !== splitCurrentZoom) {
                            const rect = main.getBoundingClientRect();
                            const ccx = cx - (rect.left + rect.width / 2);
                            const ccy = cy - (rect.top + rect.height / 2);
                            const ratio = clamped / splitCurrentZoom;
                            splitPanX = ccx - (ccx - splitPanX) * ratio;
                            splitPanY = ccy - (ccy - splitPanY) * ratio;
                            splitCurrentZoom = clamped;
                            splitSyncViewState();
                            splitApplyZoom();
                        }
                    }
                    return;
                }
                if (pointers.size === 1 && main.classList.contains('dragging')) {
                    splitPanX = basePanX + (e.clientX - panStartX);
                    splitPanY = basePanY + (e.clientY - panStartY);
                    splitSyncViewState();
                    splitApplyZoom();
                }
            });
            const endPointer = (e) => {
                pointers.delete(e.pointerId);
                if (pointers.size === 0) {
                    main.classList.remove('dragging');
                } else if (pointers.size === 1) {
                    const pt = Array.from(pointers.values())[0];
                    panStartX = pt.x;
                    panStartY = pt.y;
                    basePanX = splitPanX;
                    basePanY = splitPanY;
                }
            };
            main.addEventListener('pointerup', endPointer);
            main.addEventListener('pointercancel', endPointer);
            main.addEventListener('dblclick', () => splitResetZoom());
        }

        function splitNavigate(dir) {
            if (splitRawDiagrams.length === 0) return;
            let nextIndex = splitCurrentIndex;
            if (dir === 'next') {
                nextIndex = (splitCurrentIndex + 1) % splitRawDiagrams.length;
            } else {
                nextIndex = (splitCurrentIndex - 1 + splitRawDiagrams.length) % splitRawDiagrams.length;
            }
            splitSelectTab(nextIndex);
        }

        function splitJumpToEditorLine() {
            const item = splitRawDiagrams[splitCurrentIndex];
            if (!item || !item.line) return;
            try { vscode.postMessage({ command: 'scrollToLine', line: item.line }); } catch (e) { /* ignore */ }
        }

        function splitChangeClassDetail(value) {
            if (value !== 'minimal' && value !== 'compact' && value !== 'full') return;
            try { vscode.postMessage({ command: 'setClassDetail', value: value }); } catch (e) { /* ignore */ }
        }

        function splitShowCopyToast(msg) {
            const old = document.getElementById('split-copy-toast');
            if (old) old.remove();
            const toast = document.createElement('div');
            toast.id = 'split-copy-toast';
            toast.textContent = msg;
            toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#238636;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }

        async function splitCopySvg() {
            const svg = splitRenderedSvgs[splitCurrentIndex];
            if (!svg) {
                splitShowCopyToast('No SVG available');
                return;
            }
            try {
                await navigator.clipboard.writeText(svg);
                splitShowCopyToast('SVG copied to clipboard ✓');
            } catch (err) {
                console.error('Failed to copy SVG:', err);
            }
        }

        function splitIsFormField(el) {
            return !!el && !!(el.closest && el.closest('input, textarea, select, [contenteditable="true"]'));
        }

        function splitFocusInDiagramsPane() {
            const pane = document.getElementById('diagrams-pane');
            const active = document.activeElement;
            return !!(pane && active && pane.contains(active));
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                splitClearSelection();
                return;
            }
            if (splitIsFormField(e.target)) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                if (!splitFocusInDiagramsPane()) return;
                e.preventDefault();
                splitNavigate(e.key === 'ArrowRight' ? 'next' : 'prev');
            }
        });

        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg && msg.command === 'showDiagram' && typeof msg.index === 'number') {
                const pane = document.getElementById('diagrams-pane');
                if (pane) pane.classList.remove('collapsed');
                splitSelectTab(msg.index);
            }
            if (msg && msg.command === 'toggleDiagramsPane') {
                const pane = document.getElementById('diagrams-pane');
                if (pane) pane.classList.toggle('collapsed', msg.visible === false);
            }
        });

        splitSetupPanZoom();
        splitSetupHighlight();
        splitSetupStickyBar();
        window.splitSelectTab = splitSelectTab;
        window.splitNavigate = splitNavigate;
        window.addEventListener('resize', () => splitSyncStickyBar());
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            splitInitDiagrams();
        } else {
            document.addEventListener('DOMContentLoaded', splitInitDiagrams);
            window.addEventListener('load', splitInitDiagrams);
        }
    </script>`;
}
