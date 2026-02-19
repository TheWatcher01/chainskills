/**
 * FileDecorationProvider — ✓/✗/⚡ badges on .workflow.md files in Explorer
 *
 * Tracks the last validation result per URI and decorates accordingly.
 */

import * as vscode from 'vscode';

type DecorationState = 'valid' | 'invalid' | 'running' | 'unknown';

export class WorkflowFileDecorationProvider
    implements vscode.FileDecorationProvider, vscode.Disposable
{
    private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
    readonly onDidChangeFileDecorations = this._onDidChange.event;

    private readonly state = new Map<string, DecorationState>();

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (!uri.fsPath.endsWith('.workflow.md')) { return undefined; }

        const s = this.state.get(uri.toString()) ?? 'unknown';
        switch (s) {
            case 'valid':
                return {
                    badge: '✓',
                    tooltip: 'chainskills: workflow valid',
                    color: new vscode.ThemeColor('chainskills.validColor'),
                };
            case 'invalid':
                return {
                    badge: '✗',
                    tooltip: 'chainskills: workflow has errors',
                    color: new vscode.ThemeColor('statusBarItem.errorBackground'),
                };
            case 'running':
                return {
                    badge: '⚡',
                    tooltip: 'chainskills: workflow is running',
                    color: new vscode.ThemeColor('statusBarItem.warningBackground'),
                };
            default:
                return undefined;
        }
    }

    setValid(uri: vscode.Uri): void {
        this.state.set(uri.toString(), 'valid');
        this._onDidChange.fire(uri);
    }

    setInvalid(uri: vscode.Uri): void {
        this.state.set(uri.toString(), 'invalid');
        this._onDidChange.fire(uri);
    }

    setRunning(uri: vscode.Uri): void {
        this.state.set(uri.toString(), 'running');
        this._onDidChange.fire(uri);
    }

    clearState(uri: vscode.Uri): void {
        this.state.delete(uri.toString());
        this._onDidChange.fire(uri);
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}
