/**
 * Remark workflow plugin — extracts steps and directives from Markdown AST.
 *
 * Custom remark plugin that:
 * 1. Identifies headings as step boundaries
 * 2. Extracts `@` directives from leaf/text/container directive nodes
 * 3. Handles containerDirective for block directives (@parallel, @if, @for, @try, @workflow)
 * 4. Recursively parses children of container directives into nested Steps
 * 5. Collects body text (non-directive paragraphs) as step descriptions
 *
 * Uses `remark-directive` AST node types.
 *
 * @module adapters/parser/remark-workflow-plugin
 */

import type { Root, Heading, PhrasingContent, RootContent } from 'mdast';
import type { Plugin } from 'unified';
import type { Directive, DirectiveType } from '#core/entities/directive.js';
import { isDirectiveType } from '#core/entities/directive.js';
import type { Step } from '#core/entities/step.js';

// ─── AST Node Types ──────────────────────────────────────────────────────────

/** Extended mdast node types from remark-directive. */
interface DirectiveNode {
    type: 'textDirective' | 'leafDirective' | 'containerDirective';
    name: string;
    attributes?: Record<string, string>;
    children?: (PhrasingContent | RootContent)[];
}

/** Block-level content in containerDirective children. */
interface BlockContent {
    type: string;
    children?: (PhrasingContent | RootContent)[];
    name?: string;
    attributes?: Record<string, string>;
    value?: string;
    depth?: number;
}

/** Data attached to the vfile by this plugin. */
export interface WorkflowPluginData {
    steps: Step[];
}

// ─── Block Directive Types ───────────────────────────────────────────────────

