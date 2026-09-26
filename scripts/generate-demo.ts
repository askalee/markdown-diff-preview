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
            <button class="refresh-btn" onclick="location.reload()">↻ Refresh</button>
        </div>
    </div>

    <div class="content">
        ${content}
    </div>

    <script>
        function toggleTheme() {
            document.body.classList.toggle('theme-light');
        }

        document.querySelectorAll('[data-line]').forEach(el => {
            el.addEventListener('click', () => {
                console.log('Navigate to line:', el.dataset.line);
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
            initDiffNav();
        });

        document.addEventListener('keydown', (e) => {
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
