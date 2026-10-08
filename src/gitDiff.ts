import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { parseDiff } from './core/diffParser';
import { GIT_MAX_BUFFER } from './core/constants';
import { validateDiffBase, buildGitDiffArgs, buildUnstagedDiffArgs, classifyLsFilesError } from './core/gitDiffArgs';

// Re-export types from core for backwards compatibility
export { FileDiff, DiffHunk, DiffChange } from './core/types';
export { parseDiff } from './core/diffParser';

import type { FileDiff } from './core/types';

const execFileAsync = promisify(execFile);

export async function getGitDiff(document: vscode.TextDocument): Promise<FileDiff | null> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        return null;
    }

    const config = vscode.workspace.getConfiguration('markdownDiffPreview');
    const diffBase = validateDiffBase(config.get<string>('diffBase', 'HEAD'));
    
    const relativePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);
    const cwd = workspaceFolder.uri.fsPath;

    try {
        // Check if file is tracked by git. `null` means git itself failed
        // (e.g. not a repo) — render without diff rather than mislabeling
        // every line as a new-file addition.
        const trackState = await isFileTracked(cwd, relativePath);
        if (trackState === null) {
            return null;
        }

        if (!trackState) {
            // New file - mark all lines as added
            const lineCount = document.lineCount;
            const addedLines = new Set<number>();
            for (let i = 1; i <= lineCount; i++) {
                addedLines.add(i);
            }
            return {
                filePath: relativePath,
                isNew: true,
                isDeleted: false,
                hunks: [],
                addedLines,
                removedLines: new Map()
            };
        }

        // Get the diff output (argv-based, no shell interpolation)
        const { stdout } = await execFileAsync(
            'git',
            buildGitDiffArgs(diffBase, relativePath),
            { cwd, maxBuffer: GIT_MAX_BUFFER }
        );

        if (!stdout.trim()) {
            // Also check for unstaged changes
            const { stdout: unstagedDiff } = await execFileAsync(
                'git',
                buildUnstagedDiffArgs(relativePath),
                { cwd, maxBuffer: GIT_MAX_BUFFER }
            );
            
            if (!unstagedDiff.trim()) {
                return {
                    filePath: relativePath,
                    isNew: false,
                    isDeleted: false,
                    hunks: [],
                    addedLines: new Set(),
                    removedLines: new Map()
                };
            }
            
            return parseDiff(relativePath, unstagedDiff);
        }

        return parseDiff(relativePath, stdout);
    } catch (error) {
        console.error('Error getting git diff:', error);
        return null;
    }
}

async function isFileTracked(cwd: string, relativePath: string): Promise<boolean | null> {
    try {
        await execFileAsync('git', ['ls-files', '--error-unmatch', '--', relativePath], { cwd });
        return true;
    } catch (error) {
        return classifyLsFilesError(error);
    }
}

export async function getGitBranch(document: vscode.TextDocument): Promise<string | null> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        return null;
    }

    try {
        const { stdout } = await execFileAsync('git', ['branch', '--show-current'], {
            cwd: workspaceFolder.uri.fsPath
        });
        return stdout.trim();
    } catch {
        return null;
    }
}

export async function getGitStatus(document: vscode.TextDocument): Promise<string | null> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        return null;
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);

    try {
        const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--', relativePath], {
            cwd: workspaceFolder.uri.fsPath
        });
        
        if (!stdout.trim()) {
            return 'unchanged';
        }
        
        const status = stdout.trim().substring(0, 2);
        if (status.includes('A') || status === '??') {
            return 'new';
        } else if (status.includes('M')) {
            return 'modified';
        } else if (status.includes('D')) {
            return 'deleted';
        }
        return 'changed';
    } catch {
        return null;
    }
}
