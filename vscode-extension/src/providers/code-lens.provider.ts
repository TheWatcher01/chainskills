/**
 * CodeLensProvider — "▶ Run | 🔍 Validate | 📊 DAG" above each step heading
 *
 * Provides one lens group per step heading in .workflow.md files.
 */

import * as vscode from 'vscode';
import { parseWorkflowDocument } from './workflow-document';

export class WorkflowCodeLensProvider implements vscode.CodeLensProvider {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChange.event;

    refresh(): void {
        this._onDidChange.fire();
    }

    provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const parsed = parseWorkflowDocument(document);
        const lenses: vscode.CodeLens[] = [];

        // Global lens above frontmatter or first line
        const globalRange = new vscode.Range(0, 0, 0, 0);
        lenses.push(new vscode.CodeLens(globalRange, {
            title: '▶ Run',
            command: 'chainskills.runWorkflow',
            arguments: [document.uri],
            tooltip: 'Run this workflow',
        }));
        lenses.push(new vscode.CodeLens(globalRange, {
            title: '🔍 Validate',
            command: 'chainskills.validateWorkflow',
            arguments: [document.uri],
            tooltip: 'Validate this workflow',
        }));
        lenses.push(new vscode.CodeLens(globalRange, {
            title: '📊 Inspect DAG',
            command: 'chainskills.inspectWorkflow',
            arguments: [document.uri],
            tooltip: 'Show the workflow DAG',
        }));
        lenses.push(new vscode.CodeLens(globalRange, {
            title: '▷ Dry Run',
            command: 'chainskills.runWorkflowDryRun',
            arguments: [document.uri],
            tooltip: 'Dry-run this workflow (no side effects)',
        }));

        // Per-step lenses
        for (const step of parsed.steps) {
            const stepRange = new vscode.Range(step.line, 0, step.line, 0);
            lenses.push(new vscode.CodeLens(stepRange, {
                title: `▶ Run from "${step.name}"`,
                command: 'chainskills.runWorkflow',
                arguments: [document.uri, { fromStep: step.name }],
                tooltip: `Run from step: ${step.name}`,
            }));
        }

        return lenses;
    }
}
