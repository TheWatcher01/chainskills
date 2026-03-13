/**
 * Validate workflow use case.
 *
 * Performs semantic validation on a parsed `Workflow`:
 * - Unique step IDs
 * - Variables referenced in directives are declared in `inputs`
 * - No unknown directive types
 * - Required frontmatter fields present
 *
 * @module core/use-cases/validate-workflow
 */

import type { Result } from '#infra/errors.js';
import type { ValidationError } from '#infra/errors.js';
import { ok, err, validationError } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { Step } from '#core/entities/step.js';
import { isDirectiveType } from '#core/entities/directive.js';
import { extractVariables } from '#core/services/template-engine.js';

/** A single validation diagnostic. */
export interface ValidationDiagnostic {
    readonly severity: 'error' | 'warning';
    readonly code: string;
    readonly message: string;
    readonly stepId?: string;
}

/** Full validation report for a workflow. */
export interface ValidationReport {
    readonly valid: boolean;
    readonly diagnostics: readonly ValidationDiagnostic[];
}

/**
 * Validate a parsed workflow for semantic correctness.
 *
 * @param workflow - A parsed `Workflow` entity.
 * @returns A `ValidationReport` with diagnostics, or a `ValidationError` if the
 *          workflow structure is fundamentally broken.
 */
export function validateWorkflow(
    workflow: Workflow,
): Result<ValidationReport, ValidationError> {
    const diagnostics: ValidationDiagnostic[] = [];

    // ── Required fields ───────────────────────────────────────────────────
    if (!workflow.name || workflow.name.trim().length === 0) {
        diagnostics.push({
            severity: 'error',
            code: 'MISSING_NAME',
            message: 'Workflow name is required',
        });
    }

    if (!workflow.description || workflow.description.trim().length === 0) {
        diagnostics.push({
            severity: 'warning',
            code: 'MISSING_DESCRIPTION',
            message: 'Workflow description is recommended',
        });
    }

    if (!workflow.version || workflow.version.trim().length === 0) {
        diagnostics.push({
            severity: 'error',
            code: 'MISSING_VERSION',
            message: 'Workflow version is required',
        });
    }

    // ── Validation Lifecycle ────────────────────────────────────────────
    if (workflow.metadata.status === 'deprecated') {
        diagnostics.push({
            severity: 'warning',
            code: 'DEPRECATED_WORKFLOW',
            message: 'This workflow is marked as deprecated and should not be used in production',
        });
    }

    // ── Steps ─────────────────────────────────────────────────────────────
    if (workflow.steps.length === 0) {
        diagnostics.push({
            severity: 'warning',
            code: 'NO_STEPS',
            message: 'Workflow has no steps',
        });
    }

    // Unique step IDs
    const stepIds = new Set<string>();
    const allSteps = flattenSteps(workflow.steps);

    for (const step of allSteps) {
        if (stepIds.has(step.id)) {
            diagnostics.push({
                severity: 'error',
                code: 'DUPLICATE_STEP_ID',
                message: `Duplicate step ID: "${step.id}"`,
                stepId: step.id,
            });
        }
        stepIds.add(step.id);
    }

    // ── Directives ────────────────────────────────────────────────────────
    const declaredInputs = new Set(workflow.inputs.map((i) => i.name));
    const declaredEnv = new Set(workflow.env);

    for (const step of allSteps) {
        for (const directive of step.directives) {
            // Unknown directive type
            if (!isDirectiveType(directive.type)) {
                diagnostics.push({
                    severity: 'error',
                    code: 'UNKNOWN_DIRECTIVE',
                    message: `Unknown directive type: "@${directive.type}"`,
                    stepId: step.id,
                });
            }

            // Check variable references
            const vars = extractVariables(directive.raw);
            for (const v of vars) {
                if (!declaredInputs.has(v) && !stepIds.has(v)) {
                    // Variable might be set by a previous @call capture — warn, don't error
                    diagnostics.push({
                        severity: 'warning',
                        code: 'UNDECLARED_VARIABLE',
                        message: `Variable "$${v}" is not declared in inputs — ensure it's set at runtime`,
                        stepId: step.id,
                    });
                }
            }

            // @env references
            if (
                directive.type === 'env' &&
                typeof directive.args['name'] === 'string'
            ) {
                const envName = directive.args['name'];
                if (!declaredEnv.has(envName)) {
                    diagnostics.push({
                        severity: 'warning',
                        code: 'UNDECLARED_ENV',
                        message: `Environment variable "${envName}" is referenced but not declared in frontmatter env[]`,
                        stepId: step.id,
                    });
                }
            }
        }
    }

    const hasErrors = diagnostics.some((d) => d.severity === 'error');

    if (hasErrors && diagnostics.length > 50) {
        return err(
            validationError(
                'TOO_MANY_ERRORS',
                `Validation produced ${diagnostics.length} diagnostics — workflow may be malformed`,
            ),
        );
    }

    return ok({
        valid: !hasErrors,
        diagnostics,
    });
}

/**
 * Flatten nested steps into a single array.
 */
function flattenSteps(steps: readonly Step[]): readonly Step[] {
    const result: Step[] = [];
    for (const step of steps) {
        result.push(step);
        if (step.children) {
            result.push(...flattenSteps(step.children));
        }
    }
    return result;
}
