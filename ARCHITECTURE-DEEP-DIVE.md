# ChainSkills Architecture Deep Dive

**Date:** 2026-03-27  
**Scope:** Complete exploration of cli-mcp-core codebase after v0.6.0 (pre-v0.7.0 debug/test phase)  
**Status:** Planning phase — comprehensive analysis of all extension points

---

## 1. EXECUTION EVENT FLOW ARCHITECTURE

### 1.1 Event System Overview

**Locations:**
- Port: `cli-mcp-core/src/core/ports/execution-events.port.ts` (156 lines)
- Implementation: `cli-mcp-core/src/infrastructure/event-emitter.ts` (43 lines)

**Key Insight:** Synchronous, callback-based event emitter — lightweight, no Node.js EventEmitter dependency.

#### Event Type Hierarchy

```
ExecutionEventType:
  'workflow:start'       → WorkflowStartEvent (workflowName, totalSteps, dryRun)
  'workflow:end'         → WorkflowEndEvent (workflowName, success, duration, outputs?)
  'step:start'           → StepStartEvent (stepId, stepTitle, stepIndex, totalSteps)
  'step:end'             → StepEndEvent (stepId, success, duration, error?)
  'step:skip'            → StepSkipEvent (stepId, reason)
  'directive:start'      → DirectiveStartEvent (stepId, directiveType, raw)
  'directive:end'        → DirectiveEndEvent (stepId, directiveType, success, result?)
  'parallel:start'       → ParallelStartEvent (stepIds: string[])
  'parallel:end'         → ParallelEndEvent (results, duration)
  'loop:iteration'       → LoopIterationEvent (stepId, index, total?, item?)
  'error'                → ErrorEvent (stepId?, message, code?)
```

#### Data Carried by Each Event

| Event Type | Critical Data | Usage in CLI |
|-----------|---------------|-------------|
| `step:start` | `stepIndex, totalSteps, stepTitle` | "Step 3/10: Fetch Data" |
| `step:end` | `success, duration, error?` | "✓ completed (245ms)" or "✗ failed: timeout" |
| `directive:start` | `directiveType, raw` | "@shell — npm install..." |
| `parallel:start/end` | `stepIds[], duration` | "═══ parallel start (4 branches)" |
| `loop:iteration` | `index, total` | "↻ iteration 3/5" |
| `error` | `message, stepId?, code?` | "⚡ error: timeout" |

#### Event Emission Flow

```
SimpleExecutor.execute()
├─ emit('workflow:start')
├─ for each step:
│  ├─ emit('step:start')
│  ├─ for each directive:
│  │  ├─ emit('directive:start')
│  │  ├─ executeDirective()
│  │  └─ emit('directive:end', success/error)
│  └─ emit('step:end', success/error)
└─ emit('workflow:end')
```

#### CLI Event Subscription

**File:** `cli-mcp-core/src/cli/run.ts` lines 246-304

The event emitter is subscribed by the CLI to produce human-readable output:

```typescript
container.emitter.on((event: ExecutionEvent) => {
    switch (event.type) {
        case 'step:start':
            console.log(pc.cyan(`  ▸ Step ${event.stepIndex + 1}/${event.totalSteps}: ${event.stepTitle}`));
            break;
        case 'step:end':
            if (event.success) {
                console.log(pc.green(`    ✓ completed`) + pc.dim(` (${event.duration}ms)`));
            }
            break;
        // ... more cases
    }
});
```

---

## 2. AGENT ADAPTER PATTERN

### 2.1 Agent Provider Port

**File:** `cli-mcp-core/src/core/ports/agent-provider.port.ts` (88 lines)

The port defines a unified interface for LLM invocation:

```typescript
interface AgentProvider {
    invoke(options: AgentInvokeOptions): Promise<Result<AgentResult, AgentError>>;
    has(agent: string): boolean;
    list(): string[];
}

interface AgentInvokeOptions {
    agent: string;              // agent ID ("copilot", "reviewer", etc.)
    prompt: string;             // task description
    systemPrompt?: string;      // override system instructions
    messages?: AgentMessage[];  // conversation history (multi-turn)
    maxTokens?: number;
    temperature?: number;
    variables?: Record<string, unknown>;  // workflow vars injected into context
}

interface AgentResult {
    content: string;
    usage?: { promptTokens, completionTokens, totalTokens };
    model?: string;
}
```

