/**
 * Trace-informed agent — decorator that injects few-shot examples from past traces.
 *
 * Wraps an existing AgentProvider and augments prompts with high-confidence
 * examples from the TraceStore. Enables the flywheel feedback loop:
 * execute → trace → distill → improve prompts → better outputs.
 *
 * Disabled by default. Enable via AGENT_FEEDBACK_ENABLED=true.
 *
 * @module adapters/agents/trace-informed-agent
 */

import type { Result } from '#infra/errors.js';
import type {
    AgentProvider,
    AgentInvokeOptions,
    AgentResult,
    AgentError,
} from '#core/ports/agent-provider.port.js';
import type { TraceStore } from '#core/ports/trace-store.port.js';
import type { Logger } from '#infra/logger.js';

export interface TraceInformedConfig {
    /** Enable feedback injection (default false). */
    readonly enabled: boolean;
    /** Minimum confidence for example traces (default 0.8). */
    readonly minConfidence: number;
    /** Maximum examples to inject (default 2). */
    readonly maxExamples: number;
}

const DEFAULT_CONFIG: TraceInformedConfig = {
    enabled: false,
    minConfidence: 0.8,
    maxExamples: 2,
};

/**
 * Wrap an AgentProvider with trace-informed few-shot injection.
 *
 * Before each invoke(), queries the TraceStore for high-confidence
 * traces with the same directive_type and injects them as examples
 * in the system prompt.
 */
export function createTraceInformedAgent(
    delegate: AgentProvider,
    traceStore: TraceStore,
    config?: Partial<TraceInformedConfig>,
    logger?: Logger,
): AgentProvider {
    const cfg: TraceInformedConfig = { ...DEFAULT_CONFIG, ...config };

    return {
        async invoke(
            options: AgentInvokeOptions,
        ): Promise<Result<AgentResult, AgentError>> {
            if (!cfg.enabled) {
                return delegate.invoke(options);
            }

            // Query for similar high-confidence traces
            let augmentedOptions = options;
            try {
                const traces = await traceStore.query({
                    directive_type: 'agent',
                    status: 'ok',
                    min_confidence: cfg.minConfidence,
                    limit: cfg.maxExamples * 3, // Fetch more, pick best
                });

                if (traces.length > 0) {
                    // Pick top N by confidence
                    const sorted = [...traces]
                        .sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0))
                        .slice(0, cfg.maxExamples);

                    // Build few-shot examples
                    const examples = sorted
                        .map((t, i) => `Example ${i + 1}:\nInput: ${t.input}\nOutput: ${t.output}`)
                        .join('\n\n');

                    const fewShotPrefix = `Here are examples of good outputs for similar tasks:\n\n${examples}\n\nNow handle the current task:`;

                    augmentedOptions = {
                        ...options,
                        systemPrompt: options.systemPrompt
                            ? `${options.systemPrompt}\n\n${fewShotPrefix}`
                            : fewShotPrefix,
                    };

                    logger?.debug(`TraceInformedAgent: injected ${sorted.length} few-shot examples`);
                }
            } catch {
                // Graceful fallback — don't fail if trace query fails
                logger?.debug('TraceInformedAgent: trace query failed, proceeding without examples');
            }

            return delegate.invoke(augmentedOptions);
        },

        has(agent: string): boolean {
            return delegate.has(agent);
        },

        list(): string[] {
            return delegate.list();
        },
    };
}
