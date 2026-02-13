/**
 * Variable-related value objects.
 *
 * Represents workflow variables (`$name`), input declarations, and output declarations
 * from the frontmatter and directive bodies.
 *
 * @module core/entities/variable
 */

/** A workflow variable reference (e.g. `$target`, `$report`). */
export interface Variable {
    /** Variable name **without** the `$` prefix. */
    readonly name: string;
    /** Optional declared type constraint. */
    readonly type?: 'string' | 'number' | 'boolean' | 'list' | 'object';
    /** Optional default or resolved value. */
    readonly value?: unknown;
}

/** Input declaration from frontmatter `inputs:` field. */
export interface InputDef {
    readonly name: string;
    readonly type: string;
    readonly description?: string;
    readonly required?: boolean;
    readonly default?: unknown;
}

/** Output declaration from frontmatter `outputs:` field. */
export interface OutputDef {
    readonly name: string;
    readonly type: string;
    readonly description?: string;
}