### 2.2 OpenAI-Compatible Implementation

**File:** `cli-mcp-core/src/adapters/agents/openai-agent.ts` (285 lines)

Uses **native fetch** (no SDK) — compatible with any OpenAI Chat Completions API endpoint.

```typescript
interface OpenAIAgentConfig {
    apiKey: string;
    baseUrl: string;              // "https://api.openai.com/v1" or any compatible endpoint
    model: string;                // "gpt-4o-mini", "mistral", etc.
    maxTokens: number;            // default 4096
    temperature: number;          // default 0.7
    timeout: number;              // default 60000ms
    agents: Record<string, string>;  // agent name → system prompt
}

// Built-in agents (pre-configured):
agents: {
    copilot: "You are a helpful coding assistant...",
    reviewer: "You are a code reviewer...",
    writer: "You are a technical writer..."
}
```

#### API Invocation Flow

1. Client calls `invoke(options)`
2. Build system prompt (from options or config)
3. Inject workflow variables into system context
4. Build message array (system + history + prompt)
5. POST to `{baseUrl}/chat/completions` with timeout
6. Parse response, extract content
7. Return Result<AgentResult, AgentError>

#### Ollama Support (Out of Box)

```typescript
const agent = createOpenAIAgent({
    apiKey: 'ollama',  // dummy (Ollama doesn't require auth)
    baseUrl: 'http://localhost:11434/v1',
    model: 'mistral:7b',  // Any Ollama model
});
```

**NO code changes needed** — existing infrastructure handles it.

### 2.3 How to Add New Agent Adapter

**Pattern:**

```typescript
// File: src/adapters/agents/anthropic-agent.ts
import type { AgentProvider, AgentInvokeOptions, AgentResult, AgentError } from '#core/ports/agent-provider.port.js';
import type { Result } from '#infra/errors.js';

export interface AnthropicAgentConfig {
    apiKey: string;
    model: string;
    maxTokens?: number;
}

export function createAnthropicAgent(config?: Partial<AnthropicAgentConfig>): AgentProvider {
    return {
        async invoke(options: AgentInvokeOptions): Promise<Result<AgentResult, AgentError>> {
            // Implementation: fetch to Anthropic API, return Result
        },
        has(agent: string): boolean {
            return true;  // Or check agent registry
        },
        list(): string[] {
            return ['claude', 'opus', 'sonnet'];
        }
    };
}
```

Then register in `config/container.ts`:

```typescript
const agent = process.env.AGENT_PROVIDER === 'anthropic'
    ? createAnthropicAgent({ apiKey: process.env.AGENT_API_KEY })
    : createOpenAIAgent({ apiKey: process.env.AGENT_API_KEY });
```

---

## 3. STATE & OBSERVABILITY SYSTEMS

### 3.1 State Store Port

**File:** `cli-mcp-core/src/core/ports/state-store.port.ts` (48 lines)

Synchronous key-value store for inter-step state:

```typescript
interface StateStore {
    get<T>(key: string): T | undefined;
    set(key: string, value: unknown): void;
    has(key: string): boolean;
    delete(key: string): void;
    getAll(): Record<string, unknown>;
    clear(): void;
    serialize(): string;         // For persistence
    deserialize(data: string): void;
}
```

**Memory Implementation:** `cli-mcp-core/src/adapters/state/memory-store.ts` (62 lines)
- Backed by `Map<string, unknown>`
- Used in every workflow execution

**Why Synchronous?**
- Simplifies execution loop (no awaiting state operations)
- Enables deterministic, replayable workflows
- Supports pause/resume without complex async state management

**Planned Extensions (v1.0+):**
- `createSqliteStore(dbPath)` — persistent state
- `createRedisStore(redisUrl)` — distributed state
- Async variant for future distributed workflows

### 3.2 Observability Port

