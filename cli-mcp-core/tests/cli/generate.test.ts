/**
 * Tests for generate command logic — workflow variant generation.
 */

import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt, extractWorkflowSource } from '#core/services/workflow-generation.js';
import { DEFAULT_CONSTRAINTS, type WorkflowVariant, type GenerationReport } from '#core/entities/generation-config.js';

const TEMPLATE_SOURCE = `---
name: code-review
description: Review code for quality
version: 0.1.0
inputs:
  - name: code
    type: string
outputs:
  - name: review
    type: string
---

# Analyze

@agent copilot: "Review this code: $code" → $review

# Output

@output: $review
`;

describe('generate command logic', () => {
    it('should build a generation prompt with template and constraint', () => {
        const prompt = buildGenerationPrompt(
            TEMPLATE_SOURCE,
            DEFAULT_CONSTRAINTS[0]!,
            'code-review',
        );
        expect(prompt).toContain('code-review');
        expect(prompt).toContain('speed');
        expect(prompt).toContain('@agent');
    });

    it('should build WorkflowVariant from generation result', () => {
        const variant: WorkflowVariant = {
            baseWorkflow: 'code-review',
            variantIndex: 0,
            constraint: 'speed',
            source: TEMPLATE_SOURCE,
            valid: true,
            model: 'gpt-4o',
            tokens: { prompt: 500, completion: 300, total: 800 },
            generatedAt: new Date().toISOString(),
        };

        expect(variant.valid).toBe(true);
        expect(variant.constraint).toBe('speed');
    });

    it('should build GenerationReport with stats', () => {
        const variants: WorkflowVariant[] = [
            { baseWorkflow: 'wf', variantIndex: 0, constraint: 'speed', source: '...', valid: true, model: 'm', generatedAt: '' },
            { baseWorkflow: 'wf', variantIndex: 1, constraint: 'reliability', source: '...', valid: true, model: 'm', generatedAt: '' },
            { baseWorkflow: 'wf', variantIndex: 2, constraint: 'validation', source: '', valid: false, validationError: 'parse error', model: 'm', generatedAt: '' },
        ];

        const report: GenerationReport = {
            template: 'code-review',
            totalVariations: 3,
            successful: variants.filter((v) => v.valid).length,
            failed: variants.filter((v) => !v.valid).length,
            totalTokens: 2400,
            variants,
            generatedBy: 'gpt-4o',
            timestamp: new Date().toISOString(),
        };

        expect(report.successful).toBe(2);
        expect(report.failed).toBe(1);
    });

    it('should extract workflow source from code block', () => {
        const raw = '```markdown\n---\nname: variant\n---\n## Step\n@call shell.exec(hi)\n```';
        const source = extractWorkflowSource(raw);
        expect(source).toContain('name: variant');
        expect(source).not.toContain('```');
    });
});
