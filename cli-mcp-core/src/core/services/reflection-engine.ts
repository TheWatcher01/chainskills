/**
 * Reflection engine — analyzes workflow execution to generate learned rules.
 *
 * Given execution context (state, error, step info), builds a structured
 * prompt for an agent provider, then parses the agent's JSON response
 * into actionable rules.
 *
 * @module core/services/reflection-engine
 */

import type { AgentProvider } from '#core/ports/agent-provider.port.js';

/** Result of a reflection analysis. */
export interface ReflectionResult {
    readonly summary: string;
    readonly rules: readonly ReflectionRule[];
    readonly suggestions: readonly string[];
}

/** A rule proposed by the reflection engine. */
export interface ReflectionRule {
    readonly ruleType: 'soft' | 'hard';
    readonly condition: string;
    readonly action: string;
    readonly confidence: number;
}

/** Options for reflection. */
export interface ReflectionOptions {
    readonly prompt: string;
    readonly variables: Record<string, unknown>;
    readonly stepId?: string;
    readonly error?: string;
    readonly workflowName?: string;
}

/** Reflection engine interface. */
export interface ReflectionEngine {
    reflect(options: ReflectionOptions): Promise<ReflectionResult>;
}

/**
 * Create a reflection engine that uses an agent for analysis.
 *
 * @param agent - The agent provider to invoke for reflection.
 * @returns A `ReflectionEngine` instance.
 */
export function createReflectionEngine(agent: AgentProvider): ReflectionEngine {
    return {
        async reflect(options: ReflectionOptions): Promise<ReflectionResult> {
            const systemPrompt = buildReflectionSystemPrompt();
            const userPrompt = buildReflectionUserPrompt(options);

            const result = await agent.invoke({
                agent: 'reflect',
                prompt: userPrompt,
                systemPrompt,
                variables: options.variables,
            });

            if (!result.ok) {
                return {
                    summary: `Reflection failed: ${result.error.message}`,
                    rules: [],
                    suggestions: [],
                };
            }

            return parseReflectionResponse(result.value.content);
        },
    };
}

function buildReflectionSystemPrompt(): string {
    return `You are a workflow analysis engine. Your job is to analyze workflow execution context and generate actionable rules.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Brief analysis of what happened",
  "rules": [
    {
      "ruleType": "soft" or "hard",
      "condition": "When [condition description]",
      "action": "Then [action to take]",
      "confidence": 0.0 to 1.0
    }
  ],
  "suggestions": ["List of improvement suggestions"]
}

Guidelines:
- "soft" rules are advisory (injected as context into agent prompts)
- "hard" rules are mandatory (checked before execution, block if violated)
- Confidence should reflect how certain you are (0.5 = uncertain, 0.9 = very confident)
- Be specific in conditions and actions
- Focus on patterns that can prevent future failures`;
}

function buildReflectionUserPrompt(options: ReflectionOptions): string {
    const parts: string[] = [];

    parts.push(`Reflection prompt: ${options.prompt}`);

    if (options.workflowName) {
        parts.push(`Workflow: ${options.workflowName}`);
    }

    if (options.stepId) {
        parts.push(`Step: ${options.stepId}`);
    }

    if (options.error) {
        parts.push(`Error: ${options.error}`);
    }

    // Include relevant variables (limit to prevent token overflow)
    const varEntries = Object.entries(options.variables);
    if (varEntries.length > 0) {
        const varSummary = varEntries
            .slice(0, 20)
            .map(([k, v]) => {
                const val = typeof v === 'string' && v.length > 200
                    ? v.slice(0, 200) + '...'
                    : JSON.stringify(v);
                return `  ${k}: ${val}`;
            })
            .join('\n');
        parts.push(`Variables:\n${varSummary}`);
    }

    return parts.join('\n\n');
}

function parseReflectionResponse(content: string): ReflectionResult {
    try {
        // Try to extract JSON from the response (may be wrapped in markdown)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return {
                summary: content.slice(0, 200),
                rules: [],
                suggestions: [content],
            };
        }

        const parsed = JSON.parse(jsonMatch[0]) as {
            summary?: string;
            rules?: Array<{
                ruleType?: string;
                condition?: string;
                action?: string;
                confidence?: number;
            }>;
            suggestions?: string[];
        };

        return {
            summary: String(parsed.summary ?? 'No summary'),
            rules: (parsed.rules ?? [])
                .filter((r) => r.condition && r.action)
                .map((r) => ({
                    ruleType: r.ruleType === 'hard' ? 'hard' as const : 'soft' as const,
                    condition: String(r.condition),
                    action: String(r.action),
                    confidence: Math.min(1, Math.max(0, Number(r.confidence ?? 0.5))),
                })),
            suggestions: (parsed.suggestions ?? []).map(String),
        };
    } catch {
        return {
            summary: content.slice(0, 200),
            rules: [],
            suggestions: [],
        };
    }
}
