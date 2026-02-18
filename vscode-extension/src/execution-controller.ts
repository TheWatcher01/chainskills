/**
 * Execution Controller - Manages workflow execution state
 * 
 * Tracks running workflows and provides pause/resume/cancel control.
 */

import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';

export class ExecutionController implements vscode.Disposable {
    private currentProcess: ChildProcess | undefined;
    private isPaused = false;
    private isExecuting = false;

    setProcess(process: ChildProcess | undefined) {
        this.currentProcess = process;
        this.isExecuting = !!process;
        this.updateContext();
    }

    pause() {
        if (this.currentProcess && this.isExecuting && !this.isPaused) {
            this.isPaused = true;
            this.currentProcess.kill('SIGSTOP'); // Pause process
            this.updateContext();
            vscode.window.showInformationMessage('Workflow execution paused');
        }
    }

    resume() {
        if (this.currentProcess && this.isPaused) {
            this.isPaused = false;
            this.currentProcess.kill('SIGCONT'); // Resume process
            this.updateContext();
            vscode.window.showInformationMessage('Workflow execution resumed');
        }
    }

    cancel() {
        if (this.currentProcess) {
            this.currentProcess.kill('SIGTERM');
            this.currentProcess = undefined;
            this.isPaused = false;
            this.isExecuting = false;
            this.updateContext();
            vscode.window.showInformationMessage('Workflow execution cancelled');
        }
    }

    step() {
        // TODO: Implement step-through debugging
        // Will require integration with chainskills ExecutionController API
        vscode.window.showInformationMessage('Step debugging not yet implemented');
    }

    private updateContext() {
        vscode.commands.executeCommand('setContext', 'chainskills.isExecuting', this.isExecuting);
        vscode.commands.executeCommand('setContext', 'chainskills.isPaused', this.isPaused);
    }

    dispose() {
        if (this.currentProcess) {
            this.currentProcess.kill();
        }
    }
}
