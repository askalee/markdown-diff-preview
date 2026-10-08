/**
 * Comment badge / thread HTML rendering - no VS Code dependencies.
 * Extracted from the markdown renderer so block/inline comment markup has a
 * single owner. State (dedup set + accumulated threads) lives in the
 * renderer instance created per `renderMarkdownWithDiff` call.
 */

import { CommentsData, Comment } from './types';
import { getCommentsForLine, getCommentStatus } from './commentParser';
import { escapeHtml } from './html';

export interface CommentRenderer {
    /** Prepend block-comment badges for markers on `lineNumber`. */
    wrapWithComments(content: string, lineNumber: number): string;
    /** Insert inline badges after their target text. */
    processInlineComments(html: string, originalLine: string, lineNumber: number): string;
    /** Badge prefix for a heading whose previous line is a block marker. */
    prefixBlockBadge(prevLineText: string): string;
    /** Accumulated thread panels, in first-seen order. */
    takeThreadsHtml(): string[];
}

function renderCommentBadge(comment: Comment): string {
    const status = getCommentStatus(comment);
    const statusClass = `comment-status-${status}`;
    return `<span class="comment-badge ${statusClass}" data-comment-id="${comment.id}" data-comment-line="${comment.target.line}" onclick="toggleCommentThread(${comment.id}); event.stopPropagation();">[${comment.id}]</span>`;
}

function renderCommentThread(comment: Comment): string {
    const threadItems = comment.thread.map(item => {
        const authorClass = item.author === 'ai' ? 'comment-author-ai' : 'comment-author-user';
        const timestamp = new Date(item.timestamp).toLocaleString();
        const content = escapeHtml(item.content.trim());
        // Only show author label for AI comments; don't show "You" for user comments
        const authorLabel = item.author === 'ai' ? 'AI' : '';
        return `
                <div class="comment-thread-item ${authorClass}">
                    <div class="comment-thread-header">
                        ${authorLabel ? `<span class="comment-author">${authorLabel}</span>` : ''}
                        <span class="comment-timestamp">${timestamp}</span>
                    </div>
                    <div class="comment-thread-content">${content}</div>
                </div>
            `;
    }).join('');

    let planHtml = '';
    if (comment.plan) {
        const planContent = escapeHtml(comment.plan.content.trim());
        planHtml = `
                <div class="comment-plan">
                    <h4 class="comment-section-title">Plan</h4>
                    <div class="comment-editable" contenteditable="true" data-comment-id="${comment.id}" data-type="plan">${planContent}</div>
                    <div class="comment-status-badge status-${comment.plan.status}">${comment.plan.status}</div>
                </div>
            `;
    }

    let responseHtml = '';
    if (comment.response) {
        const responseContent = escapeHtml(comment.response.content.trim());
        responseHtml = `
                <div class="comment-response">
                    <h4 class="comment-section-title">Response</h4>
                    <div class="comment-editable" contenteditable="true" data-comment-id="${comment.id}" data-type="response">${responseContent}</div>
                    <div class="comment-status-badge status-${comment.response.status}">${comment.response.status}</div>
                </div>
            `;
    }

    return `
            <div class="comment-thread" id="comment-thread-${comment.id}" data-comment-id="${comment.id}" data-comment-line="${comment.target.line}" style="display: none;">
                <div class="comment-thread-header-bar">
                    <span class="comment-thread-title">Comment ${comment.id}</span>
                    <div class="comment-thread-controls">
                        <div class="comment-thread-nav">
                            <button class="comment-nav-btn" data-nav="prev" aria-label="Previous comment">←</button>
                            <button class="comment-nav-btn" data-nav="next" aria-label="Next comment">→</button>
                        </div>
                        <button class="comment-close-btn" onclick="toggleCommentThread(${comment.id}); event.stopPropagation();" aria-label="Close">×</button>
                    </div>
                </div>
                <div class="comment-thread-items">
                    ${threadItems || '<div class="comment-thread-item">No comments yet</div>'}
                </div>
                ${planHtml}
                ${responseHtml}
            </div>
        `;
}

function statusClassFor(lineComments: Comment[]): string {
    const hasPlan = lineComments.some(c => c.plan !== null);
    const hasResponse = lineComments.some(c => c.response !== null);
    return hasResponse ? 'comment-has-response' : hasPlan ? 'comment-has-plan' : 'comment-active';
}

