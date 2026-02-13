/**
 * Build DAG use case — stub for MVP.
 *
 * Transforms a `Workflow` into a DAG (directed acyclic graph) execution plan.
 * In the MVP, this simply returns a sequential plan. The Mastra DAG builder
 * will be implemented in v0.2.0.
 *
 * @module core/use-cases/build-dag
 */

import type { Result } from '#infra/errors.js';
import type { ValidationError } from '#infra/errors.js';
import { ok } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';

/** A node in the execution DAG. */
export interface DAGNode {
    readonly stepId: string;
    readonly dependencies: readonly string[];
}

/** A directed acyclic graph for workflow execution. */
export interface DAG {
    readonly nodes: readonly DAGNode[];
    readonly entryPoints: readonly string[];
}

/**
 * Build an execution DAG from a workflow.
 *
 * **MVP stub**: returns a simple sequential chain where each step
 * depends on the previous one.
 *
 * @param workflow - Parsed workflow entity.
 * @returns A sequential DAG.
 */
export function buildDAG(
    workflow: Workflow,
): Result<DAG, ValidationError> {
    const nodes: DAGNode[] = workflow.steps.map((step, index) => ({
        stepId: step.id,
        dependencies: index > 0 ? [workflow.steps[index - 1]!.id] : [],
    }));

    const entryPoints =
        nodes.length > 0 ? [nodes[0]!.stepId] : [];

    return ok({ nodes, entryPoints });
}
