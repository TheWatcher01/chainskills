/**
 * Tests for container directive parsing (:::parallel, :::if, :::for, etc.).
 *
 * Validates that block-level remark-directive nodes are correctly parsed
 * into nested Step structures with children.
 */

import { describe, it, expect } from 'vitest';
import { createMarkdownParser } from '#adapters/parser/markdown-parser.js';

const parser = createMarkdownParser();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseSteps(source: string) {
    const result = parser.parse(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    return result.value.steps;
}

const FRONTMATTER = `---
name: container-test
description: Test container directives
version: 0.1.0
---

`;

// ─── Inline @directive Fallback ──────────────────────────────────────────────

describe('Container directives — inline fallback', () => {
    it('should parse inline @if as a flat directive', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Check

@if $score > 50:

@call shell.exec(echo yes) → $out
`);

        const step = steps.find((s) => s.id === 'check');
        expect(step).toBeDefined();
        expect(step!.directives.length).toBeGreaterThanOrEqual(1);

        const ifDir = step!.directives.find((d) => d.type === 'if');
        expect(ifDir).toBeDefined();
        expect(ifDir!.args['condition']).toBe('$score > 50');
    });

    it('should parse inline @for as a flat directive', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Iterate

@for $item in $list:

@call shell.exec(echo $item) → $out
`);

        const step = steps.find((s) => s.id === 'iterate');
        expect(step).toBeDefined();

        const forDir = step!.directives.find((d) => d.type === 'for');
        expect(forDir).toBeDefined();
        expect(forDir!.args['variable']).toBe('$item');
        expect(forDir!.args['iterable']).toBe('$list');
    });

    it('should parse inline @repeat as a flat directive', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Retry

@repeat max:5 until $done == true:
`);

        const step = steps.find((s) => s.id === 'retry');
        expect(step).toBeDefined();

        const repeatDir = step!.directives.find((d) => d.type === 'repeat');
        expect(repeatDir).toBeDefined();
        expect(repeatDir!.args['max']).toBe(5);
    });

    it('should parse inline @try as a flat directive', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Safe

@try:

@call shell.exec(echo ok) → $out

@on-error: log and continue
`);

        const step = steps.find((s) => s.id === 'safe');
        expect(step).toBeDefined();

        const tryDir = step!.directives.find((d) => d.type === 'try');
        expect(tryDir).toBeDefined();

        const onError = step!.directives.find((d) => d.type === 'on-error');
        expect(onError).toBeDefined();
    });
});

// ─── @call Directive Parsing ─────────────────────────────────────────────────

describe('Container directives — @call parsing', () => {
    it('should parse @call with arrow capture', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Execute

@call shell.exec(echo hello) → $result
`);

        const step = steps.find((s) => s.id === 'execute');
        expect(step).toBeDefined();

        const callDir = step!.directives.find((d) => d.type === 'call');
        expect(callDir).toBeDefined();
        expect(callDir!.args['tool']).toBe('shell');
        expect(callDir!.args['method']).toBe('exec');
        expect(callDir!.args['capture']).toBe('result');
    });
});

// ─── @output Directive ───────────────────────────────────────────────────────

describe('Container directives — @output', () => {
    it('should parse @output with multiple variables', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Result

@output: $report, $score
`);

        const step = steps.find((s) => s.id === 'result');
        expect(step).toBeDefined();

        const outputDir = step!.directives.find((d) => d.type === 'output');
        expect(outputDir).toBeDefined();
        expect(outputDir!.args['variables']).toEqual(['$report', '$score']);
    });
});

// ─── @env Directive ──────────────────────────────────────────────────────────

describe('Container directives — @env', () => {
    it('should parse @env directive', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Config

@env API_KEY
`);

        const step = steps.find((s) => s.id === 'config');
        expect(step).toBeDefined();

        const envDir = step!.directives.find((d) => d.type === 'env');
        expect(envDir).toBeDefined();
        expect(envDir!.args['name']).toBe('API_KEY');
    });
});

// ─── @assert Directive ───────────────────────────────────────────────────────

describe('Container directives — @assert', () => {
    it('should parse @assert with expression', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Validate

@assert $total == $expected
`);

        const step = steps.find((s) => s.id === 'validate');
        expect(step).toBeDefined();

        const assertDir = step!.directives.find((d) => d.type === 'assert');
        expect(assertDir).toBeDefined();
        expect(assertDir!.args['expression']).toBe('$total == $expected');
    });
});

// ─── @use Directive ──────────────────────────────────────────────────────────

describe('Container directives — @use', () => {
    it('should parse @use with reference', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Setup

@use ./skills/helper.workflow.md
`);

        const step = steps.find((s) => s.id === 'setup');
        expect(step).toBeDefined();

        const useDir = step!.directives.find((d) => d.type === 'use');
        expect(useDir).toBeDefined();
        expect(useDir!.args['ref']).toContain('helper.workflow.md');
    });
});

// ─── Multiple Directives in One Step ──────────────────────────────────────────

describe('Container directives — multiple in one step', () => {
    it('should parse multiple different directives in a single step', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Multi

@env API_KEY

@call shell.exec(echo $API_KEY) → $result

@assert $result

@output: $result
`);

        const step = steps.find((s) => s.id === 'multi');
        expect(step).toBeDefined();
        expect(step!.directives.length).toBeGreaterThanOrEqual(3);

        const types = step!.directives.map((d) => d.type);
        expect(types).toContain('env');
        expect(types).toContain('call');
        expect(types).toContain('output');
    });
});

// ─── @agent / @handoff ───────────────────────────────────────────────────────

describe('Container directives — @agent / @handoff', () => {
    it('should parse @agent directive', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Delegate

@agent copilot: "Fix this bug"
`);

        const step = steps.find((s) => s.id === 'delegate');
        expect(step).toBeDefined();

        const agentDir = step!.directives.find((d) => d.type === 'agent');
        expect(agentDir).toBeDefined();
        expect(agentDir!.args['agent']).toBe('copilot');
        expect(agentDir!.args['message']).toBe('Fix this bug');
    });

    it('should parse @handoff directive', () => {
        const steps = parseSteps(`${FRONTMATTER}
# Transfer

@handoff review-agent: "Review the changes"
`);

        const step = steps.find((s) => s.id === 'transfer');
        expect(step).toBeDefined();

        const handoffDir = step!.directives.find((d) => d.type === 'handoff');
        expect(handoffDir).toBeDefined();
        expect(handoffDir!.args['target']).toBe('review-agent');
        expect(handoffDir!.args['message']).toBe('Review the changes');
    });
});
