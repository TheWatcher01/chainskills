/**
 * Execution Controller - Manages workflow execution state
 *
 * Tracks running workflows and provides pause/resume/cancel control.
 */
import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';
export declare class ExecutionController implements vscode.Disposable {
    private currentProcess;
    private isPaused;
    private isExecuting;
    setProcess(process: ChildProcess | undefined): void;
    pause(): void;
    resume(): void;
    cancel(): void;
    step(): void;
    private updateContext;
    dispose(): void;
}
