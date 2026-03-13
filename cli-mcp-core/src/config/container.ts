/**
 * Dependency Injection container.
 *
 * Wires all ports to their concrete adapter implementations based on the
 * current environment configuration. CLI commands use this — they never
 * instantiate adapters directly.
 *
 * @module config/container
 */

import { loadEnvConfig } from './env.js';
import { DEFAULT_CONFIG, type AppConfig } from './defaults.js';
import { createLogger, type Logger } from '#infra/logger.js';
import { createMarkdownParser } from '#adapters/parser/markdown-parser.js';
import { createSimpleExecutor } from '#adapters/executor/simple-executor.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import { createShellToolProvider } from '#adapters/tools/shell-tool-provider.js';
import { createCompositeToolProvider } from '#adapters/tools/composite-tool-provider.js';
import { createMcpClientProvider } from '#adapters/tools/mcp-client.js';
import type { McpClientConfig } from '#adapters/tools/mcp-client.js';
import { createLocalResolver } from '#adapters/skills/local-resolver.js';
import { createEventEmitter } from '#infra/event-emitter.js';
import { createNoopAgent, createOpenAIAgent } from '#adapters/agents/openai-agent.js';
import type { WorkflowParser } from '#core/ports/workflow-parser.port.js';
import type { WorkflowExecutor } from '#core/ports/workflow-executor.port.js';
import type { StateStore } from '#core/ports/state-store.port.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { SkillResolver } from '#core/ports/skill-resolver.port.js';
import type { ExecutionEventEmitter } from '#core/ports/execution-events.port.js';
import type { AgentProvider } from '#core/ports/agent-provider.port.js';
import type { PersistenceStore } from '#core/ports/persistence.port.js';
import type { RunHistory } from '#core/ports/run-history.port.js';
import type { SnapshotManager } from '#core/ports/snapshot-manager.port.js';
import type { RulesStore } from '#core/ports/rules-store.port.js';
import type { ReflectionEngine } from '#core/services/reflection-engine.js';

/** Container exposing all wired services. */
export interface Container {
    readonly config: AppConfig;
    readonly logger: Logger;
    readonly parser: WorkflowParser;
    readonly executor: WorkflowExecutor;
    readonly store: StateStore;
    readonly tools: ToolProvider;
    readonly resolver: SkillResolver;
    readonly emitter: ExecutionEventEmitter;
    readonly agent: AgentProvider;
    readonly persistence?: PersistenceStore;
    readonly history?: RunHistory;
    readonly snapshots?: SnapshotManager;
    readonly rulesStore?: RulesStore;
    readonly reflectionEngine?: ReflectionEngine;
}

/**
 * Create the DI container, wiring ports to adapters.
 *
 * @param overrides - Optional partial config overrides (useful for testing).
 * @returns Fully wired `Container`.
 */
export async function createContainer(
    overrides?: Partial<AppConfig>,
): Promise<Container> {
    // Load config (env + defaults + overrides)
    let config: AppConfig;
    try {
        config = { ...loadEnvConfig(), ...overrides };
    } catch {
        // Fallback to defaults if env validation fails (e.g. in tests)
        config = { ...DEFAULT_CONFIG, ...overrides };
    }

    const logger = createLogger(config.logLevel);

    // State store
    const store = createMemoryStore();

    // Tools — composite provider: shell + optional MCP client
    const shellProvider = createShellToolProvider(
        { timeout: config.shellTimeout },
        logger,
    );

    const providers: Record<string, ToolProvider> = { shell: shellProvider };

    // Parse MCP_SERVERS from env (JSON string) if available
    const mcpServersEnv = process.env['MCP_SERVERS'] ?? '';
    if (mcpServersEnv) {
        try {
            const parsed = JSON.parse(mcpServersEnv) as McpClientConfig['servers'];
            const mcpProvider = createMcpClientProvider({ servers: parsed }, logger);
            providers['mcp'] = mcpProvider;
            logger.debug('MCP client provider configured', { servers: Object.keys(parsed) });
        } catch (e) {
            logger.warn(`MCP_SERVERS env var is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    const tools = createCompositeToolProvider(providers);

    // Parser
    const parser = createMarkdownParser();

    // Event emitter
    const emitter = createEventEmitter();

    // Skill resolver
    const resolver = createLocalResolver(config.workflowsDir);

    // Agent provider — use OpenAI-compatible if API key is set, otherwise noop
    const agentApiKey = process.env['AGENT_API_KEY'] ?? '';
    const agent = agentApiKey
        ? createOpenAIAgent({
            apiKey: agentApiKey,
            baseUrl: process.env['AGENT_BASE_URL'] ?? 'https://api.openai.com/v1',
            model: process.env['AGENT_MODEL'] ?? 'gpt-4o-mini',
        }, logger)
        : createNoopAgent();

    // Persistence layer — lazy init (only when recording/snapshots/rules are used)
    let persistence: PersistenceStore | undefined;
    let history: RunHistory | undefined;
    let snapshots: SnapshotManager | undefined;
    let rulesStore: RulesStore | undefined;
    let reflectionEngine: ReflectionEngine | undefined;

    try {
        const { createSqlitePersistence } = await import('#adapters/state/sqlite-persistence.js');
        const { createSqliteRunHistory } = await import('#adapters/state/sqlite-run-history.js');
        const { createSqliteSnapshotManager } = await import('#adapters/state/sqlite-snapshot-manager.js');
        const { createSqliteRulesStore } = await import('#adapters/state/sqlite-rules-store.js');
        const { createReflectionEngine } = await import('#core/services/reflection-engine.js');

        persistence = createSqlitePersistence();
        history = createSqliteRunHistory(persistence);
        snapshots = createSqliteSnapshotManager(persistence);
        rulesStore = createSqliteRulesStore(persistence);

        if (agentApiKey) {
            reflectionEngine = createReflectionEngine(agent);
        }

        logger.debug('Persistence layer initialized');
    } catch (e) {
        logger.debug(`Persistence layer not available: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Executor — strategy pattern via config
    const executorDeps = { store, tools, logger, emitter, resolver, parser, agent, history, snapshots, rulesStore, reflectionEngine };
    let executor: WorkflowExecutor;
    if (config.executor === 'mastra') {
        try {
            // Dynamic import to keep @mastra/core out of the core bundle
            const mastraModule = await import('#adapters/executor/mastra-executor.js') as {
                createMastraExecutor: typeof import('#adapters/executor/mastra-executor.js').createMastraExecutor;
            };
            executor = mastraModule.createMastraExecutor({ store, tools, logger, emitter, resolver, parser, agent });
        } catch {
            // Fallback to simple executor if Mastra is not available
            logger.warn('MastraExecutor not available, falling back to SimpleExecutor');
            executor = createSimpleExecutor(executorDeps);
        }
    } else {
        executor = createSimpleExecutor(executorDeps);
    }

    return {
        config,
        logger,
        parser,
        executor,
        store,
        tools,
        resolver,
        emitter,
        agent,
        persistence,
        history,
        snapshots,
        rulesStore,
        reflectionEngine,
    };
}
