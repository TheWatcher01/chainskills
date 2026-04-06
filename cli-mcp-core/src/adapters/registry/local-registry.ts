/**
 * Local registry adapter — JSONL-based workflow index on disk.
 *
 * Stores an index of installed workflows in `~/.chainskills/registry.jsonl`.
 * Each line is one RegistryEntry with added `path` and `published_at` fields.
 *
 * @module adapters/registry/local-registry
 */

import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import type { Result } from '#infra/errors.js';
import type { ResolveError } from '#infra/errors.js';
import { ok, err, resolveError } from '#infra/errors.js';
import type {
    WorkflowRegistry,
    RegistrySearchResult,
    RegistryEntry,
} from '#core/ports/workflow-registry.port.js';
import type { Logger } from '#infra/logger.js';

interface LocalRegistryEntry extends RegistryEntry {
    readonly path: string;
    readonly published_at: string;
    readonly tags?: readonly string[];
}

function getRegistryDir(): string {
    return join(homedir(), '.chainskills');
}

function getRegistryPath(): string {
    return join(getRegistryDir(), 'registry.jsonl');
}

function getWorkflowsDir(): string {
    return join(getRegistryDir(), 'workflows');
}

async function loadIndex(logger?: Logger): Promise<LocalRegistryEntry[]> {
    const path = getRegistryPath();
    try {
        const content = await readFile(path, 'utf-8');
        const entries: LocalRegistryEntry[] = [];
        for (const line of content.split('\n')) {
            if (!line.trim()) continue;
            try {
                entries.push(JSON.parse(line) as LocalRegistryEntry);
            } catch {
                logger?.warn(`Skipping malformed line in registry.jsonl`);
            }
        }
        return entries;
    } catch {
        return []; // File doesn't exist yet
    }
}

async function appendToIndex(entry: LocalRegistryEntry): Promise<void> {
    const dir = getRegistryDir();
    await mkdir(dir, { recursive: true });
    const line = JSON.stringify(entry) + '\n';
    await writeFile(getRegistryPath(), line, { flag: 'a' });
}

export function createLocalRegistry(config?: {
    readonly logger?: Logger;
}): WorkflowRegistry {
    const logger = config?.logger;

    return {
        async publish(workflowPath: string): Promise<Result<string, ResolveError>> {
            const absPath = resolve(workflowPath);

            let source: string;
            try {
                source = readFileSync(absPath, 'utf-8');
            } catch {
                return err(resolveError('FILE_NOT_FOUND', `Cannot read: ${workflowPath}`));
            }

            // Extract frontmatter fields
            const nameMatch = source.match(/^name:\s*(.+)$/m);
            const versionMatch = source.match(/^version:\s*(.+)$/m);
            const descMatch = source.match(/^description:\s*(.+)$/m);
            const authorMatch = source.match(/^author:\s*(.+)$/m);
            const tagsMatch = source.match(/^tags:\s*\[([^\]]*)\]/m);

            if (!nameMatch) {
                return err(resolveError('INVALID_WORKFLOW', 'Missing "name" in frontmatter'));
            }

            const name = nameMatch[1]!.trim();
            const version = versionMatch?.[1]?.trim() ?? '0.1.0';

            // Copy to ~/.chainskills/workflows/
            const workflowsDir = getWorkflowsDir();
            await mkdir(workflowsDir, { recursive: true });
            const targetPath = join(workflowsDir, `${name}.workflow.md`);
            await copyFile(absPath, targetPath);

            // Append to index
            const entry: LocalRegistryEntry = {
                name,
                version,
                description: descMatch?.[1]?.trim() ?? '',
                author: authorMatch?.[1]?.trim() ?? '',
                downloads: 0,
                path: targetPath,
                published_at: new Date().toISOString(),
                tags: tagsMatch?.[1]?.split(',').map((t) => t.trim().replace(/['"]/g, '')) ?? [],
            };

            await appendToIndex(entry);
            logger?.info(`Published ${name} v${version} to local registry`);

            return ok(targetPath);
        },

        async install(ref: string): Promise<Result<string, ResolveError>> {
            const index = await loadIndex(logger);

            // Search by name
            const entry = index.find((e) => e.name === ref);
            if (!entry) {
                return err(resolveError('NOT_FOUND', `Workflow "${ref}" not found in local registry`));
            }

            // Check file exists
            if (!existsSync(entry.path)) {
                return err(resolveError('FILE_NOT_FOUND', `Workflow file missing: ${entry.path}`));
            }

            return ok(entry.path);
        },

        async search(query: string): Promise<Result<RegistrySearchResult, ResolveError>> {
            const index = await loadIndex(logger);
            const q = query.toLowerCase();

            const matched = index.filter((e) =>
                e.name.toLowerCase().includes(q) ||
                e.description.toLowerCase().includes(q) ||
                e.tags?.some((t) => t.toLowerCase().includes(q)),
            );

            // Deduplicate by name (keep latest version)
            const byName = new Map<string, LocalRegistryEntry>();
            for (const entry of matched) {
                const existing = byName.get(entry.name);
                if (!existing || entry.published_at > existing.published_at) {
                    byName.set(entry.name, entry);
                }
            }

            const entries: RegistryEntry[] = [...byName.values()].map((e) => ({
                name: e.name,
                version: e.version,
                description: e.description,
                author: e.author,
                downloads: e.downloads,
            }));

            return ok({ entries, total: entries.length });
        },
    };
}