**File:** `cli-mcp-core/src/core/ports/observability.port.ts` (29 lines)

```typescript
interface Span {
    id: string;
    name: string;
    startTime: number;
    end(attributes?: Record<string, unknown>): void;
}

interface ObservabilityPort {
    startSpan(name: string, attributes?: Record<string, unknown>): Span;
    recordMetric(name: string, value: number, tags?: Record<string, string>): void;
}
```

**Console Implementation:** `cli-mcp-core/src/adapters/observability/console-tracer.ts`
- Logs to structured logger
- Debug-level output with timing

**Extension Points:**
- OpenTelemetry adapter — export to OTEL collectors
- Langfuse adapter — LLM observability
- Datadog adapter — enterprise monitoring

---

## 4. EXECUTION LOOP & DIRECTIVE HANDLERS

### 4.1 SimpleExecutor Model

**File:** `cli-mcp-core/src/adapters/executor/simple-executor.ts` (500 lines)

Core loop (simplified):

```typescript
async execute(workflow, inputs, options) {
    emitter.emit({ type: 'workflow:start', ... });
    
    for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        emitter.emit({ type: 'step:start', stepIndex: i, totalSteps: workflow.steps.length, ... });
        
        for (const directive of step.directives) {
            emitter.emit({ type: 'directive:start', directiveType: directive.type, ... });
            
            const result = await executeDirective(directive, { store, tools, emitter, ... });
            
            emitter.emit({ type: 'directive:end', success: result.ok, ... });
            
            if (!result.ok) break;
        }
        
        emitter.emit({ type: 'step:end', stepId: step.id, ... });
    }
    
    emitter.emit({ type: 'workflow:end', ... });
    
    return ok({ outputs: store.getAll(), steps, duration, controller });
}
```

### 4.2 Directive Handler Pattern

**File:** `cli-mcp-core/src/adapters/executor/directive-handlers.ts` (600+ lines)

Single dispatcher handles all directive types:

```typescript
async function executeDirective(
    directive: Directive,
    context: DirectiveHandlerContext
): Promise<Result<DirectiveHandlerResult>> {
    switch (directive.type) {
        case '@call':
            // Tool invocation (shell, MCP, etc.)
            return handleCall(directive, context);
        
        case '@agent':
            // LLM invocation
            return handleAgent(directive, context);
        
        case '@if':
            // Condition evaluation
            return handleIf(directive, context);
        
        case '@for':
        case '@repeat':
        case '@try/@on-error':
        case '@parallel':
        case '@workflow':
            // Compound directives handled by executor
            
        default:
            return err({ code: 'UNKNOWN_DIRECTIVE', ... });
    }
}
```

**Context Available to All Handlers:**

```typescript
interface DirectiveHandlerContext {
    store: StateStore;                    // State access
    tools: ToolProvider;                  // Tool execution
    logger?: Logger;                      // Debug logging
    emitter?: ExecutionEventEmitter;      // Event emission
    resolver?: SkillResolver;             // Skill resolution
    parser?: WorkflowParser;              // Sub-workflow parsing
    agent?: AgentProvider;                // Agent invocation
    dryRun: boolean;                      // Dry-run mode
    stepId: string;                       // Current step
    allowedEnvVars?: ReadonlySet<string>; // Env var whitelist
}
```

**Extension Point for Learning:**

After directive completes, hook learning:

```typescript
// Inside executeDirective
const result = await handleDirective(...);

// Emit learning event
if (context.dryRun === false && shouldLearn) {
    emitter.emit({
        type: 'learning:directive-result',
        stepId: context.stepId,
        directiveType: directive.type,
        result: result.value,
        duration: Date.now() - start,
        input: directive.raw,
        output: result.value?.output
    });
}

return result;
```

---

## 5. DEPENDENCY INJECTION & CONTAINER

### 5.1 Container Pattern

**File:** `cli-mcp-core/src/config/container.ts` (146 lines)

Single container holds all services:

