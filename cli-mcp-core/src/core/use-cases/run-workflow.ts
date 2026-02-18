/**
 * High-level SDK API for workflow execution and introspection.
 *
 * Provides `runWorkflow()` and `describeWorkflow()` as programmatic entry
 * points — used by the MCP server, the `--json` CLI mode, and third-party
 * integrations.
 *
 * @module core/use-cases/run-workflow
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Result } from '#infra/errors.js';
import { ok, err } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';
import type {
    ExecutionResult,
    ExecutionOptions,
} from '#core/ports/workflow-executor.port.js';
import {
    validateWorkflow,
    type ValidationReport,
} from '#core/use-cases/validate-workflow.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';
import { buildDAG, type DAG } from '#core/use-cases/build-dag.js';
import type { Container } from '#config/container.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Combined error type for the SDK API. */
export interface SDKError {
    readonly code: string;
    readonly message: string;
    readonly phase: 'read' | 'parse' | 'validate' | 'execute';
    readonly details?: unknown;
}

/** Full execution result from the SDK. */
export interface RunWorkflowResult {
    readonly workflow: {
        readonly name: string;
        readonly version: string;
        readonly steps: number;
    };
    readonly execution: ExecutionResult;
    readonly duration: number;
}

/** Workflow description for introspection. */
export interface WorkflowDescription {
    readonly name: string;
    readonly description: string;
    readonly version: string;
    readonly inputs: ReadonlyArray<{
        readonly name: string;
        readonly type: string;
        readonly required?: boolean;
        readonly description?: string;
        readonly default?: unknown;
    }>;
    readonly outputs: ReadonlyArray<{
        readonly name: string;
        readonly type: string;
        readonly description?: string;
    }>;
    readonly env: readonly string[];
    readonly tags: readonly string[];
    readonly steps: ReadonlyArray<{
        readonly id: string;
        readonly title: string;
        readonly directives: number;
    }>;
    readonly dag: DAG | null;
    readonly validation: ValidationReport;
    readonly metadata: Record<string, unknown>;
}

// ─── SDK Functions ───────────────────────────────────────────────────────────

/**
 * Read a workflow file from the filesystem.
 *
 * @param path - Absolute or relative path to the `.workflow.md` file.
 * @returns The source string or an error.
 */
function readWorkflowFile(path: string): Result<string, SDKError> {
    try {
        const absolutePath = resolve(path);
        const source = readFileSync(absolutePath, 'utf-8');
        return ok(source);
    } catch (e) {
        return err({
            code: 'FILE_NOT_FOUND',
            message: `Cannot read workflow file: ${path}. ${e instanceof Error ? e.message : String(e)}`,
            phase: 'read',
        });
    }
}

/**
 * Parse and validate a workflow source string.
 *
 * @param source - Raw `.workflow.md` content.
 * @param container - DI container with parser.
 * @returns Parsed and validated workflow or an error.
 */
function parseAndValidate(
    source: string,
    container: Container,
): Result<{ workflow: Workflow; validation: ValidationReport }, SDKError> {
    const parseResult = parseWorkflow(source, container.parser);
    if (!parseResult.ok) {
        return err({
            code: parseResult.error.code,
            message: parseResult.error.message,
            phase: 'parse',
            details: { line: parseResult.error.line, column: parseResult.error.column },
        });
    }

    const validationResult = validateWorkflow(parseResult.value);
    if (!validationResult.ok) {
        return err({
            code: validationResult.error.code,
            message: validationResult.error.message,
            phase: 'validate',
        });
    }

    return ok({ workflow: parseResult.value, validation: validationResult.value });
}

/**
 * Run a workflow from a file path.
 *
 * Orchestrates: read → parse → validate → execute.
 *
 * @param path - Path to the `.workflow.md` file.
 * @param container - Wired DI container.
 * @param options - Execution options.
 * @returns Full execution result or an SDK error.
 */
export async function runWorkflow(
    path: string,
    container: Container,
    options?: {
        readonly inputs?: Record<string, unknown>;
        readonly dryRun?: boolean;
    },
): Promise<Result<RunWorkflowResult, SDKError>> {
    const startTime = Date.now();

    // Read
    const sourceResult = readWorkflowFile(path);
    if (!sourceResult.ok) return sourceResult;

    // Parse + validate
    const pvResult = parseAndValidate(sourceResult.value, container);
    if (!pvResult.ok) return pvResult;
    const { workflow, validation } = pvResult.value;

    // Check validation
    if (!validation.valid) {
        return err({
            code: 'VALIDATION_FAILED',
            message: `Workflow has ${validation.diagnostics.filter((d) => d.severity === 'error').length} validation error(s)`,
            phase: 'validate',
            details: { diagnostics: validation.diagnostics },
        });
    }

    // Execute
    const execOptions: ExecutionOptions = {
        dryRun: options?.dryRun ?? false,
    };

    const execResult = await container.executor.execute(
        workflow,
        options?.inputs ?? {},
        execOptions,
    );

    if (!execResult.ok) {
        return err({
            code: execResult.error.code,
            message: execResult.error.message,
            phase: 'execute',
            details: { stepId: execResult.error.stepId },
        });
    }

    return ok({
        workflow: {
            name: workflow.name,
            version: workflow.version,
            steps: workflow.steps.length,
        },
        execution: execResult.value,
        duration: Date.now() - startTime,
    });
}

/**
 * Describe a workflow — introspect structure without executing.
 *
 * @param path - Path to the `.workflow.md` file.
 * @param container - Wired DI container.
 * @returns Full workflow description or an SDK error.
 */
export async function describeWorkflow(
    path: string,
    container: Container,
): Promise<Result<WorkflowDescription, SDKError>> {
    // Read
    const sourceResult = readWorkflowFile(path);
    if (!sourceResult.ok) return sourceResult;

    // Parse + validate
    const pvResult = parseAndValidate(sourceResult.value, container);
    if (!pvResult.ok) return pvResult;
    const { workflow, validation } = pvResult.value;

    // Build DAG (best effort)
    let dag: DAG | null = null;
    const dagResult = buildDAG(workflow);
    if (dagResult.ok) {
        dag = dagResult.value;
    }

    return ok({
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        inputs: workflow.inputs,
        outputs: workflow.outputs,
        env: workflow.env,
        tags: workflow.tags,
        steps: workflow.steps.map((s) => ({
            id: s.id,
            title: s.title,
            directives: s.directives.length,
        })),
        dag,
        validation,
        metadata: workflow.metadata as Record<string, unknown>,
    });
}
