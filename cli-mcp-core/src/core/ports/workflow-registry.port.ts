/**
 * Workflow registry port — search, install, and publish workflows.
 *
 * Stub for MVP — will be implemented in v0.4.0 (Registry & Distribution).
 *
 * @module core/ports/workflow-registry
 */

import type { Result } from '#infra/errors.js';
import type { ResolveError } from '#infra/errors.js';

/** A workflow listing from the registry. */
export interface RegistryEntry {
    readonly name: string;
    readonly version: string;
    readonly description: string;
    readonly author: string;
    readonly downloads: number;
}

/** Search result from registry. */
export interface RegistrySearchResult {
    readonly entries: readonly RegistryEntry[];
    readonly total: number;
}

/**
 * Registry for discovering, installing, and publishing workflows.
 *
 * Not implemented in MVP — all methods return stubs.
 */
export interface WorkflowRegistry {
    /** Search the registry for workflows matching `query`. */
    search(query: string): Promise<Result<RegistrySearchResult, ResolveError>>;

    /** Install a workflow by reference (e.g. `owner/repo@workflow-name`). */
    install(ref: string): Promise<Result<string, ResolveError>>;

    /** Publish a workflow to the registry. */
    publish(workflowPath: string): Promise<Result<string, ResolveError>>;
}
