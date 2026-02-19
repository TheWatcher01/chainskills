/**
 * WorkflowStatusBar — StatusBarItem for active workflow execution
 *
 * Shows "⏳ workflow-name 3/7" during execution
 * and "✓ workflow-name 2.3s" after completion.
 */

import * as vscode from 'vscode';
import * as path from 'path';

export class WorkflowStatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private startTime: number | undefined;
    private workflowName: string = '';
    private currentStep = 0;
    private totalSteps = 0;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            'chainskills.status',
            vscode.StatusBarAlignment.Left,
            100
        );
        this.item.name = 'chainskills';
        this.item.command = 'chainskills.stopExecution';
    }

    /** Call when the active editor changes to a .workflow.md file */
    showIdle(uri: vscode.Uri): void {
        const name = path.basename(uri.fsPath, '.workflow.md');
        this.item.text = `$(symbol-misc) ${name}`;
        this.item.tooltip = `chainskills: ${name} — click to open`;
        this.item.command = undefined;
        this.item.backgroundColor = undefined;
        this.item.show();
    }

    /** Call at the start of a workflow run */
    onRunStart(uri: vscode.Uri, total?: number): void {
        this.workflowName = path.basename(uri.fsPath, '.workflow.md');
        this.startTime = Date.now();
        this.currentStep = 0;
        this.totalSteps = total ?? 0;
        this.item.command = 'chainskills.stopExecution';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this._refresh();
        this.item.show();
    }

    /** Call on each step start */
    onStepStart(stepIndex: number, total?: number): void {
        this.currentStep = stepIndex;
        if (total !== undefined) { this.totalSteps = total; }
        this._refresh();
    }

    /** Call when execution ends successfully */
    onRunSuccess(): void {
        const elapsed = this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(1) : '?';
        this.item.text = `$(check) ${this.workflowName} ${elapsed}s`;
        this.item.tooltip = `chainskills: last run succeeded in ${elapsed}s`;
        this.item.backgroundColor = undefined;
        this.item.command = undefined;
        this.item.show();
    }

    /** Call when execution ends with error */
    onRunError(message?: string): void {
        this.item.text = `$(error) ${this.workflowName} failed`;
        this.item.tooltip = message ? `chainskills: ${message}` : 'chainskills: last run failed';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.item.command = undefined;
        this.item.show();
    }

    hide(): void {
        this.item.hide();
    }

    dispose(): void {
        this.item.dispose();
    }

    private _refresh(): void {
        const counter = this.totalSteps > 0
            ? ` ${this.currentStep}/${this.totalSteps}`
            : this.currentStep > 0 ? ` step ${this.currentStep}` : '';
        this.item.text = `$(loading~spin) ${this.workflowName}${counter}`;
        this.item.tooltip = `chainskills: running ${this.workflowName}${counter} — click to stop`;
    }
}
