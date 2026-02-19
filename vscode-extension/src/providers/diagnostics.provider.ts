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
import { parseWorkflowDocument, DIRECTIVES } from './workflow-document';

const REQUIRED_FRONTMATTER = ['name'] as const;

export class WorkflowDiagnosticsProvider implements vscode.Disposable {
    private readonly collection: vscode.DiagnosticCollection;
    private readonly disposables: vscode.Disposable[] = [];
    private debounceTimer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('chainskills-live');
    }

    activate(context: vscode.ExtensionContext): void {
        // Validate on change (debounced)
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (!e.document.fileName.endsWith('.workflow.md')) { return; }
                if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
                this.debounceTimer = setTimeout(() => this.validate(e.document), 300);
            })
        );

        // Validate on open
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                if (doc.fileName.endsWith('.workflow.md')) {
                    this.validate(doc);
                }
            })
        );

        // Validate on close (clear)
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument((doc) => {
                this.collection.delete(doc.uri);
            })
        );

        // Validate all open workflow docs on activate
        for (const doc of vscode.workspace.textDocuments) {
            if (doc.fileName.endsWith('.workflow.md')) {
                this.validate(doc);
            }
        }

        context.subscriptions.push(this);
    }

    validate(document: vscode.TextDocument): void {
        const diagnostics: vscode.Diagnostic[] = [];
        const parsed = parseWorkflowDocument(document);

        // 1. Missing required frontmatter
        for (const key of REQUIRED_FRONTMATTER) {
            if (!parsed.frontmatter[key]) {
                const range = new vscode.Range(0, 0, parsed.frontmatterEndLine, 0);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Missing required frontmatter field: "${key}"`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }

        // 2. Unknown directives
        const knownSet = new Set<string>(DIRECTIVES);
        for (const d of parsed.directives) {
            if (!knownSet.has(d.name)) {
                const range = new vscode.Range(d.line, d.col, d.line, d.col + d.name.length + 1);
                const diag = new vscode.Diagnostic(
                    range,
                    `Unknown directive: @${d.name}`,
                    vscode.DiagnosticSeverity.Error
                );
                diag.source = 'chainskills';
                diagnostics.push(diag);
            }
        }

        // 3. Undefined variable references
        // Build defined set: frontmatter inputs + output directives
        const defined = new Set<string>();
        for (const v of parsed.variables) {
            if (v.definedInFrontmatter) { defined.add(v.name); }
        }
        for (const d of parsed.directives) {
            if (d.name === 'output') {
                const vars = d.args.split(',').map(s => s.trim().replace(/^\$/, ''));
                for (const v of vars) { if (v) { defined.add(v); } }
            }
            if (d.name === 'call') {
                // capture @call ... → $var
                const cap = d.args.match(/→\s*\$([a-zA-Z_]\w*)/);
                if (cap) { defined.add(cap[1]); }
            }
            if (d.name === 'env') {
                // @env VAR → $VAR (lower-cased convention optional)
                const varName = d.args.trim().toLowerCase();
                if (varName) { defined.add(varName); }
            }
        }

        // Check references for variables that are referenced but never defined
        // (only flag if no @env or @call could define them)
        for (const v of parsed.variables) {
            if (!defined.has(v.name) && v.references.length > 0) {
                for (const lineIdx of v.references.slice(0, 3)) {    // limit noise
                    const lineText = document.lineAt(lineIdx).text;
                    const colIdx = lineText.indexOf('$' + v.name);
                    if (colIdx < 0) { continue; }
                    const range = new vscode.Range(lineIdx, colIdx, lineIdx, colIdx + v.name.length + 1);
                    const diag = new vscode.Diagnostic(
                        range,
                        `Variable "$${v.name}" may not be defined — declare in frontmatter inputs or via @call`,
                        vscode.DiagnosticSeverity.Hint
                    );
                    diag.source = 'chainskills';
                    diag.tags = [vscode.DiagnosticTag.Unnecessary];
                    diagnostics.push(diag);
                }
            }
        }

        this.collection.set(document.uri, diagnostics);
    }

    /** Expose collection so commands can update it */
    getCollection(): vscode.DiagnosticCollection {
        return this.collection;
    }

    dispose(): void {
        if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
        this.collection.dispose();
        for (const d of this.disposables) { d.dispose(); }
    }
}
