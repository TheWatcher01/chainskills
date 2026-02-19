/**
 * CompletionItemProvider — autocomplete for .workflow.md
 *
 * Triggers:
 * - `@`  → all directive names with docs
 * - `$`  → all known variables from current doc
 * - `@call ` → common tool patterns
 * - frontmatter keys (when inside --- block)
 */

import * as vscode from 'vscode';
import { parseWorkflowDocument, DIRECTIVES, DIRECTIVE_DOCS } from './workflow-document';

const TOOL_PATTERNS = [
    'shell.exec',
    'shell.read',
    'shell.write',
    'mcp.tool_name',
];

const FRONTMATTER_KEYS = [
    { key: 'name', detail: 'Workflow name', insert: 'name: ' },
    { key: 'version', detail: 'Semantic version', insert: 'version: 1.0.0' },
    { key: 'description', detail: 'Short description', insert: 'description: ' },
    { key: 'author', detail: 'Author name', insert: 'author: ' },
    { key: 'inputs', detail: 'Input variables block', insert: 'inputs:\n  variable_name:\n    type: string\n    required: true' },
    { key: 'tools', detail: 'Tools required', insert: 'tools:\n  - shell' },
];

export class WorkflowCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        const line = document.lineAt(position.line).text;
        const prefix = line.slice(0, position.character);

        // Inside frontmatter
        const parsed = parseWorkflowDocument(document);
        const inFrontmatter = position.line < parsed.frontmatterEndLine;

        if (inFrontmatter) {
            return FRONTMATTER_KEYS.map(fk => {
                const item = new vscode.CompletionItem(fk.key, vscode.CompletionItemKind.Property);
                item.detail = fk.detail;
                item.insertText = new vscode.SnippetString(fk.insert);
                return item;
            });
        }

        // @call → tool suggestions
        if (/^@call\s+$/.test(prefix) || /^@call\s+[\w.]*$/.test(prefix)) {
            return TOOL_PATTERNS.map(tp => {
                const item = new vscode.CompletionItem(tp, vscode.CompletionItemKind.Function);
                item.detail = 'Tool pattern';
                item.insertText = new vscode.SnippetString(`${tp}($1) → $$2`);
                item.documentation = new vscode.MarkdownString('Invoke a tool and capture output');
                return item;
            });
        }

        // $ → variables
        if (prefix.endsWith('$')) {
            return parsed.variables.map(v => {
                const item = new vscode.CompletionItem('$' + v.name, vscode.CompletionItemKind.Variable);
                item.insertText = v.name;
                item.detail = v.definedInFrontmatter ? 'input variable' : 'variable';
                item.documentation = new vscode.MarkdownString(
                    v.definedInFrontmatter
                        ? `Declared in frontmatter \`inputs\``
                        : `Referenced ${v.references.length} time(s)`
                );
                return item;
            });
        }

        // @ → directives
        if (prefix.endsWith('@') || /^@[\w-]*$/.test(prefix.trimStart())) {
            return DIRECTIVES.map((name) => {
                const item = new vscode.CompletionItem('@' + name, vscode.CompletionItemKind.Keyword);
                item.insertText = name;
                item.filterText = '@' + name;
                item.detail = 'chainskills directive';
                item.documentation = new vscode.MarkdownString(DIRECTIVE_DOCS[name]);
                // Sort: common ones first
                item.sortText = (['use', 'call', 'if', 'for', 'assert'].includes(name) ? '0' : '1') + name;
                return item;
            });
        }

        return [];
    }
}