/** Directive types that can be container (block) directives. */
const BLOCK_DIRECTIVE_TYPES = new Set<string>([
    'parallel',
    'if',
    'for',
    'repeat',
    'try',
    'workflow',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
function extractText(nodes: (PhrasingContent | RootContent)[]): string {
    return nodes
        .map((node) => {
            if (node.type === 'text') return (node as { value: string }).value;
            // remark-directive may parse inline :name as textDirective — reconstruct original text
            if (node.type === 'textDirective') {
                const dNode = node as unknown as DirectiveNode;
                const childText = dNode.children
                    ? extractText(dNode.children as PhrasingContent[])
                    : '';
                return `:${dNode.name}${childText}`;
            }
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
            // @for $item in $list:  or  @for $item in $list concurrency:3:
            const forMatch = raw.match(/^@for\s+(\$\w+)\s+in\s+(\$\w+)/);
            if (forMatch) {
                args['variable'] = forMatch[1];
                args['iterable'] = forMatch[2];
            }
            // Extract concurrency from attributes or raw text
            const concurrencyAttr = attributes['concurrency'];
            if (concurrencyAttr) {
                args['concurrency'] = Number(concurrencyAttr);
            } else {
                const concurrencyMatch = raw.match(/concurrency:(\d+)/);
                if (concurrencyMatch) {
                    args['concurrency'] = Number(concurrencyMatch[1]);
                }
            }
            break;
        }
        case 'repeat': {
            // @repeat max:5 until $valid == true:
            // @repeat max:3 while $continue == true:
            const maxMatch = raw.match(/max:(\d+)/);
            const untilMatch = raw.match(/until\s+(.+?)(?::|$)/);
            const whileMatch = raw.match(/while\s+(.+?)(?::|$)/);
            if (maxMatch) args['max'] = Number(maxMatch[1]);
            if (untilMatch) args['until'] = untilMatch[1]!.trim();
            if (whileMatch) args['while'] = whileMatch[1]!.trim();
            // Also support max from attributes
            const maxAttr = attributes['max'];
            if (maxAttr && !args['max']) {
                args['max'] = Number(maxAttr);
            }
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
        case 'workflow': {
            // @workflow sub-name: or :::workflow[sub-name]
            const workflowMatch = raw.match(/^@workflow\s+([\w-]+)/);
            if (workflowMatch) {
                args['ref'] = workflowMatch[1];
            }
            break;
        }
        default:
            // parallel, try, on-error, else — no special parsing needed
            break;
    }

    return args;
}

// ─── Container Directive Processing ──────────────────────────────────────────

/**
 * Parse block-level children of a containerDirective into Steps.
 *
 * Container directives in remark-directive have block-level children:
 * ```markdown
 * :::parallel
 * @call shell.exec(echo a) → $a
 *
 * @call shell.exec(echo b) → $b
 * :::
 * ```
 *
 * For :::parallel and :::if, children may be separated by subordinate
 * containers (:::else, :::on-error) which split the content.
 */
function parseContainerChildren(
    children: (PhrasingContent | RootContent)[],
    parentType: DirectiveType,
    parentId: string,
): { mainChildren: Step[]; elseChildren?: Step[]; errorChildren?: Step[] } {
    const mainNodes: BlockContent[] = [];
    const elseNodes: BlockContent[] = [];
    const errorNodes: BlockContent[] = [];

    let currentTarget = mainNodes;

    for (const child of children) {
        const block = child as BlockContent;

        // Check for subordinate container directives (:::else, :::on-error)
        if (block.type === 'containerDirective' && block.name) {
            if (block.name === 'else' && parentType === 'if') {
                currentTarget = elseNodes;
                // Include the else container's own children
                if (block.children) {
                    for (const elseChild of block.children) {
                        currentTarget.push(elseChild as BlockContent);
                    }
                }
                continue;
            }
            if ((block.name === 'on-error') && parentType === 'try') {
                currentTarget = errorNodes;
                if (block.children) {
                    for (const errChild of block.children) {
                        currentTarget.push(errChild as BlockContent);
                    }
                }
                continue;
            }
        }

        currentTarget.push(block);
    }

    const mainChildren = blockNodesToSteps(mainNodes, parentId);
    const elseChildren = elseNodes.length > 0
        ? blockNodesToSteps(elseNodes, `${parentId}-else`)
        : undefined;
    const errorChildren = errorNodes.length > 0
        ? blockNodesToSteps(errorNodes, `${parentId}-on-error`)
        : undefined;

    return { mainChildren, elseChildren, errorChildren };
}

/**
 * Convert block-level AST nodes into Steps.
 *
 * Groups content between nested container directives into synthetic steps.
 * Leaf/text directives within paragraphs become directives of the step.
 */
function blockNodesToSteps(
    nodes: BlockContent[],
    parentId: string,
): Step[] {
    const steps: Step[] = [];
    let stepCounter = 0;
    let currentDirectives: Directive[] = [];
    let currentDescParts: string[] = [];

    function flushCurrentStep(): void {
        if (currentDirectives.length > 0 || currentDescParts.length > 0) {
            stepCounter++;
            steps.push({
                id: `${parentId}-child-${stepCounter}`,
                title: `${parentId} child ${stepCounter}`,
                description: currentDescParts.join('\n').trim(),
                directives: currentDirectives,
            });
            currentDirectives = [];
            currentDescParts = [];
        }
    }

    for (const node of nodes) {
        // Heading inside a container = named child step
        if (node.type === 'heading') {
            flushCurrentStep();
            const text = extractText((node as unknown as Heading).children);
            // Start a new named step — will be flushed on next heading or end
            stepCounter++;
            // Reset for this heading's content
            currentDirectives = [];
            currentDescParts = [];
            // Create a stub — content will be added below
            steps.push({
                id: slugify(text) || `${parentId}-${stepCounter}`,
                title: text,
                description: '',
                directives: [],
            });
            continue;
        }

        // Nested containerDirective → recursive parsing
        if (node.type === 'containerDirective' && node.name) {
            const name = node.name;
            if (isDirectiveType(name) && BLOCK_DIRECTIVE_TYPES.has(name)) {
                flushCurrentStep();
                stepCounter++;

                const nestedId = `${parentId}-${name}-${stepCounter}`;
                const childText = node.children
                    ? extractText(node.children as PhrasingContent[])
                    : '';
                const raw = `@${name} ${childText}`.trim();
                const args = parseDirectiveArgs(
                    name,
                    raw,
                    (node.attributes as Record<string, string>) ?? {},
                );

                // Recursively parse children of this nested container
                const nested = parseContainerChildren(
                    (node.children ?? []) as (PhrasingContent | RootContent)[],
                    name,
                    nestedId,
                );

                const directive: Directive = {
                    type: name,
                    raw,
                    args,
                    children: nested.mainChildren,
                };

                // For @if with :::else, store else branch in args
                if (nested.elseChildren && nested.elseChildren.length > 0) {
                    (args as Record<string, unknown>)['_elseChildren'] = nested.elseChildren;
                }
                // For @try with :::on-error, store error branch in args
                if (nested.errorChildren && nested.errorChildren.length > 0) {
                    (args as Record<string, unknown>)['_errorChildren'] = nested.errorChildren;
                }

                steps.push({
                    id: nestedId,
                    title: `@${name} block`,
                    description: '',
                    directives: [directive],
                    children: nested.mainChildren,
                });
                continue;
            }
        }

        // Leaf / text directive node
        if (
            node.type === 'textDirective' ||
            node.type === 'leafDirective'
        ) {
            const dNode = node as unknown as DirectiveNode;
            if (isDirectiveType(dNode.name)) {
                const childText = dNode.children
                    ? extractText(dNode.children as PhrasingContent[])
                    : '';
                const raw = `@${dNode.name} ${childText}`.trim();
                currentDirectives.push({
                    type: dNode.name as DirectiveType,
                    raw,
                    args: parseDirectiveArgs(
                        dNode.name as DirectiveType,
                        raw,
                        dNode.attributes ?? {},
                    ),
                });
                continue;
            }
        }

        // Paragraph — check for inline @directive or plain text
        if (node.type === 'paragraph' && node.children) {
            const text = extractText(node.children as PhrasingContent[]);

            const directiveMatch = text.match(/^@(\S+)\s*(.*)/);
            if (directiveMatch) {
                const name = directiveMatch[1]!.replace(/:$/, '');
                const normalizedName = name.replace(/^on-error$/, 'on-error');
                if (isDirectiveType(normalizedName)) {
                    const raw = text.trim();
                    currentDirectives.push({
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

            currentDescParts.push(text);
        }
    }

    flushCurrentStep();
    return steps;
}

// ─── Main Plugin ─────────────────────────────────────────────────────────────

/**
 * Remark plugin that extracts workflow steps and directives from the AST.
 *
 * Handles both flat directives (leaf/text) and block container directives.
 * Container directives (:::parallel, :::if, :::for, :::try, :::workflow)
 * are recursively parsed into nested Step structures with children.
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
            children?: Step[];
        } | null = null;

        // Helper to finalize current step
        function finalizeStep(): void {
            if (currentStep) {
                steps.push({
                    id: currentStep.id,
                    title: currentStep.title,
                    description: currentStep.descParts.join('\n').trim(),
                    directives: currentStep.directives,
                    children: currentStep.children,
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

            // Container directive → block with children
            if (node.type === 'containerDirective') {
                const dNode = node as unknown as DirectiveNode;
                const name = dNode.name;

                if (isDirectiveType(name) && BLOCK_DIRECTIVE_TYPES.has(name)) {
                    const childText = dNode.children
                        ? extractText(dNode.children as PhrasingContent[])
                        : '';
                    const raw = `@${name} ${childText}`.trim();
                    const args = parseDirectiveArgs(
                        name,
                        raw,
                        dNode.attributes ?? {},
                    );

                    const blockId = `${currentStep.id}-${name}`;
                    const { mainChildren, elseChildren, errorChildren } =
                        parseContainerChildren(
                            (dNode.children ?? []) as (PhrasingContent | RootContent)[],
                            name,
                            blockId,
                        );

                    // Store else/error branches in args for the executor
                    if (elseChildren && elseChildren.length > 0) {
                        (args as Record<string, unknown>)['_elseChildren'] = elseChildren;
                    }
                    if (errorChildren && errorChildren.length > 0) {
                        (args as Record<string, unknown>)['_errorChildren'] = errorChildren;
                    }

                    const directive: Directive = {
                        type: name,
                        raw,
                        args,
                        children: mainChildren,
                    };

                    currentStep.directives.push(directive);

                    // Also set step.children for backward compatibility
                    if (!currentStep.children) {
                        currentStep.children = [];
                    }
                    currentStep.children = [
                        ...currentStep.children,
                        ...mainChildren,
                    ];
                    continue;
                }

                // Unknown container directive — treat as leaf
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
                    continue;
                }
            }

            // Leaf / text directive (inline, no children)
            if (
                node.type === 'textDirective' ||
                node.type === 'leafDirective'
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
                    const name = directiveMatch[1]!.replace(/:$/, '');
                    // Handle on-error which contains a hyphen
                    const normalizedName = name.replace(/^on-error$/, 'on-error');
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
