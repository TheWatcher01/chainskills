/**
 * Workflow aggregate root.
 *
 * The `Workflow` interface is the central domain entity representing a fully
 * parsed `.workflow.md` file. It aggregates steps, variables, and metadata.
 *
 * @module core/entities/workflow
 */

import type { InputDef, OutputDef } from './variable.js';
import type { Step } from './step.js';

/**
 * Workflow metadata from frontmatter optional fields.
 */
export interface WorkflowMetadata {
    readonly author?: string;
    readonly license?: string;
    /** Minimum chainskills version required. */
    readonly minChainskills?: string;
    /** Arbitrary extra metadata. */
    readonly [key: string]: unknown;
}

/**
 * A complete parsed workflow — the aggregate root of the domain model.
 *
 * Constructed by the `WorkflowParser` port from a `.workflow.md` source string.
 * Consumed by the `WorkflowExecutor` port for execution.
 */
export interface Workflow {
    /** Workflow name (kebab-case, 1-64 chars). */
    readonly name: string;
    /** Human-readable description. */
    readonly description: string;
    /** Semantic version string. */
    readonly version: string;
    /** Ordered list of workflow steps. */
    readonly steps: readonly Step[];
    /** Declared input parameters. */
    readonly inputs: readonly InputDef[];
    /** Declared output parameters. */
    readonly outputs: readonly OutputDef[];
    /** Required environment variables. */
    readonly env: readonly string[];
    /** Categorization tags. */
    readonly tags: readonly string[];
    /** Additional metadata. */
    readonly metadata: WorkflowMetadata;
}
