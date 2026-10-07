/**
 * Script to generate a demo HTML file from a git diff file.
 * This uses the actual rendering code from the extension (via core modules).
 * 
 * Usage: npx ts-node scripts/generate-demo.ts [diff-file] [output-file]
 * Default: npx ts-node scripts/generate-demo.ts demo/test.txt demo/preview.html
 */

import * as fs from 'fs';
import * as path from 'path';

// Import from core modules - same code used by the extension
import { parseDiff, extractNewFileContent } from '../src/core/diffParser';
import { renderMarkdownWithDiff } from '../src/core/markdownRenderer';

function generateHtml(content: string, fileName: string, addedCount: number, removedCount: number): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Diff Preview - ${fileName}</title>
    <link rel="stylesheet" href="../media/styles.css">
    <link rel="stylesheet" href="../media/katex.min.css">
    <script src="../media/mermaid.min.js"></script>
</head>
<body>
    <button class="theme-toggle" onclick="toggleTheme()">Toggle Theme</button>

    <div class="header">
        <div class="header-left">
            <span class="file-name">${fileName}</span>
            <div class="git-info">
                <span class="branch-badge">main</span>
                <span class="status-badge modified">modified</span>
            </div>
        </div>
        <div class="diff-stats">
            ${addedCount > 0 ? `<span class="stat additions">+${addedCount} added</span>` : ''}
            ${removedCount > 0 ? `<span class="stat deletions">−${removedCount} removed</span>` : ''}
            <span class="diff-base">vs HEAD</span>
            <div class="diff-nav" id="diff-nav">
                <button class="diff-nav-btn" id="diff-prev-btn" onclick="navigateDiff('prev')" title="Previous Diff (Alt+Up, P, [)" aria-label="Previous diff">
                    <span class="nav-arrow">▲</span> Prev
                </button>
                <span class="diff-nav-counter" id="diff-counter">- / -</span>
                <button class="diff-nav-btn" id="diff-next-btn" onclick="navigateDiff('next')" title="Next Diff (Alt+Down, N, ])" aria-label="Next diff">
                    Next <span class="nav-arrow">▼</span>
                </button>
            </div>
            <button class="diagrams-view-btn" id="diagrams-header-btn" onclick="openDiagramsModal(0)" title="View all diagrams in tabs" style="display:none;">
                📊 Diagrams (<span id="diagrams-header-count">0</span>)
            </button>
            <button class="refresh-btn" onclick="location.reload()">↻ Refresh</button>
        </div>
    </div>

    <div class="content">
        ${content}
    </div>

    <!-- Diagrams Tabbed View Modal -->
    <div id="diagrams-modal" class="diagrams-modal" style="display: none;" role="dialog" aria-modal="true" aria-label="Mermaid Diagrams View">
        <div class="diagrams-modal-backdrop" onclick="closeDiagramsModal()"></div>
        <div class="diagrams-modal-window">
            <div class="diagrams-modal-header">
                <div class="diagrams-tab-bar" id="diagrams-tab-bar" role="tablist">
                    <!-- Dynamic tabs will be inserted here -->
                </div>
                <div class="diagrams-modal-actions">
                    <button class="diagrams-ctrl-btn" onclick="zoomCurrentDiagram(-0.15)" title="Zoom Out (−)" aria-label="Zoom Out">
                        <span class="ctrl-icon">−</span>
                    </button>
                    <button class="diagrams-ctrl-btn" id="diagrams-zoom-level" onclick="resetCurrentDiagramZoom()" title="Reset Zoom (100%)" aria-label="Reset Zoom">
                        100%
                    </button>
                    <button class="diagrams-ctrl-btn" onclick="zoomCurrentDiagram(0.15)" title="Zoom In (+)" aria-label="Zoom In">
                        <span class="ctrl-icon">+</span>
                    </button>
                    <button class="diagrams-ctrl-btn" onclick="copyCurrentDiagramSvg()" title="Copy Diagram SVG to Clipboard" aria-label="Copy SVG">
                        Copy SVG
                    </button>
                    <button class="diagrams-ctrl-btn" onclick="jumpToCurrentDiagramLine()" title="Jump to Diagram in Editor" aria-label="Jump to line">
                        ⎘ Jump to line
                    </button>
                    <button class="diagrams-close-btn" onclick="closeDiagramsModal()" title="Close (Esc)" aria-label="Close">
                        ✕
                    </button>
                </div>
            </div>
            <div class="diagrams-modal-body" id="diagrams-modal-body">
                <div class="diagrams-stage" id="diagrams-stage">
                    <div class="diagrams-viewport" id="diagrams-viewport">
                        <!-- Current diagram SVG displayed here -->
                    </div>
                </div>
            </div>
            <div class="diagrams-modal-footer">
                <button class="diagrams-nav-btn" id="diagrams-prev-btn" onclick="navigateDiagram('prev')" title="Previous Diagram (Left Arrow)">
                    ← Previous
                </button>
                <span class="diagrams-footer-info" id="diagrams-footer-info">Diagram 1 of 1</span>
                <button class="diagrams-nav-btn" id="diagrams-next-btn" onclick="navigateDiagram('next')" title="Next Diagram (Right Arrow)">
                    Next →
                </button>
            </div>
        </div>
    </div>

    <script>
        function toggleTheme() {
            document.body.classList.toggle('theme-light');
            if (window.mermaid) {
                initMermaid();
            }
        }

        // ==========================================
        // Mermaid Rendering & Tabbed View System
        // ==========================================
        let diagramsList = [];
        let currentDiagramIndex = 0;
        let currentDiagramZoom = 1.0;
        let isDiagramsModalOpen = false;

        function toggleMermaidSource(btn) {
            const container = btn.closest('.mermaid-container');
            if (!container) return;
            const diagramWrap = container.querySelector('.mermaid-diagram-wrap');
            const sourceWrap = container.querySelector('.mermaid-source-wrapper');
            if (!diagramWrap || !sourceWrap) return;

            const isSourceVisible = sourceWrap.style.display !== 'none';
            if (isSourceVisible) {
                sourceWrap.style.display = 'none';
                diagramWrap.style.display = '';
                btn.classList.remove('active');
            } else {
                sourceWrap.style.display = '';
                diagramWrap.style.display = 'none';
                btn.classList.add('active');
            }
        }

        async function initMermaid() {
            const containers = Array.from(document.querySelectorAll('.mermaid-container'));
            if (containers.length === 0) {
                const headerBtn = document.getElementById('diagrams-header-btn');
                if (headerBtn) headerBtn.style.display = 'none';
                return;
            }

            let mermaidTheme = 'dark';
            if (document.body.classList.contains('theme-light')) {
                mermaidTheme = 'default';
            }

            if (window.mermaid) {
                try {
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: mermaidTheme,
                        securityLevel: 'loose',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    });
                } catch (e) {
                    console.error('Failed to initialize mermaid:', e);
                }
            }

            diagramsList = [];

            for (let i = 0; i < containers.length; i++) {
                const container = containers[i];
                const index = parseInt(container.dataset.diagramIndex || String(i), 10);
                const title = container.dataset.diagramTitle || ('Diagram ' + (index + 1));
                const line = parseInt(container.dataset.line || '0', 10);
                const rawEl = container.querySelector('.mermaid-raw');
                const renderedEl = container.querySelector('.mermaid-rendered');
                const rawCode = rawEl ? (rawEl.textContent || '').trim() : '';

                let svgHtml = '';
                if (window.mermaid && rawCode) {
                    try {
                        const renderId = 'mermaid-demo-svg-' + index + '-' + Math.floor(Math.random() * 10000);
                        const renderRes = await mermaid.render(renderId, rawCode);
                        svgHtml = renderRes.svg;
                        if (renderedEl) {
                            renderedEl.innerHTML = svgHtml;
                        }
                    } catch (err) {
                        console.error('Mermaid render error for diagram ' + index + ':', err);
                        if (renderedEl) {
                            renderedEl.innerHTML = '<div class="mermaid-error">' +
                                '<div class="mermaid-error-title">⚠️ Mermaid Syntax Error</div>' +
                                '<div class="mermaid-error-msg">' + (err.message || String(err)) + '</div>' +
                            '</div>';
                        }
                    }
                }

                diagramsList.push({
                    index: index,
                    title: title,
                    line: line,
                    rawCode: rawCode,
                    svgHtml: svgHtml,
                    container: container
                });
            }

            const headerBtn = document.getElementById('diagrams-header-btn');
            const headerCount = document.getElementById('diagrams-header-count');
            if (headerBtn && headerCount) {
                headerCount.textContent = String(diagramsList.length);
                headerBtn.style.display = 'inline-flex';
            }

            renderDiagramsTabs();
        }

        function renderDiagramsTabs() {
            const tabBar = document.getElementById('diagrams-tab-bar');
            if (!tabBar) return;
            tabBar.innerHTML = '';

            diagramsList.forEach((d, idx) => {
                const tab = document.createElement('button');
                tab.className = 'diagrams-tab' + (idx === currentDiagramIndex ? ' active' : '');
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-selected', idx === currentDiagramIndex ? 'true' : 'false');
                tab.dataset.tabIndex = String(idx);
                tab.title = d.title;
                tab.innerHTML = '<span class="tab-number">' + (idx + 1) + '.</span> <span class="tab-title">' + d.title + '</span>';
                tab.onclick = () => selectDiagramTab(idx);
                tabBar.appendChild(tab);
            });
        }

        function selectDiagramTab(index) {
            if (index < 0 || index >= diagramsList.length) return;
            currentDiagramIndex = index;
            const diagram = diagramsList[index];

            document.querySelectorAll('.diagrams-tab').forEach((tab, idx) => {
                const isActive = idx === index;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
                if (isActive) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            });

            const viewport = document.getElementById('diagrams-viewport');
            if (viewport) {
                if (diagram.svgHtml) {
                    viewport.innerHTML = diagram.svgHtml;
                } else {
                    const inlineRendered = diagram.container?.querySelector('.mermaid-rendered');
                    viewport.innerHTML = inlineRendered ? inlineRendered.innerHTML : '<div class="empty-state">No preview available</div>';
                }
            }

            resetCurrentDiagramZoom();

            const footerInfo = document.getElementById('diagrams-footer-info');
            if (footerInfo) {
                footerInfo.textContent = 'Diagram ' + (index + 1) + ' of ' + diagramsList.length + ' — ' + diagram.title;
            }

            const prevBtn = document.getElementById('diagrams-prev-btn');
            const nextBtn = document.getElementById('diagrams-next-btn');
            if (prevBtn) prevBtn.disabled = diagramsList.length <= 1;
            if (nextBtn) nextBtn.disabled = diagramsList.length <= 1;
        }

        function openDiagramsModal(index = 0) {
            if (diagramsList.length === 0) return;
            const modal = document.getElementById('diagrams-modal');
            if (!modal) return;
            modal.style.display = 'flex';
            isDiagramsModalOpen = true;
            selectDiagramTab(Math.max(0, Math.min(index, diagramsList.length - 1)));
        }

        function closeDiagramsModal() {
            const modal = document.getElementById('diagrams-modal');
            if (!modal) return;
            modal.style.display = 'none';
            isDiagramsModalOpen = false;
        }

        function openDiagramInTab(index) {
            openDiagramsModal(index);
        }

        function zoomCurrentDiagram(delta) {
            currentDiagramZoom = Math.max(0.2, Math.min(3.0, currentDiagramZoom + delta));
            applyDiagramZoom();
        }

        function resetCurrentDiagramZoom() {
            currentDiagramZoom = 1.0;
            applyDiagramZoom();
        }

        function applyDiagramZoom() {
            const viewport = document.getElementById('diagrams-viewport');
            const zoomLevelEl = document.getElementById('diagrams-zoom-level');
            if (viewport) {
                viewport.style.transform = 'scale(' + currentDiagramZoom + ')';
            }
            if (zoomLevelEl) {
                zoomLevelEl.textContent = Math.round(currentDiagramZoom * 100) + '%';
            }
        }

        function navigateDiagram(dir) {
            if (diagramsList.length === 0) return;
            let nextIndex = currentDiagramIndex;
            if (dir === 'next') {
                nextIndex = (currentDiagramIndex + 1) % diagramsList.length;
            } else {
                nextIndex = (currentDiagramIndex - 1 + diagramsList.length) % diagramsList.length;
            }
            selectDiagramTab(nextIndex);
        }

        function jumpToCurrentDiagramLine() {
            const diagram = diagramsList[currentDiagramIndex];
            if (!diagram || !diagram.line) return;
            closeDiagramsModal();
            const target = document.querySelector('.content [data-line="' + diagram.line + '"]');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        async function copyCurrentDiagramSvg() {
            const diagram = diagramsList[currentDiagramIndex];
            if (!diagram || !diagram.svgHtml) {
                alert('No SVG available to copy');
                return;
            }
            try {
                await navigator.clipboard.writeText(diagram.svgHtml);
                alert('SVG copied to clipboard!');
            } catch (err) {
                alert('Failed to copy SVG: ' + err.message);
            }
        }

        window.openDiagramsModal = openDiagramsModal;
        window.closeDiagramsModal = closeDiagramsModal;
        window.openDiagramInTab = openDiagramInTab;
        window.toggleMermaidSource = toggleMermaidSource;
        window.zoomCurrentDiagram = zoomCurrentDiagram;
        window.resetCurrentDiagramZoom = resetCurrentDiagramZoom;
        window.navigateDiagram = navigateDiagram;
        window.jumpToCurrentDiagramLine = jumpToCurrentDiagramLine;
        window.copyCurrentDiagramSvg = copyCurrentDiagramSvg;

        document.querySelectorAll('[data-line]').forEach(el => {
            el.addEventListener('click', () => {
                console.log('Navigate to line:', el.dataset.line);
            });
        });

        // Word-level diff hover sync (Scheme C)
        document.addEventListener('mouseover', (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            const wordEl = target.closest('[data-diff-pair]');
            if (!wordEl) return;
            const pairId = wordEl.getAttribute('data-diff-pair');
            if (!pairId) return;
            document.querySelectorAll('[data-diff-pair="' + pairId + '"]').forEach(el => {
                el.classList.add('diff-word-focus');
            });
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            const wordEl = target.closest('[data-diff-pair]');
            if (!wordEl) return;
            const pairId = wordEl.getAttribute('data-diff-pair');
            if (!pairId) return;
            document.querySelectorAll('[data-diff-pair="' + pairId + '"]').forEach(el => {
                el.classList.remove('diff-word-focus');
            });
        });

        // Diff Navigation
        let currentDiffChunkIndex = -1;
        let diffHighlightTimeout = null;

        function getTopLevelDiffElements() {
            const selector = '.diff-line.added, .diff-removed-block, .diff-line.removed, .diff-row-added, .diff-row-removed, .diff-table-wrapper.added';
            const all = Array.from(document.querySelectorAll(selector));

            return all.filter(el => {
                let parent = el.parentElement;
                while (parent && !parent.classList.contains('content')) {
                    if (parent.matches(selector)) {
                        return false;
                    }
                    parent = parent.parentElement;
                }
                return true;
            });
        }

        function getLiveDiffChunks() {
            const topElements = getTopLevelDiffElements();
            if (topElements.length === 0) return [];

            const chunks = [];
            let currentChunkElements = [topElements[0]];

            const finalizeChunk = (els) => {
                let foundLine = null;
                for (const el of els) {
                    const l = el.dataset?.line || el.querySelector?.('[data-line]')?.dataset?.line;
                    if (l) {
                        foundLine = parseInt(l, 10);
                        break;
                    }
                }
                return {
                    elements: els,
                    target: els[0],
                    line: foundLine
                };
            };

            for (let i = 1; i < topElements.length; i++) {
                const prev = topElements[i - 1];
                const curr = topElements[i];

                const sameTable = prev.closest('table') && prev.closest('table') === curr.closest('table');
                const sameCode = prev.closest('pre') && prev.closest('pre') === curr.closest('pre');
                const isConsecutive = prev.nextElementSibling === curr;

                if (sameTable || sameCode || isConsecutive) {
                    currentChunkElements.push(curr);
                } else {
                    chunks.push(finalizeChunk(currentChunkElements));
                    currentChunkElements = [curr];
                }
            }

            if (currentChunkElements.length > 0) {
                chunks.push(finalizeChunk(currentChunkElements));
            }

            return chunks;
        }

        function updateDiffNavUI() {
            const chunks = getLiveDiffChunks();
            const counterEl = document.getElementById('diff-counter');
            const prevBtn = document.getElementById('diff-prev-btn');
            const nextBtn = document.getElementById('diff-next-btn');

            if (!counterEl || !prevBtn || !nextBtn) return;

            if (chunks.length === 0) {
                counterEl.textContent = '0 / 0';
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                return;
            }

            prevBtn.disabled = false;
            nextBtn.disabled = false;

            if (currentDiffChunkIndex >= 0 && currentDiffChunkIndex < chunks.length) {
                counterEl.textContent = (currentDiffChunkIndex + 1) + ' / ' + chunks.length;
            } else {
                counterEl.textContent = '- / ' + chunks.length;
            }
        }

        function highlightDiffChunk(chunk) {
            document.querySelectorAll('.diff-focus-highlight').forEach(el => {
                el.classList.remove('diff-focus-highlight');
            });

            if (diffHighlightTimeout) clearTimeout(diffHighlightTimeout);

            chunk.elements.forEach(el => {
                el.classList.add('diff-focus-highlight');
            });

            diffHighlightTimeout = setTimeout(() => {
                chunk.elements.forEach(el => {
                    el.classList.remove('diff-focus-highlight');
                });
            }, 1500);
        }

        function calculateNextChunkIndex(currentIndex, totalChunks, direction) {
            if (totalChunks <= 0) return -1;
            if (totalChunks === 1) return 0;
            if (currentIndex < 0) {
                return direction === 'next' ? 0 : totalChunks - 1;
            }
            if (direction === 'next') {
                return (currentIndex + 1) % totalChunks;
            } else {
                return (currentIndex - 1 + totalChunks) % totalChunks;
            }
        }

        let isProgrammaticScroll = false;
        let programmaticScrollTimeout = null;

        function initDiffNav() {
            const chunks = getLiveDiffChunks();
            if (chunks.length === 0) {
                updateDiffNavUI();
                return;
            }
            const headerHeight = document.querySelector('.header')?.offsetHeight || 60;
            const centerY = window.innerHeight / 2;
            let closestIdx = 0;
            let minDistance = Infinity;
            chunks.forEach((chunk, idx) => {
                const rect = chunk.target.getBoundingClientRect();
                const distance = Math.abs(rect.top - centerY);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIdx = idx;
                }
            });
            const rect = chunks[closestIdx].target.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > headerHeight) {
                currentDiffChunkIndex = closestIdx;
            } else {
                currentDiffChunkIndex = 0;
            }
            updateDiffNavUI();
        }

        function navigateDiff(direction) {
            const chunks = getLiveDiffChunks();
            if (chunks.length === 0) return;

            const targetIndex = calculateNextChunkIndex(currentDiffChunkIndex, chunks.length, direction);
            currentDiffChunkIndex = targetIndex;
            const chunk = chunks[targetIndex];

            isProgrammaticScroll = true;
            if (programmaticScrollTimeout) clearTimeout(programmaticScrollTimeout);
            programmaticScrollTimeout = setTimeout(() => {
                isProgrammaticScroll = false;
            }, 800);

            chunk.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlightDiffChunk(chunk);
            updateDiffNavUI();
        }

        window.navigateDiff = navigateDiff;

        window.addEventListener('load', () => {
            initMermaid();
            initDiffNav();
        });

        document.addEventListener('keydown', (e) => {
            if (isDiagramsModalOpen) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeDiagramsModal();
                    return;
                }
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    navigateDiagram('prev');
                    return;
                }
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    navigateDiagram('next');
                    return;
                }
            }

            const activeEl = document.activeElement;
            const isInputFocused = activeEl && (
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.isContentEditable
            );

            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                if (e.key === 'ArrowDown' || e.key === 'Down') {
                    e.preventDefault();
                    navigateDiff('next');
                    return;
                }
                if (e.key === 'ArrowUp' || e.key === 'Up') {
                    e.preventDefault();
                    navigateDiff('prev');
                    return;
                }
            }

            if (e.key === 'F7') {
                e.preventDefault();
                navigateDiff(e.shiftKey ? 'prev' : 'next');
                return;
            }

            if (!isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (e.key === 'n' || e.key === 'j' || e.key === ']') {
                    e.preventDefault();
                    navigateDiff('next');
                    return;
                }
                if (e.key === 'p' || e.key === 'k' || e.key === '[') {
                    e.preventDefault();
                    navigateDiff('prev');
                    return;
                }
            }
        });
    </script>
