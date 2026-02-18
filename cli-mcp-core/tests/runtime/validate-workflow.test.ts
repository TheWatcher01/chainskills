/**
 * Tests for validate-workflow use case.
 */

import { describe, it, expect } from 'vitest';
import { validateWorkflow } from '#core/use-cases/validate-workflow.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { Step } from '#core/entities/step.js';

/** Helper to build a minimal valid workflow. */
function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
    return {
        name: 'test-workflow',
        description: 'A test workflow',
        version: '0.1.0',
        steps: [],
        inputs: [],
        outputs: [],
        env: [],
        tags: [],
        metadata: {},
        ...overrides,
    };
}

/** Helper to build a step. */
function makeStep(overrides: Partial<Step> = {}): Step {
    return {
        id: 'step-1',
        title: 'Step 1',
        description: 'Do something',
        directives: [],
        ...overrides,
    };
}

describe('validateWorkflow', () => {
    it('should validate a minimal valid workflow', () => {
        const result = validateWorkflow(
            makeWorkflow({
                steps: [makeStep()],
            }),
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.valid).toBe(true);
            expect(result.value.diagnostics).toHaveLength(0);
        }
    });

    it('should error on missing name', () => {
        const result = validateWorkflow(makeWorkflow({ name: '' }));
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.valid).toBe(false);
            expect(result.value.diagnostics).toContainEqual(
                expect.objectContaining({ code: 'MISSING_NAME' }),
            );
        }
    });

    it('should error on missing version', () => {
        const result = validateWorkflow(makeWorkflow({ version: '' }));
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.valid).toBe(false);
            expect(result.value.diagnostics).toContainEqual(
                expect.objectContaining({ code: 'MISSING_VERSION' }),
            );
        }
    });

    it('should warn on missing description', () => {
        const result = validateWorkflow(makeWorkflow({ description: '' }));
        expect(result.ok).toBe(true);
        if (result.ok) {
            // Missing description is a warning, not an error
            expect(result.value.valid).toBe(true);
            expect(result.value.diagnostics).toContainEqual(
                expect.objectContaining({
                    code: 'MISSING_DESCRIPTION',
                    severity: 'warning',
                }),
            );
        }
    });

    it('should warn on no steps', () => {
        const result = validateWorkflow(makeWorkflow({ steps: [] }));
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.diagnostics).toContainEqual(
                expect.objectContaining({ code: 'NO_STEPS' }),
            );
        }
    });

    it('should error on duplicate step IDs', () => {
        const result = validateWorkflow(
            makeWorkflow({
                steps: [
                    makeStep({ id: 'same-id' }),
                    makeStep({ id: 'same-id' }),
                ],
            }),
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.valid).toBe(false);
            expect(result.value.diagnostics).toContainEqual(
                expect.objectContaining({ code: 'DUPLICATE_STEP_ID' }),
            );
        }
    });

    it('should warn on undeclared variable references', () => {
        const result = validateWorkflow(
            makeWorkflow({
                inputs: [{ name: 'target', type: 'string' }],
                steps: [
                    makeStep({
                        directives: [
                            {
                                type: 'call',
                                raw: '@call shell.exec($undeclared)',
                                args: {},
                            },
                        ],
                    }),
                ],
            }),
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.diagnostics).toContainEqual(
                expect.objectContaining({ code: 'UNDECLARED_VARIABLE' }),
            );
        }
    });

    it('should not warn on declared input variables', () => {
        const result = validateWorkflow(
            makeWorkflow({
                inputs: [{ name: 'target', type: 'string' }],
                steps: [
                    makeStep({
                        directives: [
                            {
                                type: 'call',
                                raw: '@call shell.exec($target)',
                                args: {},
                            },
                        ],
                    }),
                ],
            }),
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            const undeclaredWarnings = result.value.diagnostics.filter(
                (d) => d.code === 'UNDECLARED_VARIABLE',
            );
            expect(undeclaredWarnings).toHaveLength(0);
        }
    });

    it('should validate nested steps (children)', () => {
        const result = validateWorkflow(
            makeWorkflow({
                steps: [
                    makeStep({
                        id: 'parent',
                        children: [
                            makeStep({ id: 'child-1' }),
                            makeStep({ id: 'child-1' }), // duplicate
                        ],
                    }),
                ],
            }),
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.valid).toBe(false);
            expect(result.value.diagnostics).toContainEqual(
                expect.objectContaining({ code: 'DUPLICATE_STEP_ID' }),
            );
        }
    });
});
