/**
 * Rules applicator — applies learned rules to workflow execution.
 *
 * Provides two modes:
 * - Soft rules: formatted as context and injected into agent prompts
 * - Hard rules: checked as admissibility gates before execution
 *
 * @module core/services/rules-applicator
 */

import type { LearnedRule, RulesStore } from '#core/ports/rules-store.port.js';

/** Result of an admissibility check. */
export interface AdmissibilityResult {
    readonly allowed: boolean;
    readonly violations: readonly LearnedRule[];
}

/**
 * Get all applicable rules for a workflow (workflow-specific + global).
 */
export function getApplicableRules(
    rulesStore: RulesStore,
    workflowName: string,
): readonly LearnedRule[] {
    return rulesStore.getRulesForWorkflow(workflowName);
}

/**
 * Format soft rules as context text for injection into agent prompts.
 *
 * @param rules - Rules to format.
 * @returns Formatted context string, or empty string if no soft rules.
 */
export function formatRulesAsContext(rules: readonly LearnedRule[]): string {
    const softRules = rules.filter((r) => r.ruleType === 'soft');

    if (softRules.length === 0) return '';

    const ruleLines = softRules.map((r, i) => {
        const conf = `[confidence: ${(r.confidence * 100).toFixed(0)}%]`;
        return `${i + 1}. ${r.condition} → ${r.action} ${conf}`;
    });

    return `\n--- Learned Rules ---\nThe following rules were learned from previous executions. Consider them when generating your response:\n${ruleLines.join('\n')}\n--- End Rules ---\n`;
}

/**
 * Check hard rules for admissibility.
 *
 * Hard rules are evaluated against the current state variables.
 * A simple pattern matching approach is used: the rule's condition
 * is checked against the stringified state for keyword matches.
 *
 * @param rules - All applicable rules.
 * @param variables - Current state variables.
 * @returns Admissibility result with any violations.
 */
export function checkAdmissibility(
    rules: readonly LearnedRule[],
    variables: Record<string, unknown>,
): AdmissibilityResult {
    const hardRules = rules.filter((r) => r.ruleType === 'hard');

    if (hardRules.length === 0) {
        return { allowed: true, violations: [] };
    }

    const stateStr = JSON.stringify(variables).toLowerCase();
    const violations: LearnedRule[] = [];

    for (const rule of hardRules) {
        // Extract keywords from the condition for matching
        const keywords = rule.condition
            .toLowerCase()
            .replace(/^when\s+/i, '')
            .split(/\s+/)
            .filter((w) => w.length > 3); // Skip short words

        // Check if enough keywords match the state
        const matchCount = keywords.filter((kw) => stateStr.includes(kw)).length;
        const matchRatio = keywords.length > 0 ? matchCount / keywords.length : 0;

        if (matchRatio >= 0.5) {
            violations.push(rule);
        }
    }

    return {
        allowed: violations.length === 0,
        violations,
    };
}
