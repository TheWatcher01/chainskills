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
import { createAnthropicAgent } from '#adapters/agents/anthropic-agent.js';
import { createTraceInformedAgent } from '#adapters/agents/trace-informed-agent.js';
import type { WorkflowParser } from '#core/ports/workflow-parser.port.js';
import type { WorkflowExecutor } from '#core/ports/workflow-executor.port.js';
import type { StateStore } from '#core/ports/state-store.port.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { SkillResolver } from '#core/ports/skill-resolver.port.js';
import type { ExecutionEventEmitter } from '#core/ports/execution-events.port.js';
import type { AgentProvider } from '#core/ports/agent-provider.port.js';
import type { ObservabilityPort } from '#core/ports/observability.port.js';
import type { TraceStore } from '#core/ports/trace-store.port.js';
import { createConsoleTracer } from '#adapters/observability/console-tracer.js';
import { createTraceStore } from '#adapters/trace-store/index.js';

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
    readonly observability: ObservabilityPort;
    readonly traceStore: TraceStore;
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

    // Agent provider — resolve from AGENT_PROVIDER env or auto-detect from API keys
    const providerBackend = config.agentProvider
        ?? (process.env['AGENT_PROVIDER'] as import('./defaults.js').AgentProviderBackend | undefined)
        ?? 'noop';

    let agent: AgentProvider;
    const agentModel = process.env['AGENT_MODEL'];

    switch (providerBackend) {
        case 'anthropic': {
            const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
            agent = apiKey
                ? createAnthropicAgent({
                    apiKey,
                    baseUrl: process.env['ANTHROPIC_BASE_URL'] ?? 'https://api.anthropic.com',
                    model: agentModel ?? 'claude-sonnet-4-6',
                }, logger)
                : createNoopAgent();
            logger.debug('Agent provider: anthropic', { hasKey: !!apiKey });
            break;
        }
        case 'openai': {
            const apiKey = process.env['AGENT_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '';
            agent = apiKey
                ? createOpenAIAgent({
                    apiKey,
                    baseUrl: process.env['AGENT_BASE_URL'] ?? 'https://api.openai.com/v1',
                    model: agentModel ?? 'gpt-4o-mini',
                }, logger)
                : createNoopAgent();
            logger.debug('Agent provider: openai', { hasKey: !!apiKey });
            break;
        }
        case 'ollama': {
            // Ollama uses OpenAI-compatible API, no key needed
            agent = createOpenAIAgent({
                apiKey: 'ollama',
                baseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434/v1',
                model: agentModel ?? 'qwen3:8b',
            }, logger);
            logger.debug('Agent provider: ollama');
            break;
        }
        default: {
            // Auto-detect: check for API keys in order of preference
            const anthropicKey = process.env['ANTHROPIC_API_KEY'] ?? '';
            const openaiKey = process.env['AGENT_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '';

            if (anthropicKey) {
                agent = createAnthropicAgent({
                    apiKey: anthropicKey,
                    model: agentModel ?? 'claude-sonnet-4-6',
                }, logger);
                logger.debug('Agent provider: auto-detected anthropic');
            } else if (openaiKey) {
                agent = createOpenAIAgent({
                    apiKey: openaiKey,
                    baseUrl: process.env['AGENT_BASE_URL'] ?? 'https://api.openai.com/v1',
                    model: agentModel ?? 'gpt-4o-mini',
                }, logger);
                logger.debug('Agent provider: auto-detected openai');
            } else {
                agent = createNoopAgent();
                logger.debug('Agent provider: noop (no API keys found)');
            }
            break;
        }
    }

    // Wrap agent with trace-informed feedback if enabled
    const feedbackEnabled = (process.env['AGENT_FEEDBACK_ENABLED'] === 'true') || config.agentFeedbackEnabled;

    // Trace store — auto-detect CRAG/KG or fallback to JSONL (must be before executor)
    const recordTraces = config.recordTraces ?? true;
    const tracesDir = process.env['TRACES_DIR'] ?? config.tracesDir ?? './traces';
    const mcpClientForTraces = providers['mcp'];
    const traceStore = createTraceStore({
        mcpClient: mcpClientForTraces,
        tracesDir,
        logger,
    });

    // Wrap agent with trace-informed feedback loop if enabled
    const finalAgent = feedbackEnabled
        ? createTraceInformedAgent(agent, traceStore, {
            enabled: true,
            minConfidence: config.agentFeedbackMinConfidence ?? 0.8,
        }, logger)
        : agent;

    // Only pass traceStore to executor if recording is enabled
    const executorTraceStore = recordTraces ? traceStore : undefined;

    // Executor — strategy pattern via config
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
            executor = createSimpleExecutor({ store, tools, logger, emitter, resolver, parser, agent: finalAgent, traceStore: executorTraceStore });
        }
    } else {
        executor = createSimpleExecutor({ store, tools, logger, emitter, resolver, parser, agent: finalAgent, traceStore: executorTraceStore });
    }

    // Observability
    const observability = createConsoleTracer(logger);

    return {
        config,
        logger,
        parser,
        executor,
        store,
        tools,
        resolver,
        emitter,
        agent: finalAgent,
        observability,
        traceStore,
    };
}