</body>
</html>`;
}

async function main() {
    const args = process.argv.slice(2);
    const diffFile = args[0] || 'demo/test.txt';
    const outputFile = args[1] || 'demo/preview.html';

    const projectRoot = path.resolve(__dirname, '..');
    const diffPath = path.resolve(projectRoot, diffFile);
    const outputPath = path.resolve(projectRoot, outputFile);

    console.log(`Reading diff from: ${diffPath}`);
    
    if (!fs.existsSync(diffPath)) {
        console.error(`Error: Diff file not found: ${diffPath}`);
        process.exit(1);
    }

    const diffContent = fs.readFileSync(diffPath, 'utf-8');
    
    // Extract file name from diff
    const fileNameMatch = diffContent.match(/^diff --git a\/(.+?) b\//m);
    const fileName = fileNameMatch ? path.basename(fileNameMatch[1]) : 'document.md';

    console.log(`Parsing diff for: ${fileName}`);

    // Parse the diff using the same code as the extension
    const diff = parseDiff(fileName, diffContent);
    
    // Extract the new file content
    const markdownContent = extractNewFileContent(diffContent);

    console.log(`Added lines: ${diff.addedLines.size}`);
    console.log(`Removed line positions: ${diff.removedLines.size}`);

    // Render the markdown with diff highlighting using the same code as the extension
    const renderedContent = await renderMarkdownWithDiff(markdownContent, diff, true);

    // Count removals (sum up all removed lines)
    let removedCount = 0;
    diff.removedLines.forEach(content => {
        removedCount += content.split('\n').filter(l => l.trim()).length;
    });

    // Generate full HTML
    const html = generateHtml(renderedContent, fileName, diff.addedLines.size, removedCount);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`Generated: ${outputPath}`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
