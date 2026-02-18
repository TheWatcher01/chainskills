/**
 * chainskills VS Code Extension
 * 
 * Main extension entry point - registers commands, views, and providers.
 */

import * as vscode from 'vscode';
import { WorkflowTreeProvider } from './tree-provider';
import { registerCommands } from './commands';
import { ExecutionController } from './execution-controller';

let executionController: ExecutionController | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('chainskills extension is now active');

    // Initialize execution controller
    executionController = new ExecutionController();
    context.subscriptions.push(executionController);

    // Register tree view provider
    const treeProvider = new WorkflowTreeProvider();
    const treeView = vscode.window.createTreeView('chainskillsWorkflows', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Register all commands
    registerCommands(context, treeProvider, executionController);

    // Auto-validate on save if enabled
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            const config = vscode.workspace.getConfiguration('chainskills');
            const autoValidate = config.get<boolean>('autoValidate', true);

            if (autoValidate && document.fileName.endsWith('.workflow.md')) {
                vscode.commands.executeCommand('chainskills.validateWorkflow', document.uri);
            }
        })
    );

    // Refresh workflows when workspace changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.workflow.md');
    watcher.onDidCreate(() => treeProvider.refresh());
    watcher.onDidDelete(() => treeProvider.refresh());
    watcher.onDidChange(() => treeProvider.refresh());
    context.subscriptions.push(watcher);

    // Set initial context keys
    vscode.commands.executeCommand('setContext', 'chainskills.isExecuting', false);
    vscode.commands.executeCommand('setContext', 'chainskills.isPaused', false);
}

export function deactivate() {
    if (executionController) {
        executionController.dispose();
    }
}