```typescript
interface Container {
    config: AppConfig;
    logger: Logger;
    parser: WorkflowParser;
    executor: WorkflowExecutor;
    store: StateStore;
    tools: ToolProvider;
    resolver: SkillResolver;
    emitter: ExecutionEventEmitter;
    agent: AgentProvider;
    observability: ObservabilityPort;
}

async function createContainer(overrides?: Partial<AppConfig>): Promise<Container> {
    // 1. Load config
    const config = { ...loadEnvConfig(), ...overrides };
    const logger = createLogger(config.logLevel);
    
    // 2. Core services
    const store = createMemoryStore();
    const emitter = createEventEmitter();
    const parser = createMarkdownParser();
    const resolver = createLocalResolver(config.workflowsDir);
    
    // 3. Tool provider (shell + MCP)
    const tools = createCompositeToolProvider({
        shell: createShellToolProvider(...),
        mcp: createMcpClientProvider(...)
    });
    
    // 4. Agent (strategy pattern)
    const agent = process.env.AGENT_API_KEY
        ? createOpenAIAgent({ apiKey: process.env.AGENT_API_KEY })
        : createNoopAgent();
    
    // 5. Executor (strategy pattern)
    const executor = config.executor === 'mastra'
        ? createMastraExecutor({ store, tools, logger, emitter, resolver, parser, agent })
        : createSimpleExecutor({ store, tools, logger, emitter, resolver, parser, agent });
    
    // 6. Observability
    const observability = createConsoleTracer(logger);
    
    return { config, logger, parser, executor, store, tools, resolver, emitter, agent, observability };
}
```

### 5.2 Adding New Services

**Safe Pattern:**

1. Define port in `core/ports/new-service.port.ts`
2. Create adapter in `adapters/new-service/implementation.ts`
3. Add optional field to Container: `readonly newService?: NewServicePort;`
4. Wire in `createContainer()`:
   ```typescript
   const newService = process.env.NEW_SERVICE_ENDPOINT
       ? createNewService({ ... })
       : undefined;
   ```
5. Re-export in `src/index.ts`
6. **Existing code unaffected** (optional field, interface segregation)

---

## 6. CLI COMMANDS ARCHITECTURE

### 6.1 Command Router

**File:** `cli-mcp-core/src/cli/index.ts` (34 lines)

Uses **Citty** router (lightweight CLI framework):

```typescript
const main = defineCommand({
    meta: {
        name: 'chainskills',
        version: '0.6.0',
        description: 'Compose, share, and run AI agent workflows'
    },
    subCommands: {
        run: runCommand,       // Execute workflow
        validate: validateCommand,
        init: initCommand,
        inspect: inspectCommand,
        list: listCommand,
        serve: serveCommand    // MCP server
    }
});

runMain(main);
```

### 6.2 Command Implementation Pattern

**File:** `cli-mcp-core/src/cli/run.ts` (340 lines)

Template for new commands:

```typescript
export const newCommand = defineCommand({
    meta: {
        name: 'new-command',
        description: 'What this command does'
    },
    args: {
        workflow: {
            type: 'positional',
            description: 'Workflow to process',
            required: true
        },
        'my-flag': {
            type: 'string',
            description: 'A flag',
            default: 'default-value'
        },
        'verbose': {
            type: 'boolean',
            alias: 'v',
            description: 'Verbose output',
            default: false
        }
    },
    async run({ args }) {
        // Create container
        const container = await createContainer({
            logLevel: args.verbose ? 'debug' : 'warn'
        });
        
        // Load workflow
        const workflowPath = resolve(args.workflow);
        const source = readFileSync(workflowPath, 'utf-8');
        
        // Parse
        const parseResult = parseWorkflow(source, container.parser);
        if (!parseResult.ok) {
            console.error(`Parse error: ${parseResult.error.message}`);
            process.exit(1);
        }
        
        // Execute
        const execResult = await container.executor.execute(
            parseResult.value,
            {},
            { dryRun: false }
        );
        
        if (!execResult.ok) {
            console.error(`Execution failed: ${execResult.error.message}`);
            process.exit(1);
        }
        
        // Output
        console.log(JSON.stringify(execResult.value, null, 2));
    }
});
```

Then register in `cli/index.ts`:

