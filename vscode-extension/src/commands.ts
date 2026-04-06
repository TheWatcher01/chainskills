/**
 * Command Handlers for chainskills extension
 * 
 * Registers all VS Code commands and implements their logic.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { WorkflowTreeProvider } from './tree-provider';
import { ExecutionController } from './execution-controller';

const execAsync = promisify(exec);

export function registerCommands(
    context: vscode.ExtensionContext,
    treeProvider: WorkflowTreeProvider,
    executionController: ExecutionController
) {
    // Run workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.runWorkflow', async (uri?: vscode.Uri) => {
            const workflowUri = uri || await getActiveWorkflowUri();
            if (!workflowUri) {
                return;
            }
            await runWorkflow(workflowUri, false, executionController);
        })
    );

    // Run workflow (dry run)
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.runWorkflowDryRun', async (uri?: vscode.Uri) => {
            const workflowUri = uri || await getActiveWorkflowUri();
            if (!workflowUri) {
                return;
            }
            await runWorkflow(workflowUri, true, executionController);
        })
    );

    // Validate workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.validateWorkflow', async (uri?: vscode.Uri) => {
            const workflowUri = uri || await getActiveWorkflowUri();
            if (!workflowUri) {
                return;
            }
            await validateWorkflow(workflowUri);
        })
    );

    // Inspect workflow DAG
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.inspectWorkflow', async (uri?: vscode.Uri) => {
            const workflowUri = uri || await getActiveWorkflowUri();
            if (!workflowUri) {
                return;
            }
            await inspectWorkflow(workflowUri);
        })
    );

    // Execution control commands
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.pauseExecution', () => {
            executionController.pause();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.resumeExecution', () => {
            executionController.resume();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.stopExecution', () => {
            executionController.cancel();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.stepExecution', () => {
            executionController.step();
        })
    );

    // Browse templates
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.openTemplates', async () => {
            await openTemplates();
        })
    );

    // Refresh workflows view
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.refreshWorkflows', () => {
            treeProvider.refresh();
        })
    );

    // Replay workflow with different model
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.replayWorkflow', async () => {
            const model = await vscode.window.showInputBox({ prompt: 'Model for replay (e.g., ollama/qwen3.5:9b)', placeHolder: 'gpt-4o-mini' });
            if (!model) { return; }
            const traceFile = await vscode.window.showOpenDialog({ filters: { 'JSONL Traces': ['jsonl'] }, canSelectMany: false });
            if (!traceFile || traceFile.length === 0) { return; }
            await runCliCommand(`replay "${traceFile[0].fsPath}" --model ${model} --json`);
        })
    );

    // Bench workflow across models
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.benchWorkflow', async (uri?: vscode.Uri) => {
            const workflowUri = uri || await getActiveWorkflowUri();
            if (!workflowUri) { return; }
            const models = await vscode.window.showInputBox({ prompt: 'Models (comma-separated)', placeHolder: 'opus,sonnet,haiku' });
            if (!models) { return; }
            await runCliCommand(`bench "${workflowUri.fsPath}" --models ${models} --runs 3 --json`);
        })
    );

    // Distill traces to fine-tuning data
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.distillTraces', async () => {
            const traceFile = await vscode.window.showOpenDialog({ filters: { 'JSONL Traces': ['jsonl'] }, canSelectMany: false });
            if (!traceFile || traceFile.length === 0) { return; }
            await runCliCommand(`distill "${traceFile[0].fsPath}" --json`);
        })
    );

    // Arena — blind model comparison
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.arenaWorkflow', async (uri?: vscode.Uri) => {
            const workflowUri = uri || await getActiveWorkflowUri();
            if (!workflowUri) { return; }
            const models = await vscode.window.showInputBox({ prompt: 'Models for arena (comma-separated, min 2)', placeHolder: 'opus,sonnet' });
            if (!models) { return; }
            await runCliCommand(`arena "${workflowUri.fsPath}" --models ${models} --rounds 3`);
        })
    );

    // Generate workflow variants
    context.subscriptions.push(
        vscode.commands.registerCommand('chainskills.generateVariants', async (uri?: vscode.Uri) => {
            const workflowUri = uri || await getActiveWorkflowUri();
            if (!workflowUri) { return; }
            await runCliCommand(`generate --template "${workflowUri.fsPath}" --variations 3 --json`);
        })
    );
}

async function runCliCommand(cliArgs: string) {
    const config = vscode.workspace.getConfiguration('chainskills');
    const cliPath = config.get<string>('cliPath', 'chainskills');
    const outputChannel = vscode.window.createOutputChannel('chainskills');
    outputChannel.show();
    outputChannel.appendLine(`Running: ${cliPath} ${cliArgs}`);

    try {
        const { stdout, stderr } = await execAsync(`${cliPath} ${cliArgs}`);
        if (stdout) { outputChannel.append(stdout); }
        if (stderr) { outputChannel.append(stderr); }
        vscode.window.showInformationMessage('Command completed');
    } catch (error: any) {
        outputChannel.appendLine(`Error: ${error.message}`);
        vscode.window.showErrorMessage(`Command failed: ${error.message}`);
    }
}

async function getActiveWorkflowUri(): Promise<vscode.Uri | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.fileName.endsWith('.workflow.md')) {
        return editor.document.uri;
    }

    vscode.window.showErrorMessage('No workflow file open in active editor');
    return undefined;
}

async function runWorkflow(uri: vscode.Uri, dryRun: boolean, controller: ExecutionController) {
    const config = vscode.workspace.getConfiguration('chainskills');
    const cliPath = config.get<string>('cliPath', 'chainskills');
    const executor = config.get<string>('executor', 'mastra');

    const args = ['run', uri.fsPath, '--format=vscode'];
    if (dryRun) {
        args.push('--dry-run');
    }

    const outputChannel = vscode.window.createOutputChannel('chainskills');
    outputChannel.show();
    outputChannel.appendLine(`Running: ${cliPath} ${args.join(' ')}`);

    const env = {
        ...process.env,
        CHAINSKILLS_EXECUTOR: executor
    };

    try {
        const process = exec(`${cliPath} ${args.join(' ')}`, { env });
        controller.setProcess(process);

        process.stdout?.on('data', (data: string) => {
            outputChannel.append(data);
        });

        process.stderr?.on('data', (data: string) => {
            outputChannel.append(data);
        });

        process.on('close', (code: number) => {
            controller.setProcess(undefined);
            if (code === 0) {
                vscode.window.showInformationMessage('Workflow executed successfully');
            } else {
                vscode.window.showErrorMessage(`Workflow execution failed (exit code ${code})`);
            }
        });
    } catch (error) {
        controller.setProcess(undefined);
        vscode.window.showErrorMessage(`Failed to run workflow: ${error}`);
    }
}

async function validateWorkflow(uri: vscode.Uri) {
    const config = vscode.workspace.getConfiguration('chainskills');
    const cliPath = config.get<string>('cliPath', 'chainskills');

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('chainskills');

    try {
        const { stdout, stderr } = await execAsync(`${cliPath} validate "${uri.fsPath}" --format=vscode`);

        // Parse VS Code format errors
        const diagnostics: vscode.Diagnostic[] = [];
        const lines = (stdout + stderr).split('\n').filter(Boolean);

        for (const line of lines) {
            const match = line.match(/^(.+):(\d+):(\d+):\s+(error|warning):\s+(.+)$/);
            if (match) {
                const [, , lineNum, colNum, severity, message] = match;
                const range = new vscode.Range(
                    parseInt(lineNum) - 1, parseInt(colNum) - 1,
                    parseInt(lineNum) - 1, 100
                );
                const diagnostic = new vscode.Diagnostic(
                    range,
                    message,
                    severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
                );
                diagnostics.push(diagnostic);
            }
        }

        diagnosticCollection.set(uri, diagnostics);

        if (diagnostics.length === 0) {
            vscode.window.showInformationMessage('✓ Workflow is valid');
        } else {
            const errorCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
            const warnCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
            vscode.window.showWarningMessage(
                `Validation: ${errorCount} error(s), ${warnCount} warning(s)`
            );
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Validation failed: ${error.message}`);
    }
}

async function inspectWorkflow(uri: vscode.Uri) {
    const config = vscode.workspace.getConfiguration('chainskills');
    const cliPath = config.get<string>('cliPath', 'chainskills');

    const outputChannel = vscode.window.createOutputChannel('chainskills DAG');
    outputChannel.show();

    try {
        const { stdout } = await execAsync(`${cliPath} inspect "${uri.fsPath}"`);
        outputChannel.clear();
        outputChannel.appendLine('DAG Visualization:');
        outputChannel.appendLine('');
        outputChannel.append(stdout);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to inspect workflow: ${error.message}`);
    }
}

async function openTemplates() {
    const templates = [
        { label: '$(code) Code Review', value: 'dev/code-review.workflow.md' },
        { label: '$(beaker) TDD Cycle', value: 'dev/tdd-cycle.workflow.md' },
        { label: '$(search) Domain Recon (OSINT)', value: 'osint/domain-recon.workflow.md' },
        { label: '$(shield) Vulnerability Scan', value: 'cybersec/vuln-scan.workflow.md' },
        { label: '$(file) Grant Application', value: 'ess/grant-application.workflow.md' }
    ];

    const selection = await vscode.window.showQuickPick(templates, {
        placeHolder: 'Select a workflow template'
    });

    if (selection) {
        const config = vscode.workspace.getConfiguration('chainskills');
        const templatesPath = config.get<string>('templatesPath', '');

        if (templatesPath) {
            const templatePath = path.join(templatesPath, selection.value);
            const uri = vscode.Uri.file(templatePath);
            vscode.commands.executeCommand('vscode.open', uri);
        } else {
            vscode.window.showInformationMessage(
                'Set chainskills.templatesPath in settings to browse templates'
            );
        }
    }
}
