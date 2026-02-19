/**
 * WorkflowDocument — per-document AST cache
 *
 * Parses .workflow.md files using regex and provides
 * structured access to steps, directives, variables,
 * and imports. Used by all language feature providers.
 */

import * as vscode from 'vscode';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowStep {
    name: string;
    /** 0-based line of the ## heading */
    line: number;
    /** All directives within this step */
    directives: WorkflowDirective[];
}

export interface WorkflowDirective {
    /** Directive name: "use", "call", "if", "for", etc. */
    name: string;
    /** Raw arguments string */
    args: string;
    /** 0-based line */
    line: number;
    /** 0-based column of the '@' */
    col: number;
}

export interface WorkflowVariable {
    /** Name without the '$' prefix */
    name: string;
    /** Defined in frontmatter inputs block */
    definedInFrontmatter: boolean;
    /** All 0-based lines where this variable is referenced */
    references: number[];
}

export interface WorkflowImport {
    /** Path or name used in @use / @workflow */
    path: string;
    directive: 'use' | 'workflow';
    line: number;
    /** character range of the path in the line */
    range: vscode.Range;
}

export interface WorkflowFrontmatter {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    inputs?: Record<string, unknown>;
    tools?: string[];
    [key: string]: unknown;
}

export interface ParsedWorkflow {
    frontmatter: WorkflowFrontmatter;
    /** 0-based line where frontmatter ends (---) */
    frontmatterEndLine: number;
    steps: WorkflowStep[];
    directives: WorkflowDirective[];
    variables: WorkflowVariable[];
    imports: WorkflowImport[];
    /** Container directive blocks (:::parallel, :::if, etc.) */
    blocks: WorkflowBlock[];
}

export interface WorkflowBlock {
    /** type: parallel, if, for, try, workflow */
    type: string;
    /** 0-based line of the opening ::: token */
    startLine: number;
    /** 0-based line of the closing ::: token */
    endLine: number;
}

// ─── Known directives ─────────────────────────────────────────────────────────

export const DIRECTIVES = [
    'use', 'call', 'if', 'else', 'for', 'repeat',
    'parallel', 'try', 'on-error', 'assert', 'output',
    'workflow', 'env', 'agent', 'handoff', 'breakpoint'
] as const;

export type DirectiveName = typeof DIRECTIVES[number];

export const DIRECTIVE_DOCS: Record<DirectiveName, string> = {
    use: 'Import a skill, tool, or agent\n\n`@use pdf-processing`',
    call: 'Call a tool and capture the result\n\n`@call tool.method($input) → $output`',
    if: 'Conditional branching\n\n`@if $score > 50:`',
    else: 'Else branch for @if\n\n`@else:`',
    for: 'Bounded iteration\n\n`@for $item in $list:`',
    repeat: 'Loop with stop condition\n\n`@repeat max:5 until $valid == true:`',
    parallel: 'Run steps in parallel\n\n`@parallel:`',
    try: 'Error handling block\n\n`@try:`',
    'on-error': 'Handler for @try errors\n\n`@on-error: log and continue`',
    assert: 'Validation checkpoint\n\n`@assert $budget.total == $budget.charges`',
    output: 'Declare workflow output variables\n\n`@output: $report, $score`',
    workflow: 'Reference or define a sub-workflow\n\n`@workflow validate-budget:`',
    env: 'Read an environment variable\n\n`@env API_KEY`',
    agent: 'Delegate to an AI agent\n\n`@agent copilot: "Fix this bug"`',
    handoff: 'Transfer control to another agent\n\n`@handoff review-agent: "Review the changes"`',
    breakpoint: 'Conditional breakpoint\n\n`@breakpoint $count > 5`',
};

