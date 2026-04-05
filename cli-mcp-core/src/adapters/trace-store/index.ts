/**
 * TraceStore factory — auto-detects backend based on available MCP servers.
 *
 * - If MCP client is available with CRAG/memory servers → CragTraceStore
 * - Otherwise → JsonlTraceStore (local fallback)
 *
 * @module adapters/trace-store
 */

export { createJsonlTraceStore } from './jsonl-trace-store.js';
export { createCragTraceStore } from './crag-trace-store.js';

import type { TraceStore } from '#core/ports/trace-store.port.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';
import type { Logger } from '#infra/logger.js';
import { createCragTraceStore } from './crag-trace-store.js';
import { createJsonlTraceStore } from './jsonl-trace-store.js';

/**
 * Create the best available TraceStore.
 *
 * Prefers CRAG/KG if MCP client has the required servers,
 * falls back to local JSONL.
 */
export function createTraceStore(config: {
    readonly mcpClient?: ToolProvider;
    readonly tracesDir: string;
    readonly logger?: Logger;
}): TraceStore {
    // Check if MCP client can reach CRAG
    if (config.mcpClient && config.mcpClient.has('mcp', 'crag_kv_set')) {
        config.logger?.debug('TraceStore: using CRAG/KG backend');
        return createCragTraceStore({
            mcpClient: config.mcpClient,
            logger: config.logger,
        });
    }

    config.logger?.debug(`TraceStore: using JSONL fallback in ${config.tracesDir}`);
    return createJsonlTraceStore({
        directory: config.tracesDir,
        logger: config.logger,
    });
}
