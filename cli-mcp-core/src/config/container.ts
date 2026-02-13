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
import { createLocalResolver } from '#adapters/skills/local-resolver.js';
import { createEventEmitter } from '#core/ports/execution-events.port.js';
import type { WorkflowParser } from '#core/ports/workflow-parser.port.js';
import type { WorkflowExecutor } from '#core/ports/workflow-executor.port.js';
import type { StateStore } from '#core/ports/state-store.port.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { SkillResolver } from '#core/ports/skill-resolver.port.js';
import type { ExecutionEventEmitter } from '#core/ports/execution-events.port.js';

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
}

/**
 * Create the DI container, wiring ports to adapters.
 *
 * @param overrides - Optional partial config overrides (useful for testing).
 * @returns Fully wired `Container`.
 */
export function createContainer(
    overrides?: Partial<AppConfig>,
): Container {
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

    // Tools
    const tools = createShellToolProvider(
        { timeout: config.shellTimeout },
        logger,
    );

    // Parser
    const parser = createMarkdownParser();

    // Event emitter
    const emitter = createEventEmitter();

    // Skill resolver
    const resolver = createLocalResolver(config.workflowsDir);

    // Executor — strategy pattern via config
    let executor: WorkflowExecutor;
    if (config.executor === 'mastra') {
        try {
            // Dynamic import to keep @mastra/core out of the core bundle
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { createMastraExecutor } = require('#adapters/executor/mastra-executor.js') as {
                createMastraExecutor: typeof import('#adapters/executor/mastra-executor.js').createMastraExecutor;
            };
            executor = createMastraExecutor({ store, tools, logger, emitter, resolver, parser });
        } catch {
            // Fallback to simple executor if Mastra is not available
            logger.warn('MastraExecutor not available, falling back to SimpleExecutor');
            executor = createSimpleExecutor({ store, tools, logger, emitter, resolver, parser });
        }
    } else {
        executor = createSimpleExecutor({ store, tools, logger, emitter, resolver, parser });
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
    };
}
