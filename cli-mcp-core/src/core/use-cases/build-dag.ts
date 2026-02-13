/**
 * Build DAG use case — transforms a Workflow into a directed acyclic graph.
 *
 * Analyzes variable dependencies between steps, identifies parallel opportunities,
 * and produces a structured DAG with support for sequential, parallel, branch,
 * loop, and try-catch node types.
 *
 * @module core/use-cases/build-dag
 */

import type { Result } from '#infra/errors.js';
import type { ValidationError } from '#infra/errors.js';
import { ok, err, validationError } from '#infra/errors.js';
import type { Workflow } from '#core/entities/workflow.js';
import type { Step } from '#core/entities/step.js';
import { extractVariables } from '#core/services/template-engine.js';

// ─── DAG Node Types ──────────────────────────────────────────────────────────

/** The structural type of a DAG node. */
export type DAGNodeType =
    | 'sequential'
    | 'parallel'
    | 'branch'
    | 'loop'
    | 'try-catch';

/** A node in the execution DAG. */
export interface DAGNode {
    /** Step ID this node represents. */
    readonly stepId: string;
    /** Steps that must complete before this node can execute. */
    readonly dependencies: readonly string[];
    /** Structural type of this node. */
    readonly type: DAGNodeType;
    /** Condition expression for branch/loop nodes. */
    readonly condition?: string;
    /** Iterable expression for loop nodes (@for). */
    readonly iterable?: string;
    /** Loop variable name for @for nodes. */
    readonly loopVariable?: string;
    /** Maximum iterations for @repeat nodes. */
    readonly maxIterations?: number;
    /** Loop mode: 'for' (iterate list), 'until' (repeat until condition), 'while' (repeat while condition). */
    readonly loopMode?: 'for' | 'until' | 'while';
    /** Child nodes (for parallel, branch, loop, try-catch blocks). */
    readonly children?: readonly DAGNode[];
    /** Else branch nodes (for @if/@else). */
    readonly elseBranch?: readonly DAGNode[];
    /** Fallback nodes (for @try/@on-error). */
    readonly fallback?: readonly DAGNode[];
    /** Variables produced by this node (via @call → $capture). */
    readonly produces: readonly string[];
    /** Variables consumed by this node (via $variable references). */
    readonly consumes: readonly string[];
    /** Concurrency limit for parallel/foreach execution. */
    readonly concurrency?: number;
}

/** A directed acyclic graph for workflow execution. */
export interface DAG {
    /** All nodes in execution order. */
    readonly nodes: readonly DAGNode[];
    /** IDs of nodes with no dependencies (execution starts here). */
    readonly entryPoints: readonly string[];
    /** Parallelizable groups — nodes that can run concurrently. */
    readonly parallelGroups: readonly (readonly string[])[];
}

// ─── Variable Analysis ───────────────────────────────────────────────────────

/** Variables produced and consumed by a step. */
interface StepVariables {
    readonly produces: readonly string[];
    readonly consumes: readonly string[];
}

/**
 * Analyze a step's directives to determine which variables it produces and consumes.
 */
function analyzeStepVariables(step: Step): StepVariables {
    const produces = new Set<string>();
    const consumes = new Set<string>();

    for (const directive of step.directives) {
        // Capture variables from @call → $capture
        if (directive.type === 'call') {
            const capture = directive.args['capture'];
            if (typeof capture === 'string') {
                produces.add(capture.startsWith('$') ? capture.slice(1) : capture);
            }
            // Input variables consumed
            const input = String(directive.args['input'] ?? '');
            for (const v of extractVariables(input)) {
                consumes.add(v);
            }
        }

        // Variables in conditions (@if, @assert)
        if (directive.type === 'if' || directive.type === 'assert') {
            const condition = String(
                directive.args['condition'] ?? directive.args['expression'] ?? '',
            );
            for (const v of extractVariables(condition)) {
                consumes.add(v);
            }
        }

        // Variables in @for iterable
        if (directive.type === 'for') {
            const iterable = String(directive.args['iterable'] ?? '');
            for (const v of extractVariables(iterable)) {
                consumes.add(v);
            }
        }

        // Variables in @repeat until condition
        if (directive.type === 'repeat') {
            const until = String(directive.args['until'] ?? '');
            for (const v of extractVariables(until)) {
                consumes.add(v);
            }
        }

        // @output variables consumed
        if (directive.type === 'output') {
            const variables = directive.args['variables'];
            if (Array.isArray(variables)) {
                for (const v of variables) {
                    const name = String(v).startsWith('$')
                        ? String(v).slice(1)
                        : String(v);
                    consumes.add(name);
                }
            }
        }

        // Variables in raw text
        const rawVars = extractVariables(directive.raw);
        for (const v of rawVars) {
            if (!produces.has(v)) {
                consumes.add(v);
            }
        }
    }

    // Also scan description for variable references
    for (const v of extractVariables(step.description)) {
        consumes.add(v);
    }

    // Remove self-produced from consumed
    for (const p of produces) {
        consumes.delete(p);
    }

    return {
        produces: [...produces],
        consumes: [...consumes],
    };
}

