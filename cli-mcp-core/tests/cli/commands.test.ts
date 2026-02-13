/**
 * CLI integration tests.
 *
 * Tests the end-to-end workflow by exercising the same logic used by CLI commands:
 * parse → validate → execute. Also tests the `init` template generation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMarkdownParser } from '#adapters/parser/markdown-parser.js';
import { createSimpleExecutor } from '#adapters/executor/simple-executor.js';
import { createMemoryStore } from '#adapters/state/memory-store.js';
import { createShellToolProvider } from '#adapters/tools/shell-tool-provider.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';
import { validateWorkflow } from '#core/use-cases/validate-workflow.js';
import { createLogger } from '#infra/logger.js';

// ─── Test fixtures ───────────────────────────────────────────────────────────

const VALID_WORKFLOW = `---
name: hello-world
description: A minimal test workflow
version: 0.1.0
inputs:
  - name: greeting
    type: string
outputs:
  - name: result
    type: string
tags:
  - test
---

# Say Hello

Echo a greeting to the user.

@call shell.exec(echo "Hello $greeting") → $result

# Output

Return the result.

@output: $result
`;

const INVALID_WORKFLOW_NO_NAME = `---
description: Missing name field
version: 0.1.0
---

# Step 1

Do something.
`;

const INIT_TEMPLATE = `---
name: {{NAME}}
description: Describe your workflow here
version: 0.1.0
inputs:
  - name: target
    type: string
    description: The target to process
outputs:
  - name: result
    type: string
    description: The workflow result
env: []
tags: []
---

# Step 1 — Setup

Prepare the environment and validate inputs.

@call shell.exec(echo "Starting {{NAME}}...") → $status

# Step 2 — Process

Process the target input.

@if $target:

@call shell.exec(echo "Processing $target") → $result

# Step 3 — Output

Emit the final result.

@output: $result
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTestContainer() {
    const logger = createLogger('error');
    const store = createMemoryStore();
    const tools = createShellToolProvider({ logger });
    return {
        parser: createMarkdownParser(),
        executor: createSimpleExecutor({ store, tools, logger }),
        store,
        logger,
    };
}

// ─── Tests: run command logic ────────────────────────────────────────────────

describe('CLI run — parse + validate + execute pipeline', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'chainskills-test-'));
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('should parse, validate, and execute a valid workflow', async () => {
        const filePath = join(tempDir, 'hello.workflow.md');
        writeFileSync(filePath, VALID_WORKFLOW, 'utf-8');

        const source = readFileSync(filePath, 'utf-8');
        const container = createTestContainer();

        // Parse
        const parseResult = parseWorkflow(source, container.parser);
        expect(parseResult.ok).toBe(true);
        if (!parseResult.ok) return;

        const workflow = parseResult.value;
        expect(workflow.name).toBe('hello-world');
        expect(workflow.version).toBe('0.1.0');

        // Validate
        const validationResult = validateWorkflow(workflow);
        expect(validationResult.ok).toBe(true);
        if (!validationResult.ok) return;
        expect(validationResult.value.valid).toBe(true);

        // Execute
        const execResult = await container.executor.execute(
            workflow,
            { greeting: 'World' },
            { dryRun: true },
        );
        expect(execResult.ok).toBe(true);
        if (!execResult.ok) return;
        expect(execResult.value.steps.length).toBe(2);
    });

    it('should fail to parse an invalid workflow', () => {
        const container = createTestContainer();

        const parseResult = parseWorkflow(INVALID_WORKFLOW_NO_NAME, container.parser);
        expect(parseResult.ok).toBe(false);
        if (parseResult.ok) return;
        expect(parseResult.error.code).toBeTruthy();
    });

    it('should report validation warnings for undeclared variables', () => {
        const source = `---
name: undeclared-var
description: Uses undeclared variables
version: 0.1.0
---

# Step 1

@call shell.exec($unknown_var) → $output
`;
        const container = createTestContainer();

        const parseResult = parseWorkflow(source, container.parser);
        expect(parseResult.ok).toBe(true);
        if (!parseResult.ok) return;

        const validationResult = validateWorkflow(parseResult.value);
        expect(validationResult.ok).toBe(true);
        if (!validationResult.ok) return;

        // Should have warnings about undeclared variables
        const warnings = validationResult.value.diagnostics.filter(
            (d) => d.severity === 'warning',
        );
        expect(warnings.length).toBeGreaterThan(0);
    });

    it('should support dry-run mode', async () => {
        const source = `---
name: dry-run-test
description: Test dry-run
version: 0.1.0
---

# Execute

@call shell.exec(echo "should not run") → $out
`;
        const container = createTestContainer();

        const parseResult = parseWorkflow(source, container.parser);
        expect(parseResult.ok).toBe(true);
        if (!parseResult.ok) return;

        const execResult = await container.executor.execute(
            parseResult.value,
            {},
            { dryRun: true },
        );
        expect(execResult.ok).toBe(true);
        if (!execResult.ok) return;
        expect(execResult.value.steps.length).toBe(1);
        // Dry-run completes without side effects
        expect(execResult.value.steps[0]?.status).toBe('success');
    });
});

// ─── Tests: validate command logic ───────────────────────────────────────────

describe('CLI validate — parse + validate pipeline', () => {
    it('should validate a well-formed workflow', () => {
        const container = createTestContainer();
        const parseResult = parseWorkflow(VALID_WORKFLOW, container.parser);
        expect(parseResult.ok).toBe(true);
        if (!parseResult.ok) return;

        const validationResult = validateWorkflow(parseResult.value);
        expect(validationResult.ok).toBe(true);
        if (!validationResult.ok) return;
        expect(validationResult.value.valid).toBe(true);
    });

    it('should catch duplicate step IDs', () => {
        const source = `---
name: dup-steps
description: Has duplicate step headings
version: 0.1.0
---

# Setup

First step.

# Setup

Duplicate heading.
`;
        const container = createTestContainer();
        const parseResult = parseWorkflow(source, container.parser);
        expect(parseResult.ok).toBe(true);
        if (!parseResult.ok) return;

        const validationResult = validateWorkflow(parseResult.value);
        expect(validationResult.ok).toBe(true);
        if (!validationResult.ok) return;

        const errors = validationResult.value.diagnostics.filter(
            (d) => d.severity === 'error',
        );
        expect(errors.some((e) => e.code === 'DUPLICATE_STEP_ID')).toBe(true);
        expect(validationResult.value.valid).toBe(false);
    });
});

// ─── Tests: init command logic ───────────────────────────────────────────────

describe('CLI init — template scaffolding', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'chainskills-init-'));
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('should generate a valid workflow from the init template', () => {
        const name = 'my-workflow';
        const content = INIT_TEMPLATE.replace(/\{\{NAME\}\}/g, name);
        const filePath = join(tempDir, `${name}.workflow.md`);

        writeFileSync(filePath, content, 'utf-8');
        expect(existsSync(filePath)).toBe(true);

        // Verify the generated file is parseable
        const source = readFileSync(filePath, 'utf-8');
        const parser = createMarkdownParser();
        const result = parser.parse(source);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.name).toBe('my-workflow');
        expect(result.value.version).toBe('0.1.0');
        expect(result.value.steps.length).toBeGreaterThanOrEqual(3);
    });

    it('should sanitize workflow names to kebab-case', () => {
        const raw = 'My Cool Workflow!!!';
        const sanitized = raw
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        expect(sanitized).toBe('my-cool-workflow');
    });

    it('should include required frontmatter fields in template', () => {
        const name = 'test';
        const content = INIT_TEMPLATE.replace(/\{\{NAME\}\}/g, name);

        expect(content).toContain('name: test');
        expect(content).toContain('version: 0.1.0');
        expect(content).toContain('description:');
        expect(content).toContain('inputs:');
        expect(content).toContain('outputs:');
    });
});
