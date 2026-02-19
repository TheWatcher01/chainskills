/**
 * FoldingRangeProvider — fold :::parallel, :::if, :::for, :::try, :::workflow blocks
 * and step sections in .workflow.md files.
 */
import * as vscode from 'vscode';
export declare class WorkflowFoldingProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(document: vscode.TextDocument, _context: vscode.FoldingContext, _token: vscode.CancellationToken): vscode.FoldingRange[];
}
