/**
 * chainskills VS Code Extension
 *
 * Main extension entry point - registers commands, views, and providers.
 * v0.5.0: IDE Language Features (CodeLens, Completion, Hover, Diagnostics, ...)
 */

import * as vscode from 'vscode';
import { WorkflowTreeProvider } from './tree-provider';
import { registerCommands } from './commands';
import { ExecutionController } from './execution-controller';
import { WorkflowStatusBar } from './views/status-bar';
import { WorkflowCodeLensProvider } from './providers/code-lens.provider';
import { WorkflowFoldingProvider } from './providers/folding.provider';
import { WorkflowDiagnosticsProvider } from './providers/diagnostics.provider';
import { WorkflowDocumentLinkProvider } from './providers/document-link.provider';
import { WorkflowCompletionProvider } from './providers/completion.provider';
import { WorkflowHoverProvider } from './providers/hover.provider';
import { WorkflowSymbolProvider } from './providers/symbols.provider';
import { WorkflowFileDecorationProvider } from './providers/file-decoration.provider';
import { invalidateCache } from './providers/workflow-document';

/** Selector covering .workflow.md as custom language AND plain markdown */
const WORKFLOW_SELECTOR: vscode.DocumentSelector = [
    { language: 'workflow-markdown' },
    { pattern: '**/*.workflow.md' },
];

let executionController: ExecutionController | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('chainskills extension is now active');

    // ── Core controllers ─────────────────────────────────────────────────────
    executionController = new ExecutionController();
    context.subscriptions.push(executionController);

    // ── Tree view ─────────────────────────────────────────────────────────────
    const treeProvider = new WorkflowTreeProvider();
    const treeView = vscode.window.createTreeView('chainskillsWorkflows', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // ── Status bar ────────────────────────────────────────────────────────────
    const statusBar = new WorkflowStatusBar();
    context.subscriptions.push(statusBar);

    // ── File decoration provider ──────────────────────────────────────────────
    const fileDecoration = new WorkflowFileDecorationProvider();
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(fileDecoration)
    );
    context.subscriptions.push(fileDecoration);

    // ── Diagnostics provider (live) ───────────────────────────────────────────
    const diagnostics = new WorkflowDiagnosticsProvider();
    diagnostics.activate(context);

    // ── Language feature providers ────────────────────────────────────────────
    const codeLensProvider = new WorkflowCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(WORKFLOW_SELECTOR, codeLensProvider)
    );

    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            WORKFLOW_SELECTOR,
            new WorkflowFoldingProvider()
        )
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(
            WORKFLOW_SELECTOR,
            new WorkflowDocumentLinkProvider()
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            WORKFLOW_SELECTOR,
            new WorkflowCompletionProvider(),
            '@', '$', ' '
        )
    );

    context.subscriptions.push(
        vscode.languages.registerHoverProvider(WORKFLOW_SELECTOR, new WorkflowHoverProvider())
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            WORKFLOW_SELECTOR,
            new WorkflowSymbolProvider()
        )
    );

    // ── Register commands ─────────────────────────────────────────────────────
    registerCommands(context, treeProvider, executionController);

    // ── Auto-validate on save & update decorations ────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (!document.fileName.endsWith('.workflow.md')) { return; }
            const config = vscode.workspace.getConfiguration('chainskills');
            const autoValidate = config.get<boolean>('autoValidate', true);
            if (autoValidate) {
                vscode.commands.executeCommand('chainskills.validateWorkflow', document.uri)
                    .then(() => {
                        const hasDiag = (diagnostics.getCollection().get(document.uri) ?? []).length > 0;
                        if (hasDiag) {
                            fileDecoration.setInvalid(document.uri);
                        } else {
                            fileDecoration.setValid(document.uri);
                        }
                    });
            }
        })
    );

    // ── Invalidate AST cache on change ─────────────────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.fileName.endsWith('.workflow.md')) {
                invalidateCache(e.document.uri);
                codeLensProvider.refresh();
            }
        })
    );

    // ── Show status bar when a workflow is open ───────────────────────────────
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.fileName.endsWith('.workflow.md')) {
                statusBar.showIdle(editor.document.uri);
            } else {
                statusBar.hide();
            }
        })
    );
    if (
        vscode.window.activeTextEditor &&
        vscode.window.activeTextEditor.document.fileName.endsWith('.workflow.md')
    ) {
        statusBar.showIdle(vscode.window.activeTextEditor.document.uri);
    }

    // ── File watcher ──────────────────────────────────────────────────────────
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.workflow.md');
    watcher.onDidCreate(() => treeProvider.refresh());
    watcher.onDidDelete(() => treeProvider.refresh());
    watcher.onDidChange(() => treeProvider.refresh());
    context.subscriptions.push(watcher);

    // ── Context keys ──────────────────────────────────────────────────────────
    vscode.commands.executeCommand('setContext', 'chainskills.isExecuting', false);
    vscode.commands.executeCommand('setContext', 'chainskills.isPaused', false);
}

export function deactivate() {
    if (executionController) {
        executionController.dispose();
    }
}

