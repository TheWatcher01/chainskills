/**
 * Tests for new validation lifecycle frontmatter fields.
 */

import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../../src/adapters/parser/frontmatter-parser.js';

describe('Frontmatter validation lifecycle fields', () => {
    it('should parse status field', () => {
        const source = `---
name: test
status: validated
---
# Step 1
`;
        const result = parseFrontmatter(source);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.metadata.status).toBe('validated');
        }
    });

    it('should parse validatedBy field', () => {
        const source = `---
name: test
validatedBy: alice
---
# Step 1
`;
        const result = parseFrontmatter(source);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.metadata.validatedBy).toBe('alice');
        }
    });

    it('should parse validatedAt field', () => {
        const source = `---
name: test
validatedAt: "2026-01-15T10:30:00Z"
---
# Step 1
`;
        const result = parseFrontmatter(source);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.metadata.validatedAt).toBe('2026-01-15T10:30:00Z');
        }
    });

    it('should parse validationHash field', () => {
        const source = `---
name: test
validationHash: abc123def456
---
# Step 1
`;
        const result = parseFrontmatter(source);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.metadata.validationHash).toBe('abc123def456');
        }
    });

    it('should parse runStats field', () => {
        const source = `---
name: test
runStats:
  totalRuns: 42
  successCount: 40
  lastRunAt: "2026-01-15T10:30:00Z"
---
# Step 1
`;
        const result = parseFrontmatter(source);
        expect(result.ok).toBe(true);
        if (result.ok) {
            const stats = result.value.frontmatter.metadata.runStats;
            expect(stats).toBeDefined();
            expect(stats!.totalRuns).toBe(42);
            expect(stats!.successCount).toBe(40);
        }
    });

    it('should reject invalid status values', () => {
        const source = `---
name: test
status: invalid-status
---
# Step 1
`;
        const result = parseFrontmatter(source);
        expect(result.ok).toBe(false);
    });

    it('should accept all valid status values', () => {
        for (const status of ['draft', 'validated', 'deprecated']) {
            const source = `---
name: test
status: ${status}
---
# Step 1
`;
            const result = parseFrontmatter(source);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.frontmatter.metadata.status).toBe(status);
            }
        }
    });

    it('should default to no status when omitted', () => {
        const source = `---
name: test
---
# Step 1
`;
        const result = parseFrontmatter(source);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.metadata.status).toBeUndefined();
        }
    });
});
