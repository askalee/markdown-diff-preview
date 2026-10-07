import { extractMermaidTitle } from './markdownRenderer';

export interface ParsedDiagram {
    index: number;
    title: string;
    line: number;
    code: string;
}

export function extractDiagrams(text: string): ParsedDiagram[] {
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
                    diagrams.push({ index, title, line: startLine, code });
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
