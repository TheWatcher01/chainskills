/**
 * HoverProvider — inline documentation on hover for .workflow.md
 *
 * - Hover on @directive → shows docs + syntax example
 * - Hover on $variable → shows definition source and line count
 * - Hover on :::block → shows block type description
 */
import * as vscode from 'vscode';
export declare class WorkflowHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): vscode.Hover | undefined;
}
