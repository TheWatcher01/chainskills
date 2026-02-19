/**
 * FileDecorationProvider — ✓/✗/⚡ badges on .workflow.md files in Explorer
 *
 * Tracks the last validation result per URI and decorates accordingly.
 */
import * as vscode from 'vscode';
export declare class WorkflowFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
    private readonly _onDidChange;
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[]>;
    private readonly state;
    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined;
    setValid(uri: vscode.Uri): void;
    setInvalid(uri: vscode.Uri): void;
    setRunning(uri: vscode.Uri): void;
    clearState(uri: vscode.Uri): void;
    dispose(): void;
}
