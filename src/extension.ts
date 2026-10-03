import * as vscode from 'vscode';
import { MarkdownDiffPreviewPanel } from './markdownPreview';
import { MarkdownDiagramsPanel } from './markdownDiagramsPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown Diff Preview is now active!');

    // Register the open preview command
    const openPreviewCommand = vscode.commands.registerCommand(
        'markdownDiffPreview.open',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'markdown') {
                MarkdownDiffPreviewPanel.createOrShow(context.extensionUri, editor.document);
            } else {
                vscode.window.showWarningMessage('Please open a Markdown file first');
            }
        }
    );

    // Register the open diagrams view command
    const openDiagramsCommand = vscode.commands.registerCommand(
        'markdownDiffPreview.openDiagramsView',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'markdown') {
                MarkdownDiagramsPanel.createOrShow(context.extensionUri, editor.document);
            } else {
                vscode.window.showWarningMessage('Please open a Markdown file first');
            }
        }
    );

    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand(
        'markdownDiffPreview.refresh',
        () => {
            MarkdownDiffPreviewPanel.refresh();
        }
    );

    // Register diff navigation commands
    const nextDiffCommand = vscode.commands.registerCommand(
        'markdownDiffPreview.nextDiff',
        () => {
            MarkdownDiffPreviewPanel.navigateDiff('next');
        }
    );

    const prevDiffCommand = vscode.commands.registerCommand(
        'markdownDiffPreview.previousDiff',
        () => {
            MarkdownDiffPreviewPanel.navigateDiff('prev');
        }
    );

    const toggleViewModeCommand = vscode.commands.registerCommand(
        'markdownDiffPreview.toggleViewMode',
        () => {
            MarkdownDiffPreviewPanel.toggleViewMode();
        }
    );

    const showNormalModeCommand = vscode.commands.registerCommand(
        'markdownDiffPreview.showNormalMode',
        () => {
            MarkdownDiffPreviewPanel.setViewMode('normal');
        }
    );

    const showDiffModeCommand = vscode.commands.registerCommand(
        'markdownDiffPreview.showDiffMode',
        () => {
            MarkdownDiffPreviewPanel.setViewMode('diff');
        }
    );

    // Auto-update preview when document changes
    const onDocumentChange = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.languageId === 'markdown') {
            MarkdownDiffPreviewPanel.updateIfVisible(e.document);
            MarkdownDiagramsPanel.updateIfVisible(e.document);
        }
    });

    const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('markdownDiffPreview.classDiagramDetail')) {
            MarkdownDiagramsPanel.refresh();
        }
    });

    // Update when switching to a different markdown file
    const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.languageId === 'markdown') {
            MarkdownDiffPreviewPanel.updateIfVisible(editor.document);
        }
    });

    // Watch for git changes
    const gitWatcher = vscode.workspace.createFileSystemWatcher('**/.git/**');
    gitWatcher.onDidChange(() => {
        MarkdownDiffPreviewPanel.refresh();
    });

    context.subscriptions.push(
        openPreviewCommand,
        openDiagramsCommand,
        refreshCommand,
        nextDiffCommand,
        prevDiffCommand,
        toggleViewModeCommand,
        showNormalModeCommand,
        showDiffModeCommand,
        onDocumentChange,
        onActiveEditorChange,
        onConfigChange,
        gitWatcher
    );
}

export function deactivate() {
    MarkdownDiffPreviewPanel.dispose();
    if (MarkdownDiagramsPanel.currentPanel) {
        MarkdownDiagramsPanel.currentPanel.dispose();
    }
}
