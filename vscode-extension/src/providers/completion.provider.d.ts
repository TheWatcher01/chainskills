/**
 * CompletionItemProvider — autocomplete for .workflow.md
 *
 * Triggers:
 * - `@`  → all directive names with docs
 * - `$`  → all known variables from current doc
 * - `@call ` → common tool patterns
 * - frontmatter keys (when inside --- block)
 */
import * as vscode from 'vscode';
export declare class WorkflowCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken, _context: vscode.CompletionContext): vscode.CompletionItem[];
}