```typescript
subCommands: {
    run: runCommand,
    newCommand: newCommand,  // ← Add here
    // ...
}
```

---

## 7. DATA PROVENANCE & VALIDATION

### 7.1 Provenance Entity

**File:** `cli-mcp-core/src/core/entities/data-provenance.ts` (52 lines)

Tracks data origin, freshness, and confidence:

```typescript
interface DataProvenance {
    source_name: string;              // "api-sirene-insee", "github-owner/repo"
    source_url: string;               // Exact URL for verification
    source_updated_at: string;        // ISO 8601 date
    ingested_at: string;              // When we fetched it
    confidence_score: number;         // 0.0–1.0
    confidence_reason: string;        // Why this score
    verification_status: 'raw' | 'normalized' | 'cross_referenced' | 'human_verified';
    lineage_run_id?: string;          // UUID for audit trail
    source_tier?: 'A' | 'B' | 'C';   // Reliability tier
}

function classifyFreshness(sourceUpdatedAt: string): FreshnessStatus {
    // fresh (<90d), aging (90d-1yr), stale (1-2yr), expired (>2yr), unverified
}
```

### 7.2 Zod Validation

**File:** `cli-mcp-core/src/adapters/validation/provenance-schema.ts` (47 lines)

```typescript
const DataProvenanceSchema = z.object({
    source_name: z.string().min(1),
    source_url: z.string().url(),
    source_updated_at: z.string().datetime(),
    ingested_at: z.string().datetime(),
    confidence_score: z.number().min(0).max(1),
    confidence_reason: z.string().min(1),
    verification_status: z.enum(['raw', 'normalized', 'cross_referenced', 'human_verified']),
    lineage_run_id: z.string().uuid().optional(),
    source_tier: z.enum(['A', 'B', 'C']).optional(),
});

function validateProvenance(data: unknown) {
    return DataProvenanceSchema.safeParse(data);
}
```

**Usage:** Validate LLM outputs at adapter boundaries (before entering domain).

---

## 8. META WORKFLOW PATTERNS

### 8.1 Research Domain Workflow

**File:** `cli-mcp-core/templates/meta/research-domain.workflow.md` (112 lines)

**Pipeline:**

1. **Validate** — check domain input is not empty
2. **Cache check** — @agent searches workspace for prior research
3. **Workspace scan** — @agent lists existing adapters, templates
4. **Parallel research** — @agent queries web, GitHub, npm, community simultaneously
5. **Freshness validation** — @agent applies data freshness classification to all claims
6. **Synthesize knowledge** — @agent merges sources into unified knowledge base
7. **Dependency audit** — @agent cross-references npm versions against workspace
8. **Plan skills** — @agent proposes 5 reusable skills from research findings
9. **Output report** — @agent generates structured research report

**Data Flow:**

```
domain (input)
  → prior_research (cache check)
  → workspace_scan (existing assets?)
  ┌─→ web_knowledge
  ├─→ github_knowledge
  ├─→ npm_knowledge
  └─→ community_knowledge
  (parallel block ends)
  → freshness_report (validation)
  → knowledge_base (merged)
  → dependency_audit (version analysis)
  → recommended_skills (up to 5)
  → final_report (output)
```

### 8.2 Agent Factory Workflow

**File:** `cli-mcp-core/templates/meta/agent-factory.workflow.md` (148 lines)

**Pipeline:**

1. **Validate** — domain, max_skills, quality_threshold parameters
2. **Check prior work** — search for existing agents in .github/agents/
3. **Research domain** — invoke research-domain.workflow.md
4. **Plan skills** — deduplicate against existing skills + built-ins
5. **Generate skills** — loop: @for each skill, generate SKILL.md in parallel
6. **Assemble agent** — write .agent.md with YAML frontmatter (NO chatagent fences)
7. **Generate prompt** — write reusable .prompt.md for the agent
8. **Quality review** — @repeat up to 2 attempts: review artifacts, score, apply fixes
9. **Register** — update AGENTS.md with new agent entry
10. **Output summary** — report counts and file paths

**Quality Gate Loop:**

