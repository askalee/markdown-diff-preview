import * as vscode from 'vscode';
import * as path from 'path';
import { extractMermaidTitle } from './core/markdownRenderer';
import { ClassDiagramDetail, filterClassDiagram } from './core/classDiagramDetail';

interface ParsedDiagram {
    index: number;
    title: string;
    line: number;
    code: string;
}

export class MarkdownDiagramsPanel {
    public static currentPanel: MarkdownDiagramsPanel | undefined;
    private static readonly viewType = 'markdownDiagramsView';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _document: vscode.TextDocument;
    private _disposables: vscode.Disposable[] = [];
    private _currentIndex: number = 0;

    public static createOrShow(extensionUri: vscode.Uri, document: vscode.TextDocument, initialIndex: number = 0) {
        const column = vscode.ViewColumn.Beside;

        if (MarkdownDiagramsPanel.currentPanel) {
            MarkdownDiagramsPanel.currentPanel._panel.reveal(column);
            MarkdownDiagramsPanel.currentPanel._document = document;
            MarkdownDiagramsPanel.currentPanel._currentIndex = initialIndex;
            MarkdownDiagramsPanel.currentPanel._update();
            return;
        }

        const fileName = path.basename(document.fileName);
        const panel = vscode.window.createWebviewPanel(
            MarkdownDiagramsPanel.viewType,
            `📊 Diagrams: ${fileName}`,
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        MarkdownDiagramsPanel.currentPanel = new MarkdownDiagramsPanel(panel, extensionUri, document, initialIndex);
    }

    public static updateIfVisible(document: vscode.TextDocument) {
        if (MarkdownDiagramsPanel.currentPanel && MarkdownDiagramsPanel.currentPanel._document.uri.toString() === document.uri.toString()) {
            MarkdownDiagramsPanel.currentPanel._document = document;
            MarkdownDiagramsPanel.currentPanel._update();
        }
    }

    public static refresh() {
        MarkdownDiagramsPanel.currentPanel?._update();
    }

    public static getConfiguredDetail(): ClassDiagramDetail {
        const value = vscode.workspace.getConfiguration('markdownDiffPreview').get<string>('classDiagramDetail');
        return value === 'minimal' || value === 'compact' ? value : 'full';
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, document: vscode.TextDocument, initialIndex: number) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._document = document;
        this._currentIndex = initialIndex;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'scrollToLine':
                        await this._scrollEditorToLine(message.line);
                        break;
                    case 'tabChanged':
                        this._currentIndex = message.index;
                        break;
                    case 'setClassDetail':
                        if (message.value === 'minimal' || message.value === 'compact' || message.value === 'full') {
                            await vscode.workspace.getConfiguration('markdownDiffPreview').update('classDiagramDetail', message.value, true);
                            this._update();
                        }
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async _scrollEditorToLine(line: number) {
        if (!this._document || line <= 0) return;

        let targetEditor = vscode.window.visibleTextEditors.find(
            editor => editor.document.uri.toString() === this._document.uri.toString()
        );

        if (!targetEditor) {
            const doc = await vscode.workspace.openTextDocument(this._document.uri);
            targetEditor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
        } else {
            await vscode.window.showTextDocument(targetEditor.document, targetEditor.viewColumn, false);
        }

        if (targetEditor) {
            const lineIndex = Math.min(Math.max(0, line - 1), targetEditor.document.lineCount - 1);
            const lineText = targetEditor.document.lineAt(lineIndex);
            const lineStart = new vscode.Position(lineIndex, 0);
            const lineEnd = new vscode.Position(lineIndex, lineText.text.length);

            targetEditor.selection = new vscode.Selection(lineStart, lineEnd);
            targetEditor.revealRange(
                new vscode.Range(lineStart, lineEnd),
                vscode.TextEditorRevealType.InCenter
            );
        }
    }

    private _extractDiagrams(text: string): ParsedDiagram[] {
        const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = cleanText.split('\n');
        const diagrams: ParsedDiagram[] = [];
        let inBlock = false;
        let blockContent: string[] = [];
        let startLine = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
                const lang = trimmed.slice(3).trim().toLowerCase();
                if (!inBlock) {
                    if (lang === 'mermaid' || lang.startsWith('mermaid')) {
                        inBlock = true;
                        blockContent = [];
                        startLine = i + 1;
                    }
                } else {
                    const code = blockContent.join('\n').trim();
                    if (code.length > 0) {
                        const index = diagrams.length;
                        const title = extractMermaidTitle(code, index);
                        diagrams.push({
                            index,
                            title,
                            line: startLine,
                            code
                        });
                    }
                    inBlock = false;
                    blockContent = [];
                }
            } else if (inBlock) {
                blockContent.push(line);
            }
        }

