/**
 * FoldingRangeProvider — fold :::parallel, :::if, :::for, :::try, :::workflow blocks
 * and step sections in .workflow.md files.
 */

import * as vscode from 'vscode';
import { parseWorkflowDocument } from './workflow-document';

export class WorkflowFoldingProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext,
        _token: vscode.CancellationToken
    ): vscode.FoldingRange[] {
        const parsed = parseWorkflowDocument(document);
        const ranges: vscode.FoldingRange[] = [];

        // Fold container blocks (:::parallel, :::if, etc.)
        for (const block of parsed.blocks) {
            if (block.endLine > block.startLine) {
                ranges.push(new vscode.FoldingRange(
                    block.startLine,
                    block.endLine,
                    vscode.FoldingRangeKind.Region
                ));
            }
        }

        // Fold step sections: from the heading to the line before the next heading (or EOF)
        const lineCount = document.lineCount;
        for (let i = 0; i < parsed.steps.length; i++) {
            const step = parsed.steps[i];
            const nextStepLine = i + 1 < parsed.steps.length
                ? parsed.steps[i + 1].line - 1
                : lineCount - 1;
            if (nextStepLine > step.line) {
                ranges.push(new vscode.FoldingRange(
                    step.line,
                    nextStepLine,
                    vscode.FoldingRangeKind.Region
                ));
            }
        }

        // Fold frontmatter block
        if (parsed.frontmatterEndLine > 0) {
            ranges.push(new vscode.FoldingRange(
                0,
                parsed.frontmatterEndLine,
                vscode.FoldingRangeKind.Region
            ));
        }

        return ranges;
    }
}
