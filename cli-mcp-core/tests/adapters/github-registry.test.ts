/**
 * Tests for GitHub registry adapter — gh CLI integration.
 */

import { describe, it, expect } from 'vitest';
import { createGitHubRegistry } from '#adapters/registry/github-registry.js';

describe('GitHub Registry', () => {
    it('should create a registry instance', () => {
        const registry = createGitHubRegistry();
        expect(registry).toBeDefined();
        expect(typeof registry.publish).toBe('function');
        expect(typeof registry.install).toBe('function');
        expect(typeof registry.search).toBe('function');
    });

    it('should reject publish of nonexistent file', async () => {
        const registry = createGitHubRegistry();
        const result = await registry.publish('/nonexistent/workflow.md');
        expect(result.ok).toBe(false);
    });

    it('should reject install with invalid ref format', async () => {
        const registry = createGitHubRegistry();
        const result = await registry.install('no-slash-ref');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('Invalid ref');
        }
    });

    it('should return empty results for search when gh fails', async () => {
        const registry = createGitHubRegistry();
        const result = await registry.search('chainskills-test-query');
        // gh search may fail (no auth, rate limit) — should return empty, not error
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Array.isArray(result.value.entries)).toBe(true);
        }
    });
});
