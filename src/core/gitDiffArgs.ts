/**
 * Git diff argument helpers — pure, no VS Code / child_process dependencies.
 * Keeps shell metacharacters out of git invocations: callers must use
 * `execFile('git', buildGitDiffArgs(...))` and never string-interpolate.
 */

const SAFE_DIFF_BASE = /^[A-Za-z0-9/._@{}^~:-]+$/;

export const FALLBACK_DIFF_BASE = 'HEAD';

/** Validate a user-configured git ref; fall back to HEAD on anything suspicious. */
export function validateDiffBase(raw: unknown): string {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 256) {
        return FALLBACK_DIFF_BASE;
    }
    return SAFE_DIFF_BASE.test(raw) ? raw : FALLBACK_DIFF_BASE;
}

/** argv for `git diff <base> -- <path>` (no shell involved). */
export function buildGitDiffArgs(diffBase: string, relativePath: string): string[] {
    return ['diff', validateDiffBase(diffBase), '--', relativePath];
}

/** argv for `git diff -- <path>` (unstaged fallback). */
export function buildUnstagedDiffArgs(relativePath: string): string[] {
    return ['diff', '--', relativePath];
}

/**
 * Classify a `git ls-files --error-unmatch` failure.
 * Exit 1 means the path simply isn't tracked; anything else (not a repo,
 * git missing, permission errors) is unknown and must not be treated as new.
 */
export function classifyLsFilesError(error: unknown): boolean | null {
    const code = (error as { code?: number | string } | null | undefined)?.code;
    return code === 1 ? false : null;
}
