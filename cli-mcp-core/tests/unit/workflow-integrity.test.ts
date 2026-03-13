/**
 * Tests for workflow integrity service (hash computation & verification).
 */

import { describe, it, expect } from 'vitest';
import {
    computeWorkflowHash,
    verifyWorkflowIntegrity,
} from '../../src/core/services/workflow-integrity.js';

const SAMPLE_WORKFLOW = `---
name: test-workflow
description: A test workflow
version: 1.0.0
inputs:
  - name: target
    type: string
tags: [test]
---

# Step 1

@call shell.exec("echo hello") → $result

@output: $result
`;

describe('computeWorkflowHash', () => {
    it('should return a hex SHA-256 hash', () => {
        const hash = computeWorkflowHash(SAMPLE_WORKFLOW);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce stable hashes for identical content', () => {
        const hash1 = computeWorkflowHash(SAMPLE_WORKFLOW);
        const hash2 = computeWorkflowHash(SAMPLE_WORKFLOW);
        expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
        const modified = SAMPLE_WORKFLOW.replace('echo hello', 'echo world');
        const hash1 = computeWorkflowHash(SAMPLE_WORKFLOW);
        const hash2 = computeWorkflowHash(modified);
        expect(hash1).not.toBe(hash2);
    });

    it('should ignore runStats when computing hash', () => {
        const withStats = SAMPLE_WORKFLOW.replace(
            'tags: [test]',
            'tags: [test]\nrunStats:\n  totalRuns: 42\n  successCount: 40',
        );
        const hash1 = computeWorkflowHash(SAMPLE_WORKFLOW);
        const hash2 = computeWorkflowHash(withStats);
        expect(hash1).toBe(hash2);
    });

    it('should ignore validatedBy and validatedAt when computing hash', () => {
        const withValidation = SAMPLE_WORKFLOW.replace(
            'tags: [test]',
            'tags: [test]\nvalidatedBy: alice\nvalidatedAt: "2026-01-01T00:00:00Z"',
        );
        const hash1 = computeWorkflowHash(SAMPLE_WORKFLOW);
        const hash2 = computeWorkflowHash(withValidation);
        expect(hash1).toBe(hash2);
    });

    it('should ignore validationHash field', () => {
        const withHash = SAMPLE_WORKFLOW.replace(
            'tags: [test]',
            'tags: [test]\nvalidationHash: abcdef1234567890',
        );
        const hash1 = computeWorkflowHash(SAMPLE_WORKFLOW);
        const hash2 = computeWorkflowHash(withHash);
        expect(hash1).toBe(hash2);
    });

    it('should detect changes to workflow body', () => {
        const modified = SAMPLE_WORKFLOW.replace('@output: $result', '@output: $other');
        const hash1 = computeWorkflowHash(SAMPLE_WORKFLOW);
        const hash2 = computeWorkflowHash(modified);
        expect(hash1).not.toBe(hash2);
    });

    it('should detect changes to meaningful frontmatter fields', () => {
        const modified = SAMPLE_WORKFLOW.replace('version: 1.0.0', 'version: 2.0.0');
        const hash1 = computeWorkflowHash(SAMPLE_WORKFLOW);
        const hash2 = computeWorkflowHash(modified);
        expect(hash1).not.toBe(hash2);
    });

    it('should handle source without frontmatter', () => {
        const noFm = '# Just a heading\n\n@call shell.exec("echo hi")';
        const hash = computeWorkflowHash(noFm);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
});

describe('verifyWorkflowIntegrity', () => {
    it('should return true for unmodified workflow', () => {
        const hash = computeWorkflowHash(SAMPLE_WORKFLOW);
        expect(verifyWorkflowIntegrity(SAMPLE_WORKFLOW, hash)).toBe(true);
    });

    it('should return false for modified workflow', () => {
        const hash = computeWorkflowHash(SAMPLE_WORKFLOW);
        const modified = SAMPLE_WORKFLOW.replace('echo hello', 'echo tampered');
        expect(verifyWorkflowIntegrity(modified, hash)).toBe(false);
    });

    it('should return true despite volatile field changes', () => {
        const hash = computeWorkflowHash(SAMPLE_WORKFLOW);
        const withStats = SAMPLE_WORKFLOW.replace(
            'tags: [test]',
            'tags: [test]\nrunStats:\n  totalRuns: 100',
        );
        expect(verifyWorkflowIntegrity(withStats, hash)).toBe(true);
    });
});
