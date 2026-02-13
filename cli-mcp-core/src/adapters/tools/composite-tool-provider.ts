/**
 * Composite tool provider — routes @call directives to the correct provider.
 *
 * Delegates `@call shell.*` to the shell tool provider and
 * `@call mcp.*` to the MCP client tool provider.
 * Unknown tool namespaces are reported as errors.
 *
 * @module adapters/tools/composite-tool-provider
 */

import type { Result } from '#infra/errors.js';
import type { ToolError } from '#infra/errors.js';
import { err, toolError } from '#infra/errors.js';
import type { ToolProvider } from '#core/ports/tool-provider.port.js';

/**
 * Create a composite tool provider that routes calls by tool namespace.
 *
 * @param providers - Map of tool namespace to provider (e.g., "shell" → shellProvider, "mcp" → mcpProvider).
 * @returns A unified `ToolProvider` that dispatches to the correct backend.
 */
export function createCompositeToolProvider(
    providers: Readonly<Record<string, ToolProvider>>,
): ToolProvider {
    return {
        async call(
            tool: string,
            method: string,
            args: Record<string, unknown>,
        ): Promise<Result<unknown, ToolError>> {
            const provider = providers[tool];
            if (!provider) {
                return err(
                    toolError(
                        'TOOL_NOT_FOUND',
                        `Unknown tool namespace "${tool}". Available: ${Object.keys(providers).join(', ')}`,
                        tool,
                        method,
                    ),
                );
            }
            return provider.call(tool, method, args);
        },

        has(tool: string, method: string): boolean {
            const provider = providers[tool];
            if (!provider) return false;
            return provider.has(tool, method);
        },
    };
}
