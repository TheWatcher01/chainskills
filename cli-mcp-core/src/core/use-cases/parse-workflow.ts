/**
 * Parse workflow use case.
 *
 * Orchestrates the parsing of a raw `.workflow.md` source string into
 * a validated `Workflow` domain entity.
 *
 * @module core/use-cases/parse-workflow
 */

import type { Result } from '#infra/errors.js';
import type { ParseError } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { WorkflowParser } from '#core/ports/workflow-parser.port.js';

/**
 * Parse a raw `.workflow.md` source into a `Workflow` entity.
 *
 * Delegates to the injected `WorkflowParser` port and performs
 * basic structural validation on the result.
 *
 * @param source - Raw Markdown+YAML source string.
 * @param parser - Injected parser implementation.
 * @returns Parsed `Workflow` or a `ParseError`.
 */
export function parseWorkflow(
    source: string,
    parser: WorkflowParser,
): Result<Workflow, ParseError> {
    return parser.parse(source);
}
