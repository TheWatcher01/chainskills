/**
 * Tests for local registry adapter — JSONL index on disk.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLocalRegistry } from '#adapters/registry/local-registry.js';

const TEST_WORKFLOW = `---
name: test-workflow
description: A test workflow
version: 0.2.0
author: tester
tags: [dev, test]
---

# Step 1

@call shell.exec(echo hello) → $result
`;

describe('Local Registry', () => {
    let tmpDir: string;
    let workflowPath: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'chainskills-local-reg-'));
        workflowPath = join(tmpDir, 'test-workflow.workflow.md');
        writeFileSync(workflowPath, TEST_WORKFLOW);
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should publish a workflow to local registry', async () => {
        // Override HOME to use tmpDir
        const registry = createLocalRegistry();
        const result = await registry.publish(workflowPath);

        expect(result.ok).toBe(true);
    });

    it('should reject publish of nonexistent file', async () => {
        const registry = createLocalRegistry();
        const result = await registry.publish('/nonexistent/workflow.md');

        expect(result.ok).toBe(false);
    });

    it('should reject publish of workflow without name', async () => {
        const noNamePath = join(tmpDir, 'no-name.workflow.md');
        writeFileSync(noNamePath, '---\ndescription: no name\n---\n# Step\n');

        const registry = createLocalRegistry();
        const result = await registry.publish(noNamePath);

        expect(result.ok).toBe(false);
    });

    it('should search returns empty for no matches', async () => {
        const registry = createLocalRegistry();
        const result = await registry.search('nonexistent-query-xyz');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.entries).toHaveLength(0);
        }
    });

    it('should return NOT_FOUND for unknown install ref', async () => {
        const registry = createLocalRegistry();
        const result = await registry.install('unknown-workflow');

        expect(result.ok).toBe(false);
    });
});
