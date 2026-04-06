/**
 * Workflow generation service — creates workflow variants from templates.
 *
 * Uses an LLM to generate variations of a base workflow with different
 * constraints (speed, reliability, validation, etc.).
 *
 * Pure prompt construction — no I/O, no external dependencies.
 *
 * @module core/services/workflow-generation
 */

import type { GenerationConstraint } from '#core/entities/generation-config.js';

/**
 * Build a prompt for generating a workflow variant.
 *
 * @param templateSource - The base .workflow.md source.
 * @param constraint - The constraint to apply.
 * @param workflowName - Name of the base workflow.
 * @returns A prompt string for the LLM.
 */
export function buildGenerationPrompt(
    templateSource: string,
    constraint: GenerationConstraint,
    workflowName: string,
): string {
    return `You are a chainskills workflow expert. Generate a variant of the following workflow.

## Constraint: ${constraint.name}
${constraint.description}

## Base Workflow
\`\`\`markdown
${templateSource}
\`\`\`

## Instructions
1. Generate a COMPLETE .workflow.md file (including frontmatter)
2. Apply the "${constraint.name}" constraint: ${constraint.description}
3. Keep the same inputs/outputs as the base workflow
4. Change the workflow name to: ${workflowName}-${constraint.name}
5. Use valid chainskills directives: @call, @if, @for, @repeat, @parallel, @try, @on-error, @assert, @agent, @schema, @gate, @output, @env
6. Output ONLY the .workflow.md content, no explanations

## Chainskills Directive Reference
- @call tool.method(args) → $var — invoke shell/MCP tool
- @agent name: "prompt" → $var — delegate to LLM
- @if $condition: — conditional branch
- @for $item in $list: — iterate
- @parallel: — concurrent execution block
- @try: / @on-error: — error handling
- @assert $expr — validation checkpoint
- @schema $var { json_schema } — validate LLM output
- @gate $confidence > 0.8 else: — confidence gate
- @output: $var — declare output`;
}

/**
 * Extract the generated workflow source from LLM output.
 *
 * Handles cases where the LLM wraps output in markdown code blocks.
 */
export function extractWorkflowSource(llmOutput: string): string {
    // Try to extract from markdown code block
    const codeBlockMatch = llmOutput.match(/```(?:markdown|md)?\s*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1]!.trim();
    }

    // If output starts with --- (frontmatter), use as-is
    if (llmOutput.trim().startsWith('---')) {
        return llmOutput.trim();
    }

    // Fallback: return as-is
    return llmOutput.trim();
}
