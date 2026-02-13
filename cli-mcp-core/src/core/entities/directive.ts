/**
 * Directive value object.
 *
 * Represents a single `@` directive parsed from a `.workflow.md` file.
 * Directives are the control-flow primitives of the chainskills language.
 *
 * @module core/entities/directive
 */

/**
 * All supported directive types in the chainskills workflow format.
 *
 * Each maps to an `@` keyword in the Markdown source:
 * - `@use`      → import a skill, tool, or agent
 * - `@call`     → invoke a tool method with capture
 * - `@if/@else` → conditional branching
 * - `@for`      → bounded iteration
 * - `@repeat`   → loop with stop condition
 * - `@parallel` → parallel execution block
 * - `@try`      → error handling block
 * - `@on-error` → error handler within `@try`
 * - `@assert`   → validation checkpoint
 * - `@output`   → declare workflow output
 * - `@workflow`  → inline sub-workflow
 * - `@env`      → environment variable reference
 * - `@agent`    → delegate to an AI agent
 * - `@handoff`  → transfer to another agent
 */
export type DirectiveType =
    | 'use'
    | 'call'
    | 'if'
    | 'else'
    | 'for'
    | 'repeat'
    | 'parallel'
    | 'try'
    | 'on-error'
    | 'assert'
    | 'output'
    | 'workflow'
    | 'env'
    | 'agent'
    | 'handoff';

/** All valid directive type values as a readonly set for runtime validation. */
export const DIRECTIVE_TYPES: ReadonlySet<string> = new Set<DirectiveType>([
    'use',
    'call',
    'if',
    'else',
    'for',
    'repeat',
    'parallel',
    'try',
    'on-error',
    'assert',
    'output',
    'workflow',
    'env',
    'agent',
    'handoff',
]);

/**
 * A single parsed directive from a workflow step.
 *
 * @example
 * ```ts
 * const d: Directive = {
 *   type: 'call',
 *   raw: '@call shell.exec($command) → $result',
 *   args: { tool: 'shell', method: 'exec', input: '$command', capture: '$result' },
 * };
 * ```
 */
export interface Directive {
    /** The directive type (discriminant). */
    readonly type: DirectiveType;
    /** The raw source text of the directive line. */
    readonly raw: string;
    /** Parsed arguments — structure varies by directive type. */
    readonly args: Readonly<Record<string, unknown>>;
}

/** Type guard: checks whether a string is a valid `DirectiveType`. */
export function isDirectiveType(value: string): value is DirectiveType {
    return DIRECTIVE_TYPES.has(value);
}
