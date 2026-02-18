/**
 * Tests for frontmatter parser adapter.
 */

import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '#adapters/parser/frontmatter-parser.js';

describe('parseFrontmatter', () => {
    it('should parse valid frontmatter with all fields', () => {
        const source = `---
name: code-review
description: Automated code review workflow
version: 1.0.0
inputs:
  - name: target
    type: string
    description: File or directory to review
outputs:
  - name: report
    type: string
env:
  - OPENAI_API_KEY
tags:
  - dev
  - review
author: TheWatcher01
license: MIT
---

# Step 1
Do something.
`;

        const result = parseFrontmatter(source);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const { frontmatter, body } = result.value;
        expect(frontmatter.name).toBe('code-review');
        expect(frontmatter.description).toBe('Automated code review workflow');
        expect(frontmatter.version).toBe('1.0.0');
        expect(frontmatter.inputs).toHaveLength(1);
        expect(frontmatter.inputs[0]!.name).toBe('target');
        expect(frontmatter.outputs).toHaveLength(1);
        expect(frontmatter.env).toEqual(['OPENAI_API_KEY']);
        expect(frontmatter.tags).toEqual(['dev', 'review']);
        expect(frontmatter.metadata.author).toBe('TheWatcher01');
        expect(frontmatter.metadata.license).toBe('MIT');
        expect(body).toContain('# Step 1');
    });

    it('should parse minimal frontmatter (name only)', () => {
        const source = `---
name: minimal
---

Body text.
`;

        const result = parseFrontmatter(source);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const { frontmatter } = result.value;
        expect(frontmatter.name).toBe('minimal');
        expect(frontmatter.version).toBe('0.1.0'); // default
        expect(frontmatter.inputs).toHaveLength(0);
        expect(frontmatter.outputs).toHaveLength(0);
        expect(frontmatter.env).toHaveLength(0);
        expect(frontmatter.tags).toHaveLength(0);
    });

    it('should error on missing name', () => {
        const source = `---
description: No name provided
---

Body.
`;

        const result = parseFrontmatter(source);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('FRONTMATTER_VALIDATION_ERROR');
    });

    it('should error on empty name', () => {
        const source = `---
name: ""
---

Body.
`;

        const result = parseFrontmatter(source);
        expect(result.ok).toBe(false);
    });

    it('should handle missing frontmatter gracefully', () => {
        const source = `# Just Markdown

No frontmatter at all.
`;

        const result = parseFrontmatter(source);
        // gray-matter produces empty data → missing name → validation error
        expect(result.ok).toBe(false);
    });

    it('should separate body from frontmatter correctly', () => {
        const source = `---
name: test-workflow
---

# Step 1

Do the first thing.

# Step 2

Do the second thing.
`;

        const result = parseFrontmatter(source);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.body).toContain('# Step 1');
        expect(result.value.body).toContain('# Step 2');
        expect(result.value.body).not.toContain('name:');
    });
});
