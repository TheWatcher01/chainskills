/**
 * Workflow parser port — input port for parsing `.workflow.md` sources.
 *
 * The parser transforms raw Markdown+YAML source into the domain `Workflow` IR.
 * Implemented by the remark-based adapter in `src/adapters/parser/`.
 *
 * @module core/ports/workflow-parser
 */

import type { Result } from '#infra/errors.js';
import type { ParseError } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';

/**
 * Parses a `.workflow.md` source string into a `Workflow` entity.
 *
 * Synchronous — the remark adapter uses `processSync()`.
 */
export interface WorkflowParser {
    /** Parse raw Markdown source into a Workflow IR. */
    parse(source: string): Result<Workflow, ParseError>;
}