// ─── DAG Node Builders ───────────────────────────────────────────────────────

/**
 * Detect block directives in a step and determine the node type.
 */
function detectNodeType(step: Step): DAGNodeType {
    for (const d of step.directives) {
        if (d.type === 'parallel') return 'parallel';
        if (d.type === 'if') return 'branch';
        if (d.type === 'for' || d.type === 'repeat') return 'loop';
        if (d.type === 'try') return 'try-catch';
    }
    return 'sequential';
}

/**
 * Extract loop metadata from a step's directives.
 */
function extractLoopMeta(
    step: Step,
): Pick<DAGNode, 'loopMode' | 'iterable' | 'loopVariable' | 'maxIterations' | 'condition' | 'concurrency'> {
    for (const d of step.directives) {
        if (d.type === 'for') {
            const variable = String(d.args['variable'] ?? '');
            const iterable = String(d.args['iterable'] ?? '');
            const concurrency = d.args['concurrency'];
            return {
                loopMode: 'for',
                loopVariable: variable.startsWith('$') ? variable.slice(1) : variable,
                iterable: iterable.startsWith('$') ? iterable.slice(1) : iterable,
                concurrency: typeof concurrency === 'number' ? concurrency : undefined,
            };
        }
        if (d.type === 'repeat') {
            const max = d.args['max'];
            const until = d.args['until'];
            const whileCond = d.args['while'];
            return {
                loopMode: until ? 'until' : 'while',
                maxIterations: typeof max === 'number' ? max : 10,
                condition: String(until ?? whileCond ?? ''),
            };
        }
    }
    return {};
}

/**
 * Extract branch metadata from a step's directives.
 */
function extractBranchCondition(step: Step): string | undefined {
    for (const d of step.directives) {
        if (d.type === 'if') {
            return String(d.args['condition'] ?? '');
        }
    }
    return undefined;
}

/**
 * Build a DAGNode for a single step, including children for block directives.
 */
function buildNodeForStep(
    step: Step,
    dependencies: readonly string[],
    vars: StepVariables,
): DAGNode {
    const nodeType = detectNodeType(step);

    const baseNode: DAGNode = {
        stepId: step.id,
        dependencies,
        type: nodeType,
        produces: vars.produces,
        consumes: vars.consumes,
    };

    // Build children from step.children if present
    const childNodes: DAGNode[] = [];
    if (step.children && step.children.length > 0) {
        for (const child of step.children) {
            const childVars = analyzeStepVariables(child);
            childNodes.push(
                buildNodeForStep(child, [step.id], childVars),
            );
        }
    }

    switch (nodeType) {
        case 'parallel':
            return {
                ...baseNode,
                children: childNodes.length > 0
                    ? childNodes.map((c) => ({ ...c, dependencies: [] }))
                    : undefined,
            };

        case 'branch': {
            const condition = extractBranchCondition(step);
            // Split children into if-branch and else-branch
            const elseIdx = step.directives.findIndex((d) => d.type === 'else');
            let elseBranch: DAGNode[] | undefined;
            let ifChildren = childNodes;

            if (elseIdx >= 0 && childNodes.length > 1) {
                const midpoint = Math.ceil(childNodes.length / 2);
                ifChildren = childNodes.slice(0, midpoint);
                elseBranch = childNodes.slice(midpoint);
            }

            return {
                ...baseNode,
                condition,
                children: ifChildren.length > 0 ? ifChildren : undefined,
                elseBranch: elseBranch && elseBranch.length > 0 ? elseBranch : undefined,
            };
        }

        case 'loop': {
            const loopMeta = extractLoopMeta(step);
            return {
                ...baseNode,
                ...loopMeta,
                children: childNodes.length > 0 ? childNodes : undefined,
            };
        }

        case 'try-catch': {
            const onErrorIdx = step.directives.findIndex((d) => d.type === 'on-error');
            let tryChildren = childNodes;
            let fallbackChildren: DAGNode[] | undefined;

            if (onErrorIdx >= 0 && childNodes.length > 1) {
                const midpoint = Math.ceil(childNodes.length / 2);
                tryChildren = childNodes.slice(0, midpoint);
                fallbackChildren = childNodes.slice(midpoint);
            }

            return {
                ...baseNode,
                children: tryChildren.length > 0 ? tryChildren : undefined,
                fallback:
                    fallbackChildren && fallbackChildren.length > 0
                        ? fallbackChildren
                        : undefined,
            };
        }

        default:
            return {
                ...baseNode,
                children: childNodes.length > 0 ? childNodes : undefined,
            };
    }
}