export function createCommentRenderer(
    comments: CommentsData | null,
    commentMarkers: Map<number, number[]>
): CommentRenderer {
    // Tracks processed comments to avoid duplicates
    const processedComments = new Set<number>();
    const threadsHtml: string[] = [];

    const storeThread = (comment: Comment): void => {
        if (!threadsHtml.some(html => html.includes(`comment-thread-${comment.id}`))) {
            threadsHtml.push(renderCommentThread(comment));
        }
    };

    const wrapWithComments = (content: string, lineNumber: number): string => {
        if (!comments) {
            return content;
        }

        const lineComments = getCommentsForLine(lineNumber, comments, commentMarkers);

        if (lineComments.length === 0) {
            return content;
        }

        // For block comments, add badges before the element
        // Inline comments are handled in processInlineComments
        const blockComments = lineComments.filter(c => c.target.type === 'block' && !processedComments.has(c.id));

        if (blockComments.length === 0) {
            // Only inline comments - already handled in parseInline
            return content;
        }

        // Mark as processed BEFORE generating badges to prevent duplicates
        blockComments.forEach(c => processedComments.add(c.id));

        // Generate badges HTML for block comments
        const badges = blockComments.map(comment => {
            storeThread(comment);
            return renderCommentBadge(comment);
        }).join('');

        // For block elements, inject badge at the start
        return `<span class="comment-highlight-block ${statusClassFor(lineComments)}">${badges}</span>${content}`;
    };

    const processInlineComments = (html: string, originalLine: string, lineNumber: number): string => {
        if (!comments) {
            return html;
        }

        const lineComments = getCommentsForLine(lineNumber, comments, commentMarkers);
        const inlineComments = lineComments.filter(c => c.target.type === 'inline');

        if (inlineComments.length === 0) {
            return html;
        }

        // Find comment markers in original line and their positions
        const markers: Array<{ id: number; position: number; comment: Comment }> = [];
        const markerRegex = /<!--comment:(\d+)-->/g;
        let match;

        while ((match = markerRegex.exec(originalLine)) !== null) {
            const commentId = parseInt(match[1], 10);
            const comment = comments[commentId.toString()];
            if (comment && comment.target.type === 'inline' && !processedComments.has(comment.id)) {
                markers.push({
                    id: commentId,
                    position: match.index,
                    comment
                });
            }
        }

        if (markers.length === 0) {
            return html;
        }

        // Mark as processed and store threads
        markers.forEach(({ comment }) => {
            processedComments.add(comment.id);
            storeThread(comment);
        });

        // Find the target text in the HTML and insert badge after it
        // We need to find the escaped version of the target text
        let result = html;
        markers.forEach(({ comment }) => {
            if (comment.target.text) {
                const escapedText = escapeHtml(comment.target.text);
                // Try to find the text in the HTML (might be wrapped in spans)
                const textIndex = result.indexOf(escapedText);
                if (textIndex !== -1) {
                    const badge = renderCommentBadge(comment);
                    // Insert badge after the text
                    const insertPos = textIndex + escapedText.length;
                    result = result.slice(0, insertPos) + ' ' + badge + result.slice(insertPos);
                } else {
                    // If text not found, append badge at end
                    const badge = renderCommentBadge(comment);
                    result = result + ' ' + badge;
                }
            }
        });

        // Wrap in highlight if we have comments
        if (markers.length > 0 && !result.includes('comment-highlight')) {
            result = `<span class="comment-highlight ${statusClassFor(inlineComments)}">${result}</span>`;
        }

        return result;
    };

    const prefixBlockBadge = (prevLineText: string): string => {
        if (!comments) {
            return '';
        }
        // The comment marker is on the previous line, but the comment targets
        // the current line (e.g. a heading).
        const blockCommentMatch = prevLineText.trim().match(/^<!--comment:(\d+)-->$/);
        if (!blockCommentMatch) {
            return '';
        }
        const comment = comments[parseInt(blockCommentMatch[1], 10).toString()];
        if (!comment || comment.target.type !== 'block' || processedComments.has(comment.id)) {
            return '';
        }
        // Mark as processed immediately to prevent duplicates
        processedComments.add(comment.id);
        storeThread(comment);
        const badge = renderCommentBadge(comment);
        const statusClass = comment.response !== null ? 'comment-has-response'
            : comment.plan !== null ? 'comment-has-plan' : 'comment-active';
        return `<span class="comment-highlight-block ${statusClass}">${badge}</span>`;
    };

    const takeThreadsHtml = (): string[] => threadsHtml;

    return { wrapWithComments, processInlineComments, prefixBlockBadge, takeThreadsHtml };
}
