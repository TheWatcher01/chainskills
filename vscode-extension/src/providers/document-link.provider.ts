/**
 * DocumentLinkProvider — make @use and @workflow file paths clickable
 *
 * `@use ./path/to/skill.workflow.md` → opens the file
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { parseWorkflowDocument } from './workflow-document';

export class WorkflowDocumentLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentLink[] {
        const parsed = parseWorkflowDocument(document);
        const links: vscode.DocumentLink[] = [];
        const dir = path.dirname(document.uri.fsPath);

        for (const imp of parsed.imports) {
            const p = imp.path;

            // Resolve relative paths
            let target: vscode.Uri | undefined;
            if (p.startsWith('./') || p.startsWith('../')) {
                const resolved = path.resolve(dir, p);
                target = vscode.Uri.file(resolved);
            } else if (!p.includes('/') && !p.startsWith('@')) {
                // Local skill name — try workspace-relative
                const candidates = [
                    vscode.Uri.file(path.resolve(dir, p)),
                    vscode.Uri.file(path.resolve(dir, p + '.workflow.md')),
                ];
                // Return both as links (VS Code will open whichever exists)
                for (const c of candidates) {
                    links.push(new vscode.DocumentLink(imp.range, c));
                }
                continue;
            }

            if (target) {
                links.push(new vscode.DocumentLink(imp.range, target));
            }
        }

        return links;
    }
}
