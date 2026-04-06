/**
 * Reflexion service — anti-loop memory for agent exploration.
 *
 * Tracks hypotheses, detects cycles, generates anti-loop context,
 * and suggests unexplored areas.
 *
 * Inspired by Reflexion (NeurIPS 2023) + LATS (ICML 2024).
 *
 * Pure functions, zero external dependencies.
 *
 * @module core/services/reflexion
 */

import type { Hypothesis, ExplorationTree } from '../entities/hypothesis.js';

/**
 * Create an empty exploration tree for a task.
 */
export function createTree(taskId: string): ExplorationTree {
    return {
        taskId,
        hypotheses: [],
        bestScore: 0,
        bestModelEffort: '',
        explored: 0,
        unexploredAreas: [],
    };
}

/**
 * Add a hypothesis to the exploration tree.
 */
export function addHypothesis(
    tree: ExplorationTree,
    hypothesis: Hypothesis,
): ExplorationTree {
    const hypotheses = [...tree.hypotheses, hypothesis];
    const bestScore = Math.max(tree.bestScore, hypothesis.score);
    const bestModelEffort = hypothesis.score >= bestScore
        ? `${hypothesis.model}/${hypothesis.effort}`
        : tree.bestModelEffort;

    // Compute unique approaches (by description similarity)
    const uniqueApproaches = new Set(hypotheses.map((h) => h.description.toLowerCase().trim()));

    return {
        ...tree,
        hypotheses,
        bestScore,
        bestModelEffort,
        explored: uniqueApproaches.size,
        unexploredAreas: computeUnexploredAreas(hypotheses),
    };
}

/**
 * Generate anti-loop context to inject before the next agent attempt.
 * This tells the agent what was already tried and failed.
 */
export function generateAntiLoopContext(tree: ExplorationTree): string {
    if (tree.hypotheses.length === 0) return '';

    const failedAttempts = tree.hypotheses
        .filter((h) => h.result === 'fail')
        .map((h, i) => `${i + 1}. "${h.description}" (${h.model}/${h.effort}, score: ${h.score}/100)\n   Reason: ${h.reflection}\n   Files touched: ${h.filesModified.join(', ') || 'none'}`)
        .join('\n');

    const successfulAttempts = tree.hypotheses
        .filter((h) => h.result === 'pass')
        .map((h) => `- "${h.description}" (${h.model}/${h.effort}, score: ${h.score}/100)`)
        .join('\n');

    let context = '';

    if (failedAttempts) {
        context += `FAILED APPROACHES (DO NOT RETRY):\n${failedAttempts}\n\n`;
    }

    if (successfulAttempts) {
        context += `SUCCESSFUL APPROACHES:\n${successfulAttempts}\n\n`;
    }

    if (tree.unexploredAreas.length > 0) {
        context += `UNEXPLORED AREAS (consider investigating):\n${tree.unexploredAreas.map((a) => `- ${a}`).join('\n')}\n`;
    }

    return context;
}

/**
 * Detect if a new hypothesis description is too similar to a previous failed attempt.
 * Uses simple string overlap — not embedding-based (zero deps).
 */
export function detectCycle(
    tree: ExplorationTree,
    newDescription: string,
): boolean {
    const newWords = new Set(newDescription.toLowerCase().split(/\s+/));

    for (const h of tree.hypotheses) {
        if (h.result !== 'fail') continue;

        const oldWords = new Set(h.description.toLowerCase().split(/\s+/));
        const intersection = new Set([...newWords].filter((w) => oldWords.has(w)));
        const union = new Set([...newWords, ...oldWords]);

        // Jaccard similarity > 0.6 = too similar to a previous attempt
        const similarity = intersection.size / union.size;
        if (similarity > 0.6) return true;
    }

    return false;
}

/**
 * Suggest the next area to explore based on what hasn't been tried.
 */
export function suggestNext(tree: ExplorationTree): string | null {
    if (tree.unexploredAreas.length > 0) {
        return tree.unexploredAreas[0] ?? null;
    }

    // If all areas explored, suggest increasing effort
    const lastHypothesis = tree.hypotheses[tree.hypotheses.length - 1];
    if (lastHypothesis && lastHypothesis.result === 'fail') {
        return `Try a more capable model. Last attempt: ${lastHypothesis.model}/${lastHypothesis.effort} scored ${lastHypothesis.score}/100`;
    }

    return null;
}

/**
 * Compute a summary of the exploration for display.
 */
export function summarizeTree(tree: ExplorationTree): string {
    const total = tree.hypotheses.length;
    const passed = tree.hypotheses.filter((h) => h.result === 'pass').length;
    const failed = tree.hypotheses.filter((h) => h.result === 'fail').length;
    const totalTokens = tree.hypotheses.reduce((s, h) => s + h.tokens, 0);
    const totalDuration = tree.hypotheses.reduce((s, h) => s + h.duration_ms, 0);

    return [
        `Exploration: ${total} attempts (${passed} pass, ${failed} fail)`,
        `Best: ${tree.bestModelEffort} (${tree.bestScore}/100)`,
        `Tokens: ${totalTokens} | Duration: ${Math.round(totalDuration / 1000)}s`,
        `Unique approaches: ${tree.explored}`,
    ].join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Infer unexplored areas from the files modified so far. */
function computeUnexploredAreas(hypotheses: readonly Hypothesis[]): string[] {
    const allFiles = new Set<string>();
    const exploredDirs = new Set<string>();

    for (const h of hypotheses) {
        for (const f of h.filesModified) {
            allFiles.add(f);
            // Extract directory
            const dir = f.split('/').slice(0, -1).join('/');
            if (dir) exploredDirs.add(dir);
        }
    }

    // Common directories that might be unexplored
    const commonDirs = ['src/api', 'src/db', 'src/cache', 'src/auth', 'src/config',
        'src/middleware', 'src/utils', 'src/services', 'src/models', 'src/core',
        'src/adapters', 'src/lib'];

    return commonDirs.filter((d) => !exploredDirs.has(d) && exploredDirs.size > 0);
}
