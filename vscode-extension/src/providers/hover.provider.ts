/**
 * HoverProvider — inline documentation on hover for .workflow.md
 *
 * - Hover on @directive → shows docs + syntax example
 * - Hover on $variable → shows definition source and line count
 * - Hover on :::block → shows block type description
 */

import * as vscode from 'vscode';
import { parseWorkflowDocument, DIRECTIVE_DOCS, DIRECTIVES } from './workflow-document';

const BLOCK_DOCS: Record<string, string> = {
    parallel: '**`:::parallel`** block — all steps inside run concurrently',
    if:       '**`:::if`** block — conditional branch (with optional `:::else`)',
    else:     '**`:::else`** block — else branch of an `:::if`',
    for:      '**`:::for`** block — bounded iteration over a list',
    repeat:   '**`:::repeat`** block — loop with stop condition',
    try:      '**`:::try`** block — error-handling block (use `@on-error` inside)',
    workflow: '**`:::workflow`** block — inline sub-workflow definition',
};

const KNOWN_DIRECTIVES = new Set<string>(DIRECTIVES);

export class WorkflowHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.Hover | undefined {
        const parsed = parseWorkflowDocument(document);
        const lineText = document.lineAt(position.line).text;
        const charIdx = position.character;

        // 1. Hover on :::block open
        const blockMatch = lineText.trim().match(/^:::([\w-]+)/);
        if (blockMatch && BLOCK_DOCS[blockMatch[1]]) {
            return new vscode.Hover(new vscode.MarkdownString(BLOCK_DOCS[blockMatch[1]]));
        }

        // 2. Hover on @directive
        const dMatch = lineText.match(/(@[\w-]+)/g);
        if (dMatch) {
            for (const dm of dMatch) {
                const col = lineText.indexOf(dm);
                if (charIdx >= col && charIdx <= col + dm.length) {
                    const name = dm.slice(1).toLowerCase();
                    if (KNOWN_DIRECTIVES.has(name)) {
                        const doc = DIRECTIVE_DOCS[name as keyof typeof DIRECTIVE_DOCS];
                        const md = new vscode.MarkdownString(`**\`${dm}\`** — chainskills directive\n\n${doc}`);
                        md.isTrusted = true;
                        return new vscode.Hover(md, new vscode.Range(position.line, col, position.line, col + dm.length));
                    }
                    return new vscode.Hover(
                        new vscode.MarkdownString(`**\`${dm}\`** — unknown directive`),
                        new vscode.Range(position.line, col, position.line, col + dm.length)
                    );
                }
            }
        }

        // 3. Hover on $variable
        const varPattern = /\$([a-zA-Z_][a-zA-Z0-9_.]*)/g;
        const allVarMatches: RegExpExecArray[] = [];
        let vmt = varPattern.exec(lineText);
        while (vmt !== null) {
            allVarMatches.push(vmt);
            vmt = varPattern.exec(lineText);
        }
        for (const vm of allVarMatches) {
            const start = vm.index;
            const end = start + vm[0].length;
            if (charIdx >= start && charIdx <= end) {
                const vname = vm[1];
                const variable = parsed.variables.find(v => v.name === vname);
                const refs = variable ? variable.references : [];
                const defined = variable?.definedInFrontmatter
                    ? 'Declared in frontmatter `inputs`'
                    : refs.length > 0
                        ? `Referenced on ${refs.length} line(s)`
                        : 'Not explicitly declared';
                const md = new vscode.MarkdownString(
                    `**\`$${vname}\`** — variable\n\n${defined}`
                );
                return new vscode.Hover(md, new vscode.Range(position.line, start, position.line, end));
            }
        }

        return undefined;
    }
}
