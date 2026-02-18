/**
 * Barrel export for the core domain layer.
 *
 * Re-exports all entities, ports, services, and use cases.
 *
 * @module core
 */

// Entities
export {
    DIRECTIVE_TYPES,
    isDirectiveType,
} from './entities/index.js';
export type {
    Variable,
    InputDef,
    OutputDef,
    DirectiveType,
    Directive,
    Step,
    Workflow,
    WorkflowMetadata,
} from './entities/index.js';

// Ports
export type {
    WorkflowParser,
    WorkflowExecutor,
    ExecutionOptions,
    ExecutionResult,
    StepResult,
    StateStore,
    SkillResolver,
    ResolvedSkill,
    ToolProvider,
    WorkflowRegistry,
    RegistryEntry,
    RegistrySearchResult,
} from './ports/index.js';

// Services
export {
    substituteVariables,
    extractVariables,
} from './services/index.js';
export { evaluateCondition } from './services/index.js';

// Use Cases
export { parseWorkflow } from './use-cases/index.js';
export {
    validateWorkflow,
    type ValidationReport,
    type ValidationDiagnostic,
} from './use-cases/index.js';
export { buildDAG, type DAG, type DAGNode } from './use-cases/index.js';
export {
    resolveImports,
    type ResolvedWorkflow,
} from './use-cases/index.js';
