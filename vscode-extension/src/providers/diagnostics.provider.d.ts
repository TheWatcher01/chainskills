/**
 * DiagnosticsProvider — live on-type validation for .workflow.md
 *
 * Detects:
 * - Missing required frontmatter fields
 * - Unknown directive names
 * - Undefined variable references
 * - Mismatched :::block delimiters
 */
import * as vscode from 'vscode';
export declare class WorkflowDiagnosticsProvider implements vscode.Disposable {
    private readonly collection;
    private readonly disposables;
    private debounceTimer;
    constructor();
    activate(context: vscode.ExtensionContext): void;
    validate(document: vscode.TextDocument): void;
    /** Expose collection so commands can update it */
    getCollection(): vscode.DiagnosticCollection;
    dispose(): void;
}
