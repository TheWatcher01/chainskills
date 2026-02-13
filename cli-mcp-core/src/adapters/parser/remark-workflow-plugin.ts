/**
 * Remark workflow plugin — extracts steps and directives from Markdown AST.
 *
 * Custom remark plugin that:
 * 1. Identifies headings as step boundaries
 * 2. Extracts `@` directives from leaf/text/container directive nodes
 * 3. Collects body text (non-directive paragraphs) as step descriptions
 *
 * Uses `remark-directive` AST node types.
 *
 * @module adapters/parser/remark-workflow-plugin
 */

import type { Root, Heading, PhrasingContent } from 'mdast';
import type { Plugin } from 'unified';
import type { Directive, DirectiveType } from '#core/entities/directive.js';
import { isDirectiveType } from '#core/entities/directive.js';
import type { Step } from '#core/entities/step.js';

/** Extended mdast node types from remark-directive. */
interface DirectiveNode {
    type: 'textDirective' | 'leafDirective' | 'containerDirective';
    name: string;
    attributes?: Record<string, string>;
    children?: PhrasingContent[];
}

/** Data attached to the vfile by this plugin. */
export interface WorkflowPluginData {
    steps: Step[];
}

/**
 * Slugify a heading text into a kebab-case step ID.
 */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Extract plain text from mdast phrasing content nodes.
 */
function extractText(nodes: PhrasingContent[]): string {
    return nodes
        .map((node) => {
            if (node.type === 'text') return node.value;
            if ('children' in node && Array.isArray(node.children)) {
                return extractText(node.children as PhrasingContent[]);
            }
            return '';
        })
        .join('');
}

/**
 * Parse a raw directive line into structured args.
 */
function parseDirectiveArgs(
    type: DirectiveType,
    raw: string,
    attributes: Record<string, string>,
): Record<string, unknown> {
    const args: Record<string, unknown> = { ...attributes };

    switch (type) {
        case 'use': {
            const ref = raw.replace(/^@use\s+/, '').trim();
            args['ref'] = ref;
            break;
        }
        case 'call': {
            // @call tool.method($input) → $output
            const callMatch = raw.match(
                /^@call\s+(\w+)\.(\w+)\(([^)]*)\)(?:\s*(?:→|->|>)\s*\$(\w+))?/,
            );
            if (callMatch) {
                args['tool'] = callMatch[1];
                args['method'] = callMatch[2];
                args['input'] = callMatch[3];
                if (callMatch[4]) args['capture'] = callMatch[4];
            }
            break;
        }
        case 'if': {
            const condition = raw.replace(/^@if\s+/, '').replace(/:$/, '').trim();
            args['condition'] = condition;
            break;
        }
        case 'for': {
            // @for $item in $list:
            const forMatch = raw.match(/^@for\s+(\$\w+)\s+in\s+(\$\w+)/);
            if (forMatch) {
                args['variable'] = forMatch[1];
                args['iterable'] = forMatch[2];
            }
            break;
        }
        case 'repeat': {
            // @repeat max:5 until $valid == true:
            const maxMatch = raw.match(/max:(\d+)/);
            const untilMatch = raw.match(/until\s+(.+?):/);
            if (maxMatch) args['max'] = Number(maxMatch[1]);
            if (untilMatch) args['until'] = untilMatch[1]!.trim();
            break;
        }
        case 'assert': {
            const assertion = raw.replace(/^@assert\s+/, '').trim();
            args['expression'] = assertion;
            break;
        }
        case 'output': {
            const outputs = raw
                .replace(/^@output:\s*/, '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            args['variables'] = outputs;
            break;
        }
        case 'env': {
            const envName = raw.replace(/^@env\s+/, '').trim();
            args['name'] = envName;
            break;
        }
        case 'agent': {
            // @agent copilot: "message"
            const agentMatch = raw.match(/^@agent\s+(\w+):\s*"([^"]*)"/);
            if (agentMatch) {
                args['agent'] = agentMatch[1];
                args['message'] = agentMatch[2];
            }
            break;
        }
        case 'handoff': {
            // @handoff agent-name: "message"
            const handoffMatch = raw.match(/^@handoff\s+([\w-]+):\s*"([^"]*)"/);
            if (handoffMatch) {
                args['target'] = handoffMatch[1];
                args['message'] = handoffMatch[2];
            }
            break;
        }
        default:
            // parallel, try, on-error, else, workflow — no special parsing needed
            break;
    }

    return args;
}

/**
 * Remark plugin that extracts workflow steps and directives from the AST.
 *
 * Attaches a `WorkflowPluginData` to `vfile.data.workflow`.
 */
export const remarkWorkflowPlugin: Plugin<[], Root> = function () {
    return (tree, file) => {
        const steps: Step[] = [];
        let currentStep: {
            id: string;
            title: string;
            descParts: string[];
            directives: Directive[];
        } | null = null;

        // Helper to finalize current step
        function finalizeStep(): void {
            if (currentStep) {
                steps.push({
                    id: currentStep.id,
                    title: currentStep.title,
                    description: currentStep.descParts.join('\n').trim(),
                    directives: currentStep.directives,
                });
            }
        }

        // Walk the AST at the top level
        for (const node of tree.children) {
            // Heading = new step boundary
            if (node.type === 'heading') {
                finalizeStep();
                const heading = node as Heading;
                const text = extractText(heading.children);
                currentStep = {
                    id: slugify(text),
                    title: text,
                    descParts: [],
                    directives: [],
                };
                continue;
            }

            // Before any heading — skip (frontmatter area handled separately)
            if (!currentStep) continue;

            // Check for directive nodes (from remark-directive)
            if (
                node.type === 'textDirective' ||
                node.type === 'leafDirective' ||
                node.type === 'containerDirective'
            ) {
                const dNode = node as unknown as DirectiveNode;
                const name = dNode.name;
                if (isDirectiveType(name)) {
                    const childText = dNode.children
                        ? extractText(dNode.children as PhrasingContent[])
                        : '';
                    const raw = `@${name} ${childText}`.trim();
                    currentStep.directives.push({
                        type: name,
                        raw,
                        args: parseDirectiveArgs(
                            name,
                            raw,
                            dNode.attributes ?? {},
                        ),
                    });
                }
                continue;
            }

            // Paragraph — check for inline @directive pattern (fallback)
            if (node.type === 'paragraph' && 'children' in node) {
                const text = extractText(
                    (node as { children: PhrasingContent[] }).children,
                );

                // Check if paragraph starts with @directive
                const directiveMatch = text.match(/^@(\S+)\s*(.*)/);
                if (directiveMatch) {
                    const name = directiveMatch[1]!;
                    // Handle on-error which contains a hyphen
                    const normalizedName = name.replace('on-error', 'on-error');
                    if (isDirectiveType(normalizedName)) {
                        const raw = text.trim();
                        currentStep.directives.push({
                            type: normalizedName as DirectiveType,
                            raw,
                            args: parseDirectiveArgs(
                                normalizedName as DirectiveType,
                                raw,
                                {},
                            ),
                        });
                        continue;
                    }
                }

                // Regular paragraph — add to description
                currentStep.descParts.push(text);
            }
        }

        // Finalize last step
        finalizeStep();

        // Attach to vfile data
        (file.data as Record<string, unknown>)['workflow'] = {
            steps,
        } satisfies WorkflowPluginData;
    };
};
