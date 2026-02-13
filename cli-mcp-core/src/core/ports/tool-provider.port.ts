/**
 * Tool provider port — invokes tools referenced by `@call` directives.
 *
 * Implemented by `shell-tool-provider` (MVP — executes shell commands),
 * and later by `mcp-tool-provider` (v0.3+).
 *
 * @module core/ports/tool-provider
 */

import type { Result } from '#infra/errors.js';
import type { ToolError } from '#infra/errors.js';

/**
 * Provides tool invocation for `@call tool.method(args) → $capture`.
 */
export interface ToolProvider {
    /** Invoke a tool method with arguments and return the result. */
    call(
        tool: string,
        method: string,
        args: Record<string, unknown>,
    ): Promise<Result<unknown, ToolError>>;

    /** Check whether a tool.method is available. */
    has(tool: string, method: string): boolean;
}
