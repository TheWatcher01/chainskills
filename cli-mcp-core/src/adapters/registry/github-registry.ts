/**
 * GitHub registry adapter — publish/install workflows via GitHub releases.
 *
 * Uses the `gh` CLI (https://cli.github.com) for all GitHub interactions.
 * No npm dependency required — same shell pattern as shell-tool-provider.
 *
 * @module adapters/registry/github-registry
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Result } from '#infra/errors.js';
import type { ResolveError } from '#infra/errors.js';
import { ok, err, resolveError } from '#infra/errors.js';
import type {
    WorkflowRegistry,
    RegistrySearchResult,
    RegistryEntry,
} from '#core/ports/workflow-registry.port.js';
import type { Logger } from '#infra/logger.js';

function runGh(args: string[], logger?: Logger): Result<string, ResolveError> {
    try {
        const output = execFileSync('gh', args, {
            encoding: 'utf-8',
            timeout: 30_000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return ok(output.trim());
    } catch (e: unknown) {
        const error = e as { code?: string; stderr?: string; message?: string };
        if (error.code === 'ENOENT') {
            return err(resolveError(
                'GH_NOT_FOUND',
                'gh CLI not installed. Install from https://cli.github.com',
            ));
        }
        const message = error.stderr ?? error.message ?? String(e);
        logger?.warn(`gh CLI error: ${message}`);
        return err(resolveError('GH_ERROR', message));
    }
}

export function createGitHubRegistry(config?: {
    readonly logger?: Logger;
    readonly installDir?: string;
}): WorkflowRegistry {
    const logger = config?.logger;
    const installDir = config?.installDir ?? './workflows';

    return {
        async publish(workflowPath: string): Promise<Result<string, ResolveError>> {
            const absPath = resolve(workflowPath);

            // Read and extract frontmatter
            let source: string;
            try {
                source = readFileSync(absPath, 'utf-8');
            } catch {
                return err(resolveError('FILE_NOT_FOUND', `Cannot read: ${workflowPath}`));
            }

            // Extract name and version from frontmatter
            const nameMatch = source.match(/^name:\s*(.+)$/m);
            const versionMatch = source.match(/^version:\s*(.+)$/m);

            if (!nameMatch) {
                return err(resolveError('INVALID_WORKFLOW', 'Workflow frontmatter missing "name"'));
            }

            const name = nameMatch[1]!.trim();
            const version = versionMatch?.[1]?.trim() ?? '0.1.0';
            const tag = `workflows/${name}/v${version}`;

            // Create release with workflow file as asset
            const result = runGh([
                'release', 'create', tag,
                absPath,
                '--title', `${name} v${version}`,
                '--notes', `Published workflow: ${name} v${version}`,
            ], logger);

            if (!result.ok) return result;

            logger?.info(`Published ${name} v${version} → ${tag}`);
            return ok(result.value);
        },

        async install(ref: string): Promise<Result<string, ResolveError>> {
            // ref format: owner/repo@version or owner/repo (latest)
            const [repoRef, version] = ref.split('@');
            if (!repoRef?.includes('/')) {
                return err(resolveError('INVALID_REF', `Invalid ref: ${ref}. Use owner/repo[@version]`));
            }

            // Find the latest workflow release
            const listResult = runGh([
                'release', 'list',
                '--repo', repoRef,
                '--limit', '10',
            ], logger);

            if (!listResult.ok) return listResult;

            // Parse releases to find matching tag
            const lines = listResult.value.split('\n').filter(Boolean);
            let targetTag = '';

            for (const line of lines) {
                const parts = line.split('\t');
                const releaseTag = parts[2] ?? parts[0] ?? '';
                if (releaseTag.startsWith('workflows/') && (version ? releaseTag.includes(`v${version}`) : true)) {
                    targetTag = releaseTag;
                    break;
                }
            }

            if (!targetTag) {
                return err(resolveError('NOT_FOUND', `No workflow release found in ${repoRef}`));
            }

            // Download assets
            const downloadResult = runGh([
                'release', 'download', targetTag,
                '--repo', repoRef,
                '--pattern', '*.workflow.md',
                '--dir', resolve(installDir),
            ], logger);

            if (!downloadResult.ok) return downloadResult;

            logger?.info(`Installed ${ref} → ${installDir}/`);
            return ok(resolve(installDir));
        },

        async search(query: string): Promise<Result<RegistrySearchResult, ResolveError>> {
            const result = runGh([
                'search', 'repos', query,
                '--topic', 'chainskills-workflow',
                '--json', 'name,description,owner,stargazersCount',
                '--limit', '20',
            ], logger);

            if (!result.ok) {
                // Fallback: return empty results on search failure
                return ok({ entries: [], total: 0 });
            }

            try {
                const repos = JSON.parse(result.value) as Array<{
                    name: string;
                    description: string;
                    owner: { login: string };
                    stargazersCount: number;
                }>;

                const entries: RegistryEntry[] = repos.map((r) => ({
                    name: `${r.owner.login}/${r.name}`,
                    version: 'latest',
                    description: r.description ?? '',
                    author: r.owner.login,
                    downloads: r.stargazersCount,
                }));

                return ok({ entries, total: entries.length });
            } catch {
                return ok({ entries: [], total: 0 });
            }
        },
    };
}
