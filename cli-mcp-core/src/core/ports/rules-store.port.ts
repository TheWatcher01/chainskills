/**
 * Rules store port — persists learned rules from workflow reflections.
 *
 * Rules capture patterns like "when X happens, do Y" derived from
 * workflow execution outcomes. They can be soft (advisory context
 * injected into agent prompts) or hard (admissibility checks).
 *
 * @module core/ports/rules-store
 */

/** A learned rule from workflow execution. */
export interface LearnedRule {
    readonly id: number;
    readonly workflowName?: string;
    readonly ruleType: 'soft' | 'hard';
    readonly condition: string;
    readonly action: string;
    readonly source?: string;
    readonly confidence: number;
    readonly hitCount: number;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/** Rules store port — CRUD for learned rules. */
export interface RulesStore {
    /** Add a new learned rule. Returns the rule ID. */
    addRule(rule: {
        workflowName?: string;
        ruleType: 'soft' | 'hard';
        condition: string;
        action: string;
        source?: string;
        confidence?: number;
    }): number;

    /** Get all rules applicable to a workflow (including global rules). */
    getRulesForWorkflow(workflowName: string): readonly LearnedRule[];

    /** Get global rules (no workflow restriction). */
    getGlobalRules(): readonly LearnedRule[];

    /** Record a rule hit (increment hit count, update timestamp). */
    recordHit(ruleId: number): void;

    /** List all rules, optionally filtered. */
    listAll(filters?: {
        workflowName?: string;
        ruleType?: 'soft' | 'hard';
    }): readonly LearnedRule[];

    /** Delete a rule by ID. */
    deleteRule(ruleId: number): void;
}
