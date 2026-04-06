/**
 * Distillation service — extracts fine-tuning pairs from execution traces.
 *
 * Pure function, zero I/O, zero external dependencies.
 * Transforms ExecutionTrace[] into OpenAI-compatible JSONL training examples.
 *
 * @module core/services/distillation
 */

import type { ExecutionTrace } from '#core/entities/execution-trace.js';

/** A single distilled training example in OpenAI fine-tuning format. */
export interface DistilledExample {
    /** Conversation messages for fine-tuning. */
    readonly messages: readonly {
        readonly role: 'system' | 'user' | 'assistant';
        readonly content: string;
    }[];
    /** Metadata for provenance tracking (not sent to fine-tuning). */
    readonly _metadata?: {
        readonly run_id: string;
        readonly workflow_name: string;
        readonly step_id: string;
        readonly model?: string;
        readonly confidence_score?: number;
        readonly tokens?: { readonly prompt: number; readonly completion: number };
    };
}

/** Options for the distillation process. */
export interface DistillOptions {
    /** Minimum confidence score to include (default 0.5). */
    readonly minConfidence?: number;
    /** Only include traces from these directive types (default: agent, handoff). */
    readonly directiveTypes?: readonly string[];
    /** Include metadata in output (default true). */
    readonly includeMetadata?: boolean;
    /** System prompt prefix for the training examples. */
    readonly systemPrompt?: string;
}

/**
 * Distill execution traces into fine-tuning examples.
 *
 * Filters by status=ok, directive_type in [agent, handoff], and confidence >= threshold.
 * Produces OpenAI-compatible JSONL format.
 *
 * @param traces - Raw execution traces to distill.
 * @param options - Distillation options.
 * @returns Array of distilled training examples.
 */
export function distillTraces(
    traces: readonly ExecutionTrace[],
    options?: DistillOptions,
): DistilledExample[] {
    const minConfidence = options?.minConfidence ?? 0.5;
    const directiveTypes = new Set(options?.directiveTypes ?? ['agent', 'handoff']);
    const includeMetadata = options?.includeMetadata ?? true;
    const systemPrompt = options?.systemPrompt ?? 'You are a helpful AI assistant.';

    const examples: DistilledExample[] = [];

    for (const trace of traces) {
        // Filter: only successful LLM interactions with sufficient confidence
        if (trace.status !== 'ok') continue;
        if (!directiveTypes.has(trace.directive_type)) continue;
        if ((trace.confidence_score ?? 0) < minConfidence) continue;
        if (!trace.input || !trace.output) continue;

        const messages: DistilledExample['messages'] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: trace.input },
            { role: 'assistant', content: trace.output },
        ];

        const example: DistilledExample = {
            messages,
            ...(includeMetadata
                ? {
                    _metadata: {
                        run_id: trace.run_id,
                        workflow_name: trace.workflow_name,
                        step_id: trace.step_id,
                        model: trace.model,
                        confidence_score: trace.confidence_score,
                        tokens: trace.tokens
                            ? { prompt: trace.tokens.prompt, completion: trace.tokens.completion }
                            : undefined,
                    },
                }
                : {}),
        };

        examples.push(example);
    }

    return examples;
}

/**
 * Serialize distilled examples to JSONL format (one JSON per line).
 */
export function toJsonl(examples: readonly DistilledExample[]): string {
    return examples.map((e) => JSON.stringify(e)).join('\n') + (examples.length > 0 ? '\n' : '');
}

/**
 * Get summary statistics about distillation results.
 */
export function distillStats(
    traces: readonly ExecutionTrace[],
    examples: readonly DistilledExample[],
): {
    readonly totalTraces: number;
    readonly filteredIn: number;
    readonly filteredOut: number;
    readonly byModel: Record<string, number>;
    readonly avgConfidence: number;
} {
    const byModel: Record<string, number> = {};
    let totalConfidence = 0;

    for (const ex of examples) {
        const model = ex._metadata?.model ?? 'unknown';
        byModel[model] = (byModel[model] ?? 0) + 1;
        totalConfidence += ex._metadata?.confidence_score ?? 0;
    }

    return {
        totalTraces: traces.length,
        filteredIn: examples.length,
        filteredOut: traces.length - examples.length,
        byModel,
        avgConfidence: examples.length > 0 ? totalConfidence / examples.length : 0,
    };
}
