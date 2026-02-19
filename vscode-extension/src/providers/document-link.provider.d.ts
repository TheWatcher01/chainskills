/**
 * DocumentLinkProvider — make @use and @workflow file paths clickable
 *
 * `@use ./path/to/skill.workflow.md` → opens the file
 */
import * as vscode from 'vscode';
export declare class WorkflowDocumentLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.DocumentLink[];
}
