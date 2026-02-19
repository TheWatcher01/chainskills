/**
 * WorkflowDocument — per-document AST cache
 *
 * Parses .workflow.md files using regex and provides
 * structured access to steps, directives, variables,
 * and imports. Used by all language feature providers.
 */
import * as vscode from 'vscode';
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
export declare const DIRECTIVES: readonly ["use", "call", "if", "else", "for", "repeat", "parallel", "try", "on-error", "assert", "output", "workflow", "env", "agent", "handoff", "breakpoint"];
export type DirectiveName = typeof DIRECTIVES[number];
export declare const DIRECTIVE_DOCS: Record<DirectiveName, string>;
export declare function parseWorkflowDocument(document: vscode.TextDocument): ParsedWorkflow;
export declare function invalidateCache(uri: vscode.Uri): void;
