/**
 * chainskills — public API surface.
 *
 * Re-exports the core domain types, use cases, and factory functions
 * for programmatic usage (as opposed to CLI).
 *
 * @module chainskills
 */

// ─── Core Entities ───────────────────────────────────────────────────────────
export type { Workflow, WorkflowMetadata } from '#core/entities/workflow.js';
export type { Step } from '#core/entities/step.js';
export type {
    Directive,
    DirectiveType,
} from '#core/entities/directive.js';
export {
    DIRECTIVE_TYPES,
    isDirectiveType,
} from '#core/entities/directive.js';
export type { Variable, InputDef, OutputDef } from '#core/entities/variable.js';

// ─── Core Ports ──────────────────────────────────────────────────────────────
export type { WorkflowParser } from '#core/ports/workflow-parser.port.js';
export type {
    WorkflowExecutor,
    ExecutionOptions,
    ExecutionResult,
    StepResult,
} from '#core/ports/workflow-executor.port.js';
export type { StateStore } from '#core/ports/state-store.port.js';
export type { ToolProvider } from '#core/ports/tool-provider.port.js';
export type {
    SkillResolver,
    ResolvedSkill,
} from '#core/ports/skill-resolver.port.js';

// ─── Core Use Cases ──────────────────────────────────────────────────────────
export { parseWorkflow } from '#core/use-cases/parse-workflow.js';
export {
    validateWorkflow,
    type ValidationReport,
    type ValidationDiagnostic,
} from '#core/use-cases/validate-workflow.js';
export {
    buildDAG,
    type DAGNode,
    type DAGNodeType,
    type DAG,
} from '#core/use-cases/build-dag.js';

// ─── Core Services ───────────────────────────────────────────────────────────
export {
    substituteVariables,
    extractVariables,
} from '#core/services/template-engine.js';
export { evaluateCondition } from '#core/services/condition-parser.js';

// ─── Infrastructure ──────────────────────────────────────────────────────────
export type {
    Result,
    Ok,
    Err,
    ParseError,
    ValidationError,
    ExecutionError,
    ResolveError,
    ToolError,
} from '#infra/errors.js';
export { ok, err } from '#infra/errors.js';
export { createLogger, type Logger, type LogLevel } from '#infra/logger.js';

// ─── Execution Events ────────────────────────────────────────────────────────
export {
    createEventEmitter,
    type ExecutionEvent,
    type ExecutionEventType,
    type ExecutionEventEmitter,
    type ExecutionEventHandler,
} from '#core/ports/execution-events.port.js';

// ─── Config ──────────────────────────────────────────────────────────────────
export { createContainer, type Container } from '#config/container.js';

// ─── Adapters (optional deep imports) ────────────────────────────────────────
export { createMastraExecutor } from '#adapters/executor/mastra-executor.js';
export type { MastraExecutorDeps } from '#adapters/executor/mastra-executor.js';