```
@repeat max:2 until $quality_score >= $quality_threshold:
  @agent copilot: "Review agent file, skills, prompt. Score 0–1."
  →  $review_result
  
  @if $review_result.score < $quality_threshold:
    @agent copilot: "Apply review suggestions to fix issues"
    → regenerate artifacts
  
  @assert $review_result.score >= $quality_threshold
```

**Extension Points for Auto-Learn:**

After step 5 (skills generated):
```
learning:skills-generated event
├─ $skills_plan (structured proposal)
└─ skill contents (for distillation)
```

After step 8 (quality review):
```
learning:quality-reviewed event
├─ $review_result (scores, issues)
└─ artifact paths (for tracking)
```

New step 6.5 (before agent assembly):
```
learning:knowledge-distill event
├─ Compress $knowledge_base
├─ Emit distilled_knowledge output
└─ Track compression ratio
```

---

## 9. PUBLIC API EXPORTS

**File:** `cli-mcp-core/src/index.ts` (109 lines)

```typescript
// Core Entities
export type Workflow, Step, Directive, Variable, InputDef, OutputDef;

// Core Ports
export type WorkflowParser, WorkflowExecutor, StateStore, ToolProvider, AgentProvider, ObservabilityPort;

// Core Use Cases
export { parseWorkflow, validateWorkflow, buildDAG, runWorkflow, describeWorkflow };

// Infrastructure
export { ok, err, isOk, isErr, match, createLogger };

// Execution Events
export { createEventEmitter };
export type ExecutionEvent, ExecutionEventHandler;

// Config & DI
export { createContainer };

// Adapters (for programmatic usage)
export { createMastraExecutor, createOpenAIAgent, createMcpServer, createMcpClientProvider };
```

**Implication:**
- All ports are re-exportable → third-party can implement new adapters
- All adapters are exported → programmatic usage possible
- Event system is exposed → external listeners can subscribe

---

## 10. EXTENSION POINTS CHECKLIST

### 10.1 Event System (execution-events.port.ts)

**Add new event types:**
```typescript
| 'learning:session-start'
| 'learning:directive-result'
| 'learning:batch-ready'
| 'distillation:started'
| 'distillation:checkpoint'
| 'distillation:completed'
| 'research:started'
| 'research:source-fetched'
| 'research:synthesized'
```

**No executor changes needed** — purely additive.

### 10.2 New Ports (core/ports/)

```typescript
// DistillationService
export interface DistillationService {
    compress(model: string, input: string[]): Promise<CompressedModel>;
}

// LearningCollector
export interface LearningCollector {
    recordDirective(directive: Directive, result: any, timing: number): void;
    recordStep(step: Step, result: StepResult): void;
    getBatch(maxSize: number): TrainingBatch;
}

// ResearchService
export interface ResearchService {
    fetchDomain(domain: string, sources: string[]): Promise<ResearchResult>;
}
```

### 10.3 New Adapters (adapters/)

Create implementations for new ports:

```
adapters/
├─ distillation/
│  └─ ollama-distiller.ts
├─ learning/
│  └─ memory-collector.ts
└─ research/
   └─ web-researcher.ts
```

### 10.4 New CLI Commands (cli/)

```typescript
// cli/learn.ts
export const learnCommand = defineCommand({ ... });

// cli/distill.ts
export const distillCommand = defineCommand({ ... });

// cli/research.ts
export const researchCommand = defineCommand({ ... });

// cli/index.ts
subCommands: {
    ...,
    learn: learnCommand,
    distill: distillCommand,
    research: researchCommand
}
```

### 10.5 Meta Workflow Templates (templates/meta/)

```
templates/meta/
├─ research-domain.workflow.md (existing)
├─ agent-factory.workflow.md (existing)
├─ auto-learn.workflow.md (new)
├─ distill-knowledge.workflow.md (new)
└─ research-synthesis.workflow.md (new)
```

---

## 11. MASTRA EXECUTOR ALTERNATIVE

**File:** `cli-mcp-core/src/adapters/executor/mastra-executor.ts` (400+ lines)

