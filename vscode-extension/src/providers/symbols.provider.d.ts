/**
 * DocumentSymbolProvider — Outline: Workflow → Steps → Directives
 *
 * Provides a hierarchical outline for the Outline panel and breadcrumbs.
 */
import * as vscode from 'vscode';
export declare class WorkflowSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.DocumentSymbol[];
}