// ─── Cycle Detection ─────────────────────────────────────────────────────────

/**
 * Detect cycles in the dependency graph using DFS.
 *
 * @returns Array of node IDs forming a cycle, or empty array if acyclic.
 */
function detectCycles(nodes: readonly DAGNode[]): readonly string[] {
    const adjacency = new Map<string, readonly string[]>();
    for (const node of nodes) {
        adjacency.set(node.stepId, node.dependencies);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(nodeId: string, path: string[]): string[] | null {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        path.push(nodeId);

        const deps = adjacency.get(nodeId) ?? [];
        for (const dep of deps) {
            if (!visited.has(dep)) {
                const cycle = dfs(dep, [...path]);
                if (cycle) return cycle;
            } else if (recursionStack.has(dep)) {
                return [...path, dep];
            }
        }

        recursionStack.delete(nodeId);
        return null;
    }

    for (const node of nodes) {
        if (!visited.has(node.stepId)) {
            const cycle = dfs(node.stepId, []);
            if (cycle) return cycle;
        }
    }

    return [];
}

// ─── Auto-Parallelization ────────────────────────────────────────────────────

/**
 * Group nodes that can be executed in parallel based on their dependencies.
 *
 * Uses topological level assignment: nodes at the same level can run concurrently.
 */
function computeParallelGroups(nodes: readonly DAGNode[]): (readonly string[])[] {
    if (nodes.length === 0) return [];

    const nodeMap = new Map(nodes.map((n) => [n.stepId, n]));
    const levels = new Map<string, number>();

    function getLevel(nodeId: string): number {
        if (levels.has(nodeId)) return levels.get(nodeId)!;

        const node = nodeMap.get(nodeId);
        if (!node || node.dependencies.length === 0) {
            levels.set(nodeId, 0);
            return 0;
        }

        const maxDepLevel = Math.max(
            ...node.dependencies.map((dep) => getLevel(dep)),
        );
        const level = maxDepLevel + 1;
        levels.set(nodeId, level);
        return level;
    }

    for (const node of nodes) {
        getLevel(node.stepId);
    }

    // Group by level
    const groups = new Map<number, string[]>();
    for (const [nodeId, level] of levels) {
        if (!groups.has(level)) groups.set(level, []);
        groups.get(level)!.push(nodeId);
    }

    const sortedLevels = [...groups.keys()].sort((a, b) => a - b);
    return sortedLevels
        .map((level) => groups.get(level)!)
        .filter((group) => group.length > 0);
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Build an execution DAG from a workflow.
 *
 * Performs variable dependency analysis, auto-parallelization detection,
 * cycle detection, and structured node construction for all directive types.
 *
 * @param workflow - Parsed workflow entity.
 * @returns A structured DAG with dependency information and parallel groups.
 */
export function buildDAG(
    workflow: Workflow,
): Result<DAG, ValidationError> {
    if (workflow.steps.length === 0) {
        return ok({ nodes: [], entryPoints: [], parallelGroups: [] });
    }

    // Analyze variables for each step
    const stepVars = new Map<string, StepVariables>();
    for (const step of workflow.steps) {
        stepVars.set(step.id, analyzeStepVariables(step));
    }

    // Build dependency graph based on variable flow
    const nodes: DAGNode[] = [];
    const producerMap = new Map<string, string>();

    // Track inputs as already "produced"
    for (const input of workflow.inputs) {
        producerMap.set(input.name, '__input__');
    }

    for (const step of workflow.steps) {
        const vars = stepVars.get(step.id)!;

        // Determine dependencies based on consumed variables
        const dependencies = new Set<string>();
        for (const consumed of vars.consumes) {
            const producer = producerMap.get(consumed);
            if (producer && producer !== '__input__') {
                dependencies.add(producer);
            }
        }

        const node = buildNodeForStep(step, [...dependencies], vars);
        nodes.push(node);

        // Register produced variables
        for (const produced of vars.produces) {
            producerMap.set(produced, step.id);
        }
    }

    // Detect cycles
    const cycle = detectCycles(nodes);
    if (cycle.length > 0) {
        return err(
            validationError(
                'CYCLE_DETECTED',
                `Circular dependency detected: ${cycle.join(' → ')}`,
            ),
        );
    }

    // Compute entry points
    const entryPoints = nodes
        .filter((n) => n.dependencies.length === 0)
        .map((n) => n.stepId);

    // Compute parallel groups
    const parallelGroups = computeParallelGroups(nodes);

    return ok({ nodes, entryPoints, parallelGroups });
}
