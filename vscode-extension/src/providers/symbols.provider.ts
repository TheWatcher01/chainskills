/**
 * DocumentSymbolProvider — Outline: Workflow → Steps → Directives
 *
 * Provides a hierarchical outline for the Outline panel and breadcrumbs.
 */

import * as vscode from 'vscode';
import { parseWorkflowDocument } from './workflow-document';

export class WorkflowSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
        const parsed = parseWorkflowDocument(document);
        const lineCount = document.lineCount;
        const symbols: vscode.DocumentSymbol[] = [];

        // Top-level: Workflow metadata (frontmatter)
        if (parsed.frontmatterEndLine > 0) {
            const fmRange = new vscode.Range(0, 0, parsed.frontmatterEndLine, 0);
            const wfName = parsed.frontmatter.name || 'Workflow';
            const wfDesc = typeof parsed.frontmatter.description === 'string'
                ? parsed.frontmatter.description : '';
            const wfSymbol = new vscode.DocumentSymbol(
                wfName,
                wfDesc,
                vscode.SymbolKind.Module,
                fmRange,
                fmRange
            );
            symbols.push(wfSymbol);
        }

        // Steps
        for (let i = 0; i < parsed.steps.length; i++) {
            const step = parsed.steps[i];
            const nextLine = i + 1 < parsed.steps.length
                ? parsed.steps[i + 1].line - 1
                : lineCount - 1;
            const stepRange = new vscode.Range(step.line, 0, nextLine, 0);
            const nameRange = new vscode.Range(step.line, 0, step.line, document.lineAt(step.line).text.length);

            const stepSymbol = new vscode.DocumentSymbol(
                step.name,
                `${step.directives.length} directive(s)`,
                vscode.SymbolKind.Function,
                stepRange,
                nameRange
            );

            // Directives as children
            for (const d of step.directives) {
                const dRange = new vscode.Range(d.line, d.col, d.line, document.lineAt(d.line).text.length);
                const dSymbol = new vscode.DocumentSymbol(
                    `@${d.name}`,
                    d.args.slice(0, 60),
                    vscode.SymbolKind.Event,
                    dRange,
                    dRange
                );
                stepSymbol.children.push(dSymbol);
            }

            symbols.push(stepSymbol);
        }

        // Variables section (if any)
        if (parsed.variables.length > 0) {
            const lastLine = lineCount - 1;
            const varRange = new vscode.Range(0, 0, lastLine, 0);
            const varContainer = new vscode.DocumentSymbol(
                'Variables',
                `${parsed.variables.length} variable(s)`,
                vscode.SymbolKind.Namespace,
                varRange,
                varRange
            );
            for (const v of parsed.variables) {
                const refLine = v.references[0] ?? 0;
                const vRange = new vscode.Range(refLine, 0, refLine, 0);
                varContainer.children.push(new vscode.DocumentSymbol(
                    '$' + v.name,
                    v.definedInFrontmatter ? 'input' : `${v.references.length} refs`,
                    vscode.SymbolKind.Variable,
                    vRange,
                    vRange
                ));
            }
            symbols.push(varContainer);
        }

        return symbols;
    }
}
