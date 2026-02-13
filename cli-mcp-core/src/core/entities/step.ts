/**
 * Step entity.
 *
 * A Step is a discrete unit of work in a workflow, delimited by Markdown headings.
 * Each step contains natural-language instructions and zero or more directives.
 *
 * @module core/entities/step
 */

import type { Directive } from './directive.js';

/**
 * A single workflow step.
 *
 * Steps are identified by their Markdown heading and contain:
 * - A title (from the heading text)
 * - A description (body text between directives)
 * - An ordered list of directives (`@use`, `@call`, `@if`, etc.)
 * - Optional nested children for block directives (`@parallel`, `@if`)
 */
export interface Step {
    /** Unique identifier derived from the heading (kebab-case slug). */
    readonly id: string;
    /** Human-readable title from the Markdown heading. */
    readonly title: string;
    /** Natural-language description (body text, directives excluded). */
    readonly description: string;
    /** Ordered directives within this step. */
    readonly directives: readonly Directive[];
    /** Nested steps for block directives (`@parallel`, `@if`/`@else`). */
    readonly children?: readonly Step[];
}
