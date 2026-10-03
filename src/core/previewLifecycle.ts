/**
 * Preview auto-close policy - no VS Code / DOM dependencies.
 *
 * Decides whether an open panel tracking `currentUri` must be closed
 * because its file was removed from disk (deleted or renamed away).
 * Callers pass `e.files` (delete) or `oldUri` list (rename) as strings.
 */

export function shouldClosePreviewOnRemove(
    currentUri: string | undefined,
    removedUris: readonly string[]
): boolean {
    if (!currentUri) {
        return false;
    }
    return removedUris.includes(currentUri);
}