        return diagrams;
    }

    private _update() {
        if (!this._document) return;
        const fileName = path.basename(this._document.fileName);
        this._panel.title = `📊 Diagrams: ${fileName}`;
        const detail = MarkdownDiagramsPanel.getConfiguredDetail();
        const diagrams = this._extractDiagrams(this._document.getText()).map(d => ({
            ...d,
            code: filterClassDiagram(d.code, detail)
        }));
        this._panel.webview.html = this._getHtmlForWebview(diagrams, fileName, detail);
    }

    private _getHtmlForWebview(diagrams: ParsedDiagram[], fileName: string, detailLevel: ClassDiagramDetail): string {
        const stylesUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css')
        );
        const mermaidUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'mermaid.min.js')
        );

        const safeDiagramsJson = JSON.stringify(diagrams).replace(/</g, '\\u003c');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval' ${this._panel.webview.cspSource}; font-src ${this._panel.webview.cspSource} data:; img-src ${this._panel.webview.cspSource} https: data: blob:; connect-src ${this._panel.webview.cspSource} https:;">
    <title>Diagrams - ${fileName}</title>
    <link rel="stylesheet" href="${stylesUri}">
    <script src="${mermaidUri}"></script>
</head>
<body class="diagrams-view-body">
    <div class="diagrams-view-container">
        <!-- Top Tab Bar & Action Controls -->
        <div class="diagrams-view-header">
            <div class="diagrams-tab-bar" id="diagrams-tab-bar" role="tablist">
                <!-- Dynamically populated tabs -->
            </div>
            <div class="diagrams-view-actions">
                <select class="diagrams-ctrl-btn" id="class-detail-select" onchange="changeClassDetail(this.value)" title="Class diagram detail (applies to class diagrams only)" aria-label="Class diagram detail">
                    <option value="minimal"${detailLevel === 'minimal' ? ' selected' : ''}>Class: minimal</option>
                    <option value="compact"${detailLevel === 'compact' ? ' selected' : ''}>Class: compact</option>
                    <option value="full"${detailLevel === 'full' ? ' selected' : ''}>Class: full</option>
                </select>
                <button class="diagrams-ctrl-btn" onclick="zoomDiagram(1/1.2)" title="Zoom Out (÷1.2)" aria-label="Zoom Out">
                    <span class="ctrl-icon">−</span>
                </button>
                <button class="diagrams-ctrl-btn" id="diagrams-zoom-level" onclick="resetZoom()" title="Reset Zoom (fit to view)" aria-label="Reset Zoom">
                    100%
                </button>
                <button class="diagrams-ctrl-btn" onclick="zoomDiagram(1.2)" title="Zoom In (×1.2)" aria-label="Zoom In">
                    <span class="ctrl-icon">+</span>
                </button>
                <button class="diagrams-ctrl-btn" onclick="copySvg()" title="Copy Diagram SVG to Clipboard" aria-label="Copy SVG">
                    Copy SVG
                </button>
                <button class="diagrams-ctrl-btn" onclick="jumpToEditorLine()" title="Jump to Line in Markdown Editor" aria-label="Jump to line">
                    ⎘ Jump to line
                </button>
            </div>
        </div>

        <!-- Main Diagram Display Stage -->
        <div class="diagrams-view-main" id="diagrams-view-main">
            <div class="diagrams-stage" id="diagrams-stage">
                <div class="diagrams-viewport" id="diagrams-viewport">
                    <div class="mermaid-loading">Rendering diagram...</div>
                </div>
            </div>
        </div>

        <!-- Footer Bar with Navigation -->
        <div class="diagrams-view-footer">
            <button class="diagrams-nav-btn" id="prev-btn" onclick="navigate('prev')" title="Previous Diagram (Left Arrow)">
                ← Previous
            </button>
            <span class="diagrams-footer-info" id="footer-info">Diagram 1 of 1</span>
            <button class="diagrams-nav-btn" id="next-btn" onclick="navigate('next')" title="Next Diagram (Right Arrow)">
                Next →
            </button>
        </div>
    </div>

    <script type="application/json" id="diagrams-data">${safeDiagramsJson}</script>

    <script>
        const vscode = acquireVsCodeApi();
        let rawDiagrams = [];
        try {
            const rawEl = document.getElementById('diagrams-data');
            rawDiagrams = rawEl ? JSON.parse(rawEl.textContent || '[]') : [];
        } catch (e) {
            console.error('Failed to parse diagrams data:', e);
        }

        let currentIndex = ${this._currentIndex};
        let currentZoom = 1.0;
        let panX = 0;
        let panY = 0;
        const MIN_ZOOM = 0.2;
        const MAX_ZOOM = 50.0;
        const classDetail = '${detailLevel}';
        const renderedSvgs = {};
        const viewStates = {};

        function getViewState(index) {
            if (!viewStates[index]) {
                viewStates[index] = { zoom: 1.0, panX: 0, panY: 0 };
            }
            return viewStates[index];
        }

        function saveViewState(index) {
            if (index === null || index === undefined || index < 0) return;
            viewStates[index] = { zoom: currentZoom, panX: panX, panY: panY };
        }

        function restoreViewState(index) {
            const s = getViewState(index);
            currentZoom = s.zoom;
            panX = s.panX;
            panY = s.panY;
            applyZoom();
        }

        function syncViewState() {
            if (currentIndex !== null && currentIndex !== undefined && currentIndex >= 0) {
                viewStates[currentIndex] = { zoom: currentZoom, panX: panX, panY: panY };
            }
        }

        function hasViewState(index) {
            return Object.prototype.hasOwnProperty.call(viewStates, index);
        }

        const baseSizes = {};

        function measureIntrinsicSize() {
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
            // Unconstrained probe: measure a clone outside .diagrams-viewport
            // so max-width/max-height rules don't shrink the measurement.
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

        function resolveBaseSize(index) {
            if (baseSizes[index]) return baseSizes[index];
            const s = measureIntrinsicSize();
            if (s) baseSizes[index] = s;
            return s;
        }

        function computeFitZoom(index) {
            const main = document.getElementById('diagrams-view-main');
            const size = resolveBaseSize(index !== undefined ? index : currentIndex);
            if (!main || !size) return 1.0;
            const availW = main.clientWidth - 48;
            const availH = main.clientHeight - 48;
            if (availW <= 0 || availH <= 0) return 1.0;
            const fit = Math.min(availW / size.w, availH / size.h) * 0.95;
            return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit));
        }

        function getTheme() {
            if (document.body.classList.contains('vscode-light') || document.body.classList.contains('theme-light')) {
                return 'default';
            }
            if (document.body.classList.contains('vscode-high-contrast')) {
                return 'forest';
            }
            return 'dark';
        }

        async function waitForMermaid(maxWaitMs = 3000) {
            const start = Date.now();
            while (!window.mermaid && (Date.now() - start) < maxWaitMs) {
                await new Promise(r => setTimeout(r, 50));
            }
            return window.mermaid;
        }

        async function initMermaid() {
            console.log('[DiagramsPanel] Initializing Mermaid, diagrams count:', rawDiagrams.length);
            const m = await waitForMermaid();
            if (m) {
                try {
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: getTheme(),
                        securityLevel: 'loose',
                        class: { hideEmptyMembersBox: classDetail !== 'full' },
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    });
                } catch (e) {
                    console.error('Failed to initialize mermaid:', e);
                }
            } else {
                console.error('[DiagramsPanel] Mermaid library was not found on window');
            }

            renderTabs();
            if (rawDiagrams.length > 0) {
                await selectTab(currentIndex >= 0 && currentIndex < rawDiagrams.length ? currentIndex : 0);
            } else {
                const viewport = document.getElementById('diagrams-viewport');
                if (viewport) {
                    viewport.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>No Mermaid diagrams found in this Markdown document</p></div>';
                }
                const info = document.getElementById('footer-info');
                if (info) info.textContent = '0 diagrams';
            }
        }

        function renderTabs() {
            const tabBar = document.getElementById('diagrams-tab-bar');
            if (!tabBar) return;
            tabBar.innerHTML = '';

            rawDiagrams.forEach((d, idx) => {
                const tab = document.createElement('button');
                tab.className = 'diagrams-tab' + (idx === currentIndex ? ' active' : '');
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-selected', idx === currentIndex ? 'true' : 'false');
                tab.dataset.tabIndex = String(idx);
                tab.title = d.title + ' (Line ' + d.line + ')';
                tab.innerHTML = '<span class="tab-number">' + (idx + 1) + '.</span> <span class="tab-title">' + d.title + '</span>';
                tab.onclick = () => selectTab(idx);
                tabBar.appendChild(tab);
            });
        }

        async function renderDiagram(index) {
            if (renderedSvgs[index]) {
                return renderedSvgs[index];
            }
            const item = rawDiagrams[index];
            if (!item) return '';

            const m = await waitForMermaid();
            if (!m) {
                return '<div class="mermaid-error">' +
                    '<div class="mermaid-error-title">⚠️ Mermaid Library Not Loaded</div>' +
                    '<div class="mermaid-error-msg">Failed to load Mermaid.js in this webview. Check webview developer tools for CSP errors.</div>' +
                '</div>';
            }

            try {
                const renderId = 'diagram-panel-svg-' + index + '-' + Date.now();
                const res = await mermaid.render(renderId, item.code);
                renderedSvgs[index] = res.svg;
                return res.svg;
            } catch (err) {
                console.error('Mermaid render error for index ' + index + ':', err);
                const errMsg = err.message || String(err);
                return '<div class="mermaid-error">' +
                    '<div class="mermaid-error-title">⚠️ Mermaid Syntax Error</div>' +
                    '<div class="mermaid-error-msg">' + errMsg + '</div>' +
                '</div>';
            }
        }

        // Hide dividers of empty class compartments (minimal/compact only).
        // Mermaid always draws both divider lines when a class has any
        // member, so a compact class (attributes only) would still show a
        // trailing empty methods strip. hideEmptyMembersBox covers the
        // fully-empty case; this covers the partially-empty one.
        function collapseEmptyClassBoxes(viewport) {
            if (classDetail === 'full' || !viewport) return;
            viewport.querySelectorAll('g.node').forEach((node) => {
                const members = node.querySelector('.members-group');
                const methods = node.querySelector('.methods-group');
                if (!members && !methods) return; // not a class node
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

        async function selectTab(index) {
            if (index < 0 || index >= rawDiagrams.length) return;
            if (index !== currentIndex) {
                saveViewState(currentIndex);
            }
            currentIndex = index;
            vscode.postMessage({ command: 'tabChanged', index: index });

            // Update Tab states
            document.querySelectorAll('.diagrams-tab').forEach((tab, idx) => {
                const isActive = idx === index;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
                if (isActive) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            });

            // Update Viewport
            const viewport = document.getElementById('diagrams-viewport');
            if (viewport) {
                viewport.innerHTML = '<div class="mermaid-loading">Rendering diagram...</div>';
                const svg = await renderDiagram(index);
                viewport.innerHTML = svg;
                collapseEmptyClassBoxes(viewport);
            }

            if (hasViewState(index)) {
                restoreViewState(index);
            } else {
                // First visit: pre-zoom to near full-viewport
                resolveBaseSize(index);
                currentZoom = computeFitZoom(index);
                panX = 0;
                panY = 0;
                syncViewState();
                applyZoom();
            }

            // Update footer
            const info = document.getElementById('footer-info');
            if (info) {
                info.textContent = 'Diagram ' + (index + 1) + ' of ' + rawDiagrams.length + ' — ' + rawDiagrams[index].title;
            }

            const prevBtn = document.getElementById('prev-btn');
            const nextBtn = document.getElementById('next-btn');
            if (prevBtn) prevBtn.disabled = rawDiagrams.length <= 1;
            if (nextBtn) nextBtn.disabled = rawDiagrams.length <= 1;
        }

        function zoomDiagram(factor) {
            setZoom(currentZoom * factor);
        }

        function resetZoom() {
            currentZoom = computeFitZoom(currentIndex);
            panX = 0;
            panY = 0;
            syncViewState();
            applyZoom();
        }

        function setZoom(newZoom, cursorX, cursorY) {
            const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
            if (clamped === currentZoom) return;
            const main = document.getElementById('diagrams-view-main');
            if (main && typeof cursorX === 'number' && typeof cursorY === 'number') {
                const rect = main.getBoundingClientRect();
                const cx = cursorX - (rect.left + rect.width / 2);
                const cy = cursorY - (rect.top + rect.height / 2);
                const ratio = clamped / currentZoom;
                panX = cx - (cx - panX) * ratio;
                panY = cy - (cy - panY) * ratio;
            }
            currentZoom = clamped;
            syncViewState();
            applyZoom();
        }

        function applyZoom() {
            const viewport = document.getElementById('diagrams-viewport');
            const zoomLevelEl = document.getElementById('diagrams-zoom-level');
            if (viewport) {
                // Crisp zoom: resize the SVG layout box so the browser
                // re-renders vectors at final size (transform scale would
                // upscale a rasterized layer and blur text).
                const base = resolveBaseSize(currentIndex);
                const svg = viewport.querySelector('svg');
                if (svg && base) {
                    svg.style.width = (base.w * currentZoom) + 'px';
                    svg.style.height = (base.h * currentZoom) + 'px';
                    svg.style.maxWidth = 'none';
                    svg.style.maxHeight = 'none';
                }
                viewport.style.transform = 'translate(' + Math.round(panX) + 'px, ' + Math.round(panY) + 'px)';
            }
            if (zoomLevelEl) {
                zoomLevelEl.textContent = Math.round(currentZoom * 100) + '%';
            }
        }

        function setupPanZoom() {
            const main = document.getElementById('diagrams-view-main');
            if (!main || main.dataset.panZoomBound === '1') return;
            main.dataset.panZoomBound = '1';

            // Direct wheel-to-zoom (no Ctrl required)
            main.addEventListener('wheel', (e) => {
                e.preventDefault();
                const factor = Math.exp(-e.deltaY * 0.0015);
                setZoom(currentZoom * factor, e.clientX, e.clientY);
            }, { passive: false });

            // Click-anywhere drag to pan (mouse + single-finger touch)
            const pointers = new Map();
            let panStartX = 0;
            let panStartY = 0;
            let basePanX = 0;
            let basePanY = 0;
            let pinchStartDist = 0;
            let pinchStartZoom = 1.0;

            main.addEventListener('pointerdown', (e) => {
                // Only left button / touch / pen
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                main.setPointerCapture(e.pointerId);
                pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pointers.size === 1) {
                    panStartX = e.clientX;
                    panStartY = e.clientY;
                    basePanX = panX;
                    basePanY = panY;
                    main.classList.add('dragging');
                } else if (pointers.size === 2) {
                    const pts = Array.from(pointers.values());
                    pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                    pinchStartZoom = currentZoom;
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
                        // Temporarily restore base zoom math: zoom relative to pinch start
                        const target = pinchStartZoom * (dist / pinchStartDist);
                        const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, target));
                        if (clamped !== currentZoom) {
                            const rect = main.getBoundingClientRect();
                            const ccx = cx - (rect.left + rect.width / 2);
                            const ccy = cy - (rect.top + rect.height / 2);
                            const ratio = clamped / currentZoom;
                            panX = ccx - (ccx - panX) * ratio;
                            panY = ccy - (ccy - panY) * ratio;
                            currentZoom = clamped;
                            syncViewState();
                            applyZoom();
                        }
                    }
                    return;
                }
                if (pointers.size === 1 && main.classList.contains('dragging')) {
                    panX = basePanX + (e.clientX - panStartX);
                    panY = basePanY + (e.clientY - panStartY);
                    syncViewState();
                    applyZoom();
                }
            });

            const endPointer = (e) => {
                pointers.delete(e.pointerId);
                if (pointers.size === 0) {
                    main.classList.remove('dragging');
                } else if (pointers.size === 1) {
                    // Remaining finger becomes new pan anchor
                    const pt = Array.from(pointers.values())[0];
                    panStartX = pt.x;
                    panStartY = pt.y;
                    basePanX = panX;
                    basePanY = panY;
                }
            };
            main.addEventListener('pointerup', endPointer);
            main.addEventListener('pointercancel', endPointer);

            // Double-click resets zoom + pan
            main.addEventListener('dblclick', () => resetZoom());
        }

        function navigate(dir) {
            if (rawDiagrams.length === 0) return;
            let nextIndex = currentIndex;
            if (dir === 'next') {
                nextIndex = (currentIndex + 1) % rawDiagrams.length;
            } else {
                nextIndex = (currentIndex - 1 + rawDiagrams.length) % rawDiagrams.length;
            }
            selectTab(nextIndex);
        }

        function jumpToEditorLine() {
            const item = rawDiagrams[currentIndex];
            if (!item || !item.line) return;
            vscode.postMessage({ command: 'scrollToLine', line: item.line });
        }

        function changeClassDetail(value) {
            if (value !== 'minimal' && value !== 'compact' && value !== 'full') return;
            vscode.postMessage({ command: 'setClassDetail', value: value });
        }

        function showCopyToast(msg) {
            const old = document.getElementById('copy-toast');
            if (old) old.remove();
            const toast = document.createElement('div');
            toast.id = 'copy-toast';
            toast.textContent = msg;
            toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#238636;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }

        async function copySvg() {
            const svg = renderedSvgs[currentIndex];
            if (!svg) {
                showCopyToast('No SVG available');
                return;
            }
            try {
                await navigator.clipboard.writeText(svg);
                showCopyToast('SVG copied to clipboard ✓');
            } catch (err) {
                console.error('Failed to copy SVG:', err);
            }
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigate('prev');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigate('next');
            }
        });

        // Robust triggering for Webview lifecycle
        setupPanZoom();
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initMermaid();
        } else {
            document.addEventListener('DOMContentLoaded', initMermaid);
            window.addEventListener('load', initMermaid);
        }
    </script>
</body>
</html>`;
    }

    public dispose() {
        MarkdownDiagramsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }
}