// ─── Regex patterns ───────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const DIRECTIVE_RE = /^(@[\w-]+)([ \t]+(.*))?$/;
const VARIABLE_REF_RE = /\$([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g;
const CONTAINER_OPEN_RE = /^:::([\w-]+)(?:\s+(.*))?$/;

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { version: number; parsed: ParsedWorkflow }>();

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseWorkflowDocument(document: vscode.TextDocument): ParsedWorkflow {
    const key = document.uri.toString();
    const cached = cache.get(key);
    if (cached && cached.version === document.version) {
        return cached.parsed;
    }

    const parsed = _parse(document);
    cache.set(key, { version: document.version, parsed });
    return parsed;
}

export function invalidateCache(uri: vscode.Uri): void {
    cache.delete(uri.toString());
}

function _parse(document: vscode.TextDocument): ParsedWorkflow {
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const frontmatter: WorkflowFrontmatter = {};
    let frontmatterEndLine = 0;

    // Parse frontmatter
    const fmMatch = text.match(FRONTMATTER_RE);
    if (fmMatch) {
        const raw = fmMatch[1];
        // Count lines to find end
        const fmLines = fmMatch[0].split('\n');
        frontmatterEndLine = fmLines.length - 1;
        // Simple YAML key: value extraction
        for (const line of raw.split('\n')) {
            const kv = line.match(/^(\w+)\s*:\s*(.*)$/);
            if (kv) {
                const [, key, val] = kv;
                (frontmatter as Record<string, unknown>)[key] = val.trim();
            }
        }
    }

    const steps: WorkflowStep[] = [];
    const allDirectives: WorkflowDirective[] = [];
    const imports: WorkflowImport[] = [];
    const blocks: WorkflowBlock[] = [];
    const varMap = new Map<string, WorkflowVariable>();

    const blockStack: Array<{ type: string; startLine: number }> = [];
    let currentStep: WorkflowStep | null = null;
    let inFrontmatter = false;
    let fmClosed = false;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();

        // Track frontmatter
        if (i === 0 && line === '---') { inFrontmatter = true; continue; }
        if (inFrontmatter && line === '---') { inFrontmatter = false; fmClosed = true; continue; }
        if (inFrontmatter) continue;

        // Container block open :::type [args]
        const containerOpen = line.match(CONTAINER_OPEN_RE);
        if (containerOpen) {
            blockStack.push({ type: containerOpen[1], startLine: i });
            continue;
        }

        // Container block close :::
        if (line === ':::' && blockStack.length > 0) {
            const b = blockStack.pop()!;
            blocks.push({ type: b.type, startLine: b.startLine, endLine: i });
            continue;
        }

        // Step heading (## or ###)
        if (/^#{2,}/.test(line)) {
            const m = line.match(/^#+\s+(.+)/);
            if (m) {
                currentStep = { name: m[1], line: i, directives: [] };
                steps.push(currentStep);
            }
            continue;
        }

        // Directive line
        const dirMatch = line.match(DIRECTIVE_RE);
        if (dirMatch) {
            const dRaw = dirMatch[1].slice(1).toLowerCase();
            const args = (dirMatch[3] || '').trim();
            const col = raw.indexOf('@');

            const directive: WorkflowDirective = {
                name: dRaw,
                args,
                line: i,
                col: col >= 0 ? col : 0,
            };
            allDirectives.push(directive);
            if (currentStep) currentStep.directives.push(directive);

            // Track imports
            if (dRaw === 'use' || dRaw === 'workflow') {
                const pathMatch = args.match(/^(["']?)([^"'\s]+)\1/);
                if (pathMatch) {
                    const p = pathMatch[2];
                    const colStart = raw.indexOf(p);
                    imports.push({
                        path: p,
                        directive: dRaw as 'use' | 'workflow',
                        line: i,
                        range: new vscode.Range(i, colStart, i, colStart + p.length),
                    });
                }
            }
        }

        // Variable references in this line
        let m: RegExpExecArray | null;
        VARIABLE_REF_RE.lastIndex = 0;
        while ((m = VARIABLE_REF_RE.exec(raw)) !== null) {
            const vname = m[1];
            if (!varMap.has(vname)) {
                varMap.set(vname, {
                    name: vname,
                    definedInFrontmatter: false,
                    references: [],
                });
            }
            varMap.get(vname)!.references.push(i);
        }
    }

    // Mark variables defined in frontmatter inputs
    const inputsMatch = text.match(/^inputs:\s*\n((?:[ \t]+.+\n?)*)/m);
    if (inputsMatch) {
        const inputLines = inputsMatch[1].split('\n');
        for (const il of inputLines) {
            const km = il.match(/^\s+(\w+)\s*:/);
            if (km) {
                const vname = km[1];
                if (varMap.has(vname)) {
                    varMap.get(vname)!.definedInFrontmatter = true;
                } else {
                    varMap.set(vname, { name: vname, definedInFrontmatter: true, references: [] });
                }
            }
        }
    }

    return {
        frontmatter,
        frontmatterEndLine: fmClosed ? frontmatterEndLine : 0,
        steps,
        directives: allDirectives,
        variables: Array.from(varMap.values()),
        imports,
        blocks,
    };
}
