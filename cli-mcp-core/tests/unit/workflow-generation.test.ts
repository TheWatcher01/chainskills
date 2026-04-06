/**
 * Tests for workflow generation service.
 */

import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt, extractWorkflowSource } from '#core/services/workflow-generation.js';
import { DEFAULT_CONSTRAINTS } from '#core/entities/generation-config.js';

describe('buildGenerationPrompt', () => {
    it('should include the template source', () => {
        const prompt = buildGenerationPrompt(
            '---\nname: test\n---\n## Step 1\n@call shell.exec(echo hi)',
            DEFAULT_CONSTRAINTS[0]!,
            'test-workflow',
        );
        expect(prompt).toContain('name: test');
        expect(prompt).toContain('@call shell.exec');
    });

    it('should include the constraint name and description', () => {
        const constraint = { name: 'speed', description: 'Optimize for speed' };
        const prompt = buildGenerationPrompt('template', constraint, 'wf');
        expect(prompt).toContain('speed');
        expect(prompt).toContain('Optimize for speed');
    });

    it('should include the variant name pattern', () => {
        const prompt = buildGenerationPrompt('template', DEFAULT_CONSTRAINTS[0]!, 'my-wf');
        expect(prompt).toContain('my-wf-speed');
    });

    it('should include directive reference', () => {
        const prompt = buildGenerationPrompt('template', DEFAULT_CONSTRAINTS[0]!, 'wf');
        expect(prompt).toContain('@schema');
        expect(prompt).toContain('@gate');
        expect(prompt).toContain('@parallel');
    });
});

describe('extractWorkflowSource', () => {
    it('should extract from markdown code block', () => {
        const output = '```markdown\n---\nname: test\n---\n## Step\n@call shell.exec(hi)\n```';
        const source = extractWorkflowSource(output);
        expect(source).toContain('name: test');
        expect(source).not.toContain('```');
    });

    it('should extract from md code block', () => {
        const output = '```md\n---\nname: test\n---\n```';
        const source = extractWorkflowSource(output);
        expect(source).toContain('name: test');
    });

    it('should handle direct frontmatter output', () => {
        const output = '---\nname: direct\n---\n## Step\n@call shell.exec(hi)';
        const source = extractWorkflowSource(output);
        expect(source).toContain('name: direct');
    });

    it('should handle raw output as fallback', () => {
        const output = 'Some workflow content without frontmatter';
        const source = extractWorkflowSource(output);
        expect(source).toBe('Some workflow content without frontmatter');
    });
});

describe('DEFAULT_CONSTRAINTS', () => {
    it('should have 5 predefined constraints', () => {
        expect(DEFAULT_CONSTRAINTS).toHaveLength(5);
    });

    it('should include speed, reliability, validation, parallel, observability', () => {
        const names = DEFAULT_CONSTRAINTS.map((c) => c.name);
        expect(names).toContain('speed');
        expect(names).toContain('reliability');
        expect(names).toContain('validation');
        expect(names).toContain('parallel');
        expect(names).toContain('observability');
    });
});
