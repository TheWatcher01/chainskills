/**
 * Frontmatter parser adapter.
 *
 * Extracts and validates YAML frontmatter from `.workflow.md` files using
 * `gray-matter` for parsing and `zod` for schema validation.
 *
 * @module adapters/parser/frontmatter-parser
 */

import matter from 'gray-matter';
import { z } from 'zod';
import type { Result } from '#infra/errors.js';
import type { ParseError } from '#infra/errors.js';
import { ok, err, parseError } from '#infra/errors.js';
import type { InputDef, OutputDef } from '#core/entities/variable.js';
import type { WorkflowMetadata } from '#core/entities/workflow.js';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const InputDefSchema = z.object({
    name: z.string(),
    type: z.string().default('string'),
    description: z.string().optional(),
    required: z.boolean().optional(),
    default: z.unknown().optional(),
});

const OutputDefSchema = z.object({
    name: z.string(),
    type: z.string().default('string'),
    description: z.string().optional(),
});

const FrontmatterSchema = z.object({
    name: z.string().min(1, 'Workflow name is required'),
    description: z.string().default(''),
    version: z.string().default('0.1.0'),
    inputs: z.array(InputDefSchema).default([]),
    outputs: z.array(OutputDefSchema).default([]),
    env: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    author: z.string().optional(),
    license: z.string().optional(),
    minChainskills: z.string().optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

/** Parsed and validated frontmatter data. */
export interface WorkflowFrontmatter {
    readonly name: string;
    readonly description: string;
    readonly version: string;
    readonly inputs: readonly InputDef[];
    readonly outputs: readonly OutputDef[];
    readonly env: readonly string[];
    readonly tags: readonly string[];
    readonly metadata: WorkflowMetadata;
}

/** Result of parsing: frontmatter data + the remaining Markdown body. */
export interface FrontmatterResult {
    readonly frontmatter: WorkflowFrontmatter;
    readonly body: string;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse and validate frontmatter from a `.workflow.md` source string.
 *
 * @param source - Full `.workflow.md` content (YAML frontmatter + Markdown body).
 * @returns Validated `FrontmatterResult` or a `ParseError`.
 */
export function parseFrontmatter(
    source: string,
): Result<FrontmatterResult, ParseError> {
    // Extract raw frontmatter with gray-matter
    let parsed: matter.GrayMatterFile<string>;
    try {
        parsed = matter(source);
    } catch (e) {
        return err(
            parseError(
                'FRONTMATTER_PARSE_ERROR',
                `Failed to parse YAML frontmatter: ${e instanceof Error ? e.message : String(e)}`,
            ),
        );
    }

    // Validate with Zod
    const validation = FrontmatterSchema.safeParse(parsed.data);
    if (!validation.success) {
        const issues = validation.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        return err(
            parseError('FRONTMATTER_VALIDATION_ERROR', `Invalid frontmatter: ${issues}`),
        );
    }

    const data = validation.data;

    const frontmatter: WorkflowFrontmatter = {
        name: data.name,
        description: data.description,
        version: data.version,
        inputs: data.inputs as readonly InputDef[],
        outputs: data.outputs as readonly OutputDef[],
        env: data.env,
        tags: data.tags,
        metadata: {
            author: data.author,
            license: data.license,
            minChainskills: data.minChainskills,
        },
    };

    return ok({ frontmatter, body: parsed.content });
}
