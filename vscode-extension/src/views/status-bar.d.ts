/**
 * WorkflowStatusBar — StatusBarItem for active workflow execution
 *
 * Shows "⏳ workflow-name 3/7" during execution
 * and "✓ workflow-name 2.3s" after completion.
 */
import * as vscode from 'vscode';
export declare class WorkflowStatusBar implements vscode.Disposable {
    private readonly item;
    private startTime;
    private workflowName;
    private currentStep;
    private totalSteps;
    constructor();
    /** Call when the active editor changes to a .workflow.md file */
    showIdle(uri: vscode.Uri): void;
    /** Call at the start of a workflow run */
    onRunStart(uri: vscode.Uri, total?: number): void;
    /** Call on each step start */
    onStepStart(stepIndex: number, total?: number): void;
    /** Call when execution ends successfully */
    onRunSuccess(): void;
    /** Call when execution ends with error */
    onRunError(message?: string): void;
    hide(): void;
    dispose(): void;
    private _refresh;
}
