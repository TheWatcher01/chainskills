/**
 * Markdown parser adapter — build entry point for `./parser` export.
 *
 * Composes `unified` + `remark-parse` + `remark-directive` + custom plugins
 * into a complete `WorkflowParser` implementation.
 *
 * @module adapters/parser/markdown-parser
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import { VFile } from 'vfile';
import type { Result } from '#infra/errors.js';
import type { ParseError } from '#infra/errors.js';
import { ok, err, parseError } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { WorkflowParser } from '#core/ports/workflow-parser.port.js';
import {
    parseFrontmatter,
    type FrontmatterResult,
} from './frontmatter-parser.js';
import {
    remarkWorkflowPlugin,
    type WorkflowPluginData,
} from './remark-workflow-plugin.js';

/**
 * Create a `WorkflowParser` backed by unified/remark.
 *
 * @returns A `WorkflowParser` implementation.
 */
export function createMarkdownParser(): WorkflowParser {
    return {
        parse(source: string): Result<Workflow, ParseError> {
            return parseMarkdownWorkflow(source);
        },
    };
}

/**
 * Parse a `.workflow.md` source into a `Workflow` entity.
 *
 * Pipeline:
 * 1. Extract + validate YAML frontmatter (gray-matter + zod)
 * 2. Parse Markdown body into AST (unified + remark-parse + remark-directive)
 * 3. Extract steps and directives from AST (remarkWorkflowPlugin)
 * 4. Assemble into `Workflow` entity
 *
 * @param source - Raw `.workflow.md` content.
 * @returns Parsed `Workflow` or `ParseError`.
 */
export function parseMarkdownWorkflow(
    source: string,
): Result<Workflow, ParseError> {
    // Step 1: Parse frontmatter
    const fmResult: Result<FrontmatterResult, ParseError> =
        parseFrontmatter(source);
    if (!fmResult.ok) return fmResult;

    const { frontmatter, body } = fmResult.value;

    // Step 2+3: Parse Markdown body and extract steps
    const processor = unified()
        .use(remarkParse)
        .use(remarkDirective)
        .use(remarkWorkflowPlugin);

    let fileData: Record<string, unknown>;
    try {
        const tree = processor.parse(body);
        const vfile = new VFile(body);
        processor.runSync(tree, vfile);
        fileData = vfile.data as Record<string, unknown>;
    } catch (e) {
        return err(
            parseError(
                'MARKDOWN_PARSE_ERROR',
                `Failed to parse Markdown body: ${e instanceof Error ? e.message : String(e)}`,
            ),
        );
    }

    // Step 4: Assemble Workflow
    const pluginData = fileData['workflow'] as WorkflowPluginData | undefined;
    const steps = pluginData?.steps ?? [];

    const workflow: Workflow = {
        name: frontmatter.name,
        description: frontmatter.description,
        version: frontmatter.version,
        steps,
        inputs: frontmatter.inputs,
        outputs: frontmatter.outputs,
        env: frontmatter.env,
        tags: frontmatter.tags,
        metadata: frontmatter.metadata,
    };

    return ok(workflow);
}

// Default export for convenience
export default createMarkdownParser;
