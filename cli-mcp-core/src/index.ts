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
export type {
    AgentProvider,
    AgentInvokeOptions,
    AgentResult,
    AgentError,
    AgentMessage,
} from '#core/ports/agent-provider.port.js';

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
export {
    runWorkflow,
    describeWorkflow,
    type SDKError,
    type RunWorkflowResult,
    type WorkflowDescription,
} from '#core/use-cases/run-workflow.js';

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
export { ok, err, isOk, isErr, map, flatMap, mapErr, unwrapOr, unwrapOrElse, match } from '#infra/errors.js';
export { createLogger, type Logger, type LogLevel } from '#infra/logger.js';

// ─── Execution Events ────────────────────────────────────────────────────────
export { createEventEmitter } from '#infra/event-emitter.js';
export type {
    ExecutionEvent,
    ExecutionEventType,
    ExecutionEventEmitter,
    ExecutionEventHandler,
} from '#core/ports/execution-events.port.js';

// ─── Config ──────────────────────────────────────────────────────────────────
export { createContainer, type Container } from '#config/container.js';

// ─── Adapters (optional deep imports) ────────────────────────────────────────
export { createMastraExecutor } from '#adapters/executor/mastra-executor.js';
export type { MastraExecutorDeps } from '#adapters/executor/mastra-executor.js';
export { createMcpServer } from '#adapters/tools/mcp-server.js';
export type { McpServerConfig } from '#adapters/tools/mcp-server.js';
export { createOpenAIAgent, createNoopAgent } from '#adapters/agents/openai-agent.js';
export type { OpenAIAgentConfig } from '#adapters/agents/openai-agent.js';
export { createMcpClientProvider } from '#adapters/tools/mcp-client.js';
export type { McpClientConfig, McpServerEntry } from '#adapters/tools/mcp-client.js';
export { createCompositeToolProvider } from '#adapters/tools/composite-tool-provider.js';

// ─── Persistence & History ──────────────────────────────────────────────────
export type { PersistenceStore, Row } from '#core/ports/persistence.port.js';
export { createSqlitePersistence } from '#adapters/state/sqlite-persistence.js';
export type { RunHistory, RunRecord, RunEventRecord } from '#core/ports/run-history.port.js';
export { createNoopRunHistory } from '#core/ports/run-history.port.js';
export { createSqliteRunHistory } from '#adapters/state/sqlite-run-history.js';

// ─── Snapshots ──────────────────────────────────────────────────────────────
export type { SnapshotManager, SnapshotRecord } from '#core/ports/snapshot-manager.port.js';
export { createSqliteSnapshotManager } from '#adapters/state/sqlite-snapshot-manager.js';

// ─── Rules & Reflection ─────────────────────────────────────────────────────
export type { RulesStore, LearnedRule } from '#core/ports/rules-store.port.js';
export { createSqliteRulesStore } from '#adapters/state/sqlite-rules-store.js';
export type { ReflectionEngine, ReflectionResult, ReflectionRule } from '#core/services/reflection-engine.js';
export { createReflectionEngine } from '#core/services/reflection-engine.js';
export { formatRulesAsContext, getApplicableRules, checkAdmissibility } from '#core/services/rules-applicator.js';

// ─── Schema Validation ──────────────────────────────────────────────────────
export type { SchemaDefinition, ValidationIssue, SchemaValidator } from '#core/ports/schema-validator.port.js';
export { createSchemaValidator } from '#core/services/schema-validator.js';

// ─── Workflow Integrity ─────────────────────────────────────────────────────
export { computeWorkflowHash, verifyWorkflowIntegrity } from '#core/services/workflow-integrity.js';
export type { WorkflowStatus, RunStats } from '#core/entities/workflow.js';

// ─── Agent Pool ─────────────────────────────────────────────────────────────
export type { AgentPool, AgentTask, AgentTaskResult } from '#core/ports/agent-pool.port.js';
export { createAgentPool } from '#adapters/agents/agent-pool.js';

// ─── Context Isolation ──────────────────────────────────────────────────────
export { createIsolatedContext, mergeContextResults } from '#core/services/context-isolator.js';
