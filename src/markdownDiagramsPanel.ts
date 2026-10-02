import * as vscode from 'vscode';
import * as path from 'path';
import { extractMermaidTitle } from './core/markdownRenderer';

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
        const diagrams = this._extractDiagrams(this._document.getText());
        this._panel.webview.html = this._getHtmlForWebview(diagrams, fileName);
    }

    private _getHtmlForWebview(diagrams: ParsedDiagram[], fileName: string): string {
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
                <button class="diagrams-ctrl-btn" onclick="zoomDiagram(-0.15)" title="Zoom Out (−)" aria-label="Zoom Out">
                    <span class="ctrl-icon">−</span>
                </button>
                <button class="diagrams-ctrl-btn" id="diagrams-zoom-level" onclick="resetZoom()" title="Reset Zoom (100%)" aria-label="Reset Zoom">
                    100%
                </button>
                <button class="diagrams-ctrl-btn" onclick="zoomDiagram(0.15)" title="Zoom In (+)" aria-label="Zoom In">
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
        const renderedSvgs = {};

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

        async function selectTab(index) {
            if (index < 0 || index >= rawDiagrams.length) return;
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
            }

            resetZoom();

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

        function zoomDiagram(delta) {
            currentZoom = Math.max(0.2, Math.min(3.5, currentZoom + delta));
            applyZoom();
        }

        function resetZoom() {
            currentZoom = 1.0;
            applyZoom();
        }

        function applyZoom() {
            const viewport = document.getElementById('diagrams-viewport');
            const zoomLevelEl = document.getElementById('diagrams-zoom-level');
            if (viewport) {
                viewport.style.transform = 'scale(' + currentZoom + ')';
            }
            if (zoomLevelEl) {
                zoomLevelEl.textContent = Math.round(currentZoom * 100) + '%';
            }
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