**SimpleExecutor:** Sequential steps, full control flow (if/else, for, try/catch, parallel in fallback mode)

**MastraExecutor:** DAG-aware orchestration
- Analyzes workflow to find parallelizable steps
- Executes independent steps in parallel via Mastra's orchestrator
- Shared DirectiveHandler logic (both use directive-handlers.ts)
- Identical event emission

**Both emit the same ExecutionEvent types** — CLI/observers see consistent event flow.

---

## 12. CRITICAL DESIGN PRINCIPLES TO PRESERVE

1. **Ports define contracts, adapters implement** — Never put business logic in adapters
2. **StateStore is synchronous** — Simplifies execution and enables pause/resume
3. **Events are immutable readonly** — No mutation during emission
4. **Result<T,E> monad** — No exceptions in core layer (executors wrap throws)
5. **Single container instance** — All services wired once per execution
6. **CLI is thin wrapper** — Business logic in use cases, not command code
7. **Interface segregation** — New services can be optional without breaking existing code

---

## 13. KEY FILE SUMMARY TABLE

| Path | Lines | Purpose | For Extension |
|------|-------|---------|----------------|
| core/ports/execution-events.port.ts | 156 | Event contract | Add new event types |
| core/ports/agent-provider.port.ts | 88 | Agent contract | Implement for new LLM |
| core/ports/state-store.port.ts | 48 | State contract | Implement SQLite/Redis |
| core/ports/observability.port.ts | 29 | Observability contract | Implement OpenTelemetry |
| infrastructure/event-emitter.ts | 43 | Event implementation | — |
| adapters/executor/directive-handlers.ts | 600+ | Directive logic | Hook learning here |
| adapters/executor/simple-executor.ts | 500 | Execution loop | Understand event points |
| adapters/executor/mastra-executor.ts | 400+ | DAG execution | Alternative loop |
| adapters/agents/openai-agent.ts | 285 | Agent adapter | Template for new adapters |
| adapters/observability/console-tracer.ts | 46 | Observability impl | Template for new impls |
| adapters/state/memory-store.ts | 62 | State impl | Template for new impls |
| config/container.ts | 146 | DI wiring | Register new services |
| cli/run.ts | 340 | Workflow execution | Template for new commands |
| cli/index.ts | 34 | Command router | Register new commands |
| index.ts | 109 | Public API | Re-export new types |
| templates/meta/research-domain.workflow.md | 112 | Research template | Base for auto-research |
| templates/meta/agent-factory.workflow.md | 148 | Agent template | Base for auto-agent |

---

## 14. RECOMMENDED PHASED APPROACH

### Phase 1: Event System (1-2 days)
- Add `learning:*`, `distillation:*`, `research:*` to execution-events.port.ts
- Export new types from core/ports/index.ts
- No executor changes needed (purely additive)
- External listeners can subscribe immediately

### Phase 2: New Ports & Adapters (2-3 days)
- Create `core/ports/distillation.port.ts` + implementation
- Create `core/ports/learning-collector.port.ts` + implementation
- Create `core/ports/research.port.ts` + implementation
- Wire into Container (optional fields)

### Phase 3: CLI Commands (1-2 days)
- `chainskills learn <workflow>` command
- `chainskills distill` command
- `chainskills research <domain>` command

### Phase 4: Meta Workflow Templates (2-3 days)
- `auto-learn.workflow.md` — automated learning pipeline
- `distill-knowledge.workflow.md` — knowledge compression
- Integration with existing research-domain, agent-factory

### Phase 5: Quality Assurance (1-2 days)
- Vitest coverage for new services
- Integration tests with real workflows
- Documentation updates

---

## 15. KNOWN CONSTRAINTS & DEPENDENCIES

- **Node.js 18+** — async/await, native fetch, AbortController
- **TypeScript 5+** — with subpath imports (`#core/ports/*`)
- **Citty** — CLI framework (lightweight)
- **Zod** — validation schemas
- **Remark** — Markdown parsing
- **Mastra** (optional) — DAG execution
- **MCP** (optional) — tool provider integration

---

**Status:** Comprehensive analysis complete. Ready for implementation.

