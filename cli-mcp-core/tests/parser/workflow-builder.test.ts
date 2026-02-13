/**
 * Integration test: full .workflow.md parsing (frontmatter + markdown + directives).
 */

import { describe, it, expect } from 'vitest';
import { createMarkdownParser } from '#adapters/parser/markdown-parser.js';

const parser = createMarkdownParser();

describe('createMarkdownParser — full workflow parsing', () => {
    it('should parse a complete workflow with steps and directives', () => {
        const source = `---
name: code-review
description: Automated code review
version: 1.0.0
inputs:
  - name: target
    type: string
outputs:
  - name: report
    type: string
tags:
  - dev
---

# Analyze Code

Read the target files and run static analysis.

@call shell.exec($target) → $analysis

# Generate Report

Compile the analysis into a report.

@if $analysis > 0:

@output: $report
`;

        const result = parser.parse(source);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const workflow = result.value;
        expect(workflow.name).toBe('code-review');
        expect(workflow.description).toBe('Automated code review');
        expect(workflow.version).toBe('1.0.0');
        expect(workflow.inputs).toHaveLength(1);
        expect(workflow.outputs).toHaveLength(1);
        expect(workflow.tags).toEqual(['dev']);
        expect(workflow.steps.length).toBeGreaterThanOrEqual(2);

        // First step
        const step1 = workflow.steps[0]!;
        expect(step1.title).toBe('Analyze Code');
        expect(step1.id).toBe('analyze-code');

        // Second step
        const step2 = workflow.steps[1]!;
        expect(step2.title).toBe('Generate Report');
        expect(step2.id).toBe('generate-report');
    });

    it('should parse a workflow with @use directives', () => {
        const source = `---
name: with-imports
description: Workflow with imports
version: 0.1.0
---

# Setup

@use ./skills/helper.workflow.md

# Execute

Do the thing.
`;

        const result = parser.parse(source);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const workflow = result.value;
        expect(workflow.steps.length).toBeGreaterThanOrEqual(2);

        // The @use directive should be captured
        const setupStep = workflow.steps.find((s) => s.id === 'setup');
        expect(setupStep).toBeDefined();
        const useDirective = setupStep?.directives.find(
            (d) => d.type === 'use',
        );
        expect(useDirective).toBeDefined();
        expect(useDirective?.args['ref']).toContain('helper.workflow.md');
    });

    it('should parse a workflow with no steps (body only)', () => {
        const source = `---
name: empty-workflow
description: No steps
version: 0.1.0
---

Just some body text without headings.
`;

        const result = parser.parse(source);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.steps).toHaveLength(0);
    });

    it('should fail on invalid frontmatter', () => {
        const source = `---
invalid: true
---

# Step 1
`;

        const result = parser.parse(source);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('FRONTMATTER_VALIDATION_ERROR');
    });

    it('should handle multiple directives in one step', () => {
        const source = `---
name: multi-directive
description: Step with multiple directives
version: 0.1.0
---

# Multi Step

@call shell.exec(echo hello) → $greeting

@if $greeting == "hello":

@output: $greeting
`;

        const result = parser.parse(source);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const step = result.value.steps[0];
        expect(step).toBeDefined();
        expect(step!.directives.length).toBeGreaterThanOrEqual(1);
    });
});
