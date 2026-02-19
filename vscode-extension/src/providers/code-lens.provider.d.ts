/**
 * CodeLensProvider — "▶ Run | 🔍 Validate | 📊 DAG" above each step heading
 *
 * Provides one lens group per step heading in .workflow.md files.
 */
import * as vscode from 'vscode';
export declare class WorkflowCodeLensProvider implements vscode.CodeLensProvider {
    private readonly _onDidChange;
    readonly onDidChangeCodeLenses: vscode.Event<void>;
    refresh(): void;
    provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.CodeLens[];
}
