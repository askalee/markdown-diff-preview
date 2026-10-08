/**
 * Single source of truth for HTML escaping.
 * No VS Code / DOM dependencies.
 */

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function escapeAttr(text: string): string {
    return escapeHtml(text);
}
