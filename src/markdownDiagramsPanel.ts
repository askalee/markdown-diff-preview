import * as vscode from 'vscode';
import { MarkdownDiffPreviewPanel } from './markdownPreview';

/**
 * @deprecated Single-panel mode: diagrams now render in the right-hand pane
 * of {@link MarkdownDiffPreviewPanel}. This shim only forwards legacy calls
 * so old code paths keep working. It never creates its own webview panel.
 */
export class MarkdownDiagramsPanel {
    public static currentPanel: undefined = undefined;

    public static createOrShow(_extensionUri: vscode.Uri, document: vscode.TextDocument, initialIndex: number = 0): void {
        if (MarkdownDiffPreviewPanel.currentPanel) {
            MarkdownDiffPreviewPanel.showDiagram(initialIndex);
            return;
        }
        MarkdownDiffPreviewPanel.createOrShow(_extensionUri, document);
        MarkdownDiffPreviewPanel.showDiagram(initialIndex);
    }

    public static updateIfVisible(_document: vscode.TextDocument): void {
        return;
    }

    public static refresh(): void {
        MarkdownDiffPreviewPanel.refresh();
    }

    public static get currentDocumentUri(): string | undefined {
        return MarkdownDiffPreviewPanel.currentDocumentUri;
    }

    public static getConfiguredDetail(): 'minimal' | 'compact' | 'full' {
        return MarkdownDiffPreviewPanel.getConfiguredDiagramsDetail();
    }

    public dispose(): void {
        return;
    }
}
