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
    'team',
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
            const assertionRaw = raw.replace(/^@assert\s+/, '').trim();

            // Support optional trailing message:
            // @assert $x > 0 "message"
            // while preserving quoted literals inside expression:
            // @assert $status == "not ready"
            let assertion = assertionRaw;
            const trailingMessageMatch = assertionRaw.match(/^(.*)\s+"[^"]*"$/);
            if (trailingMessageMatch) {
                const candidate = trailingMessageMatch[1]!.trim();
                const endsWithOperator = /(?:==|!=|>=|<=|>|<)\s*$/.test(candidate);
                if (candidate.length > 0 && !endsWithOperator) {
                    assertion = candidate;
                }
            }

            args['expression'] = assertion;
            break;
        }
        case 'breakpoint': {
            const condition = raw.replace(/^@breakpoint(?:\s+|$)/, '').trim();
            args['condition'] = condition || 'true'; // Default to unconditional breakpoint
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
            // @agent copilot: "message" → $capture
            const agentMatch = raw.match(/^@agent\s+(\w+):\s*"([^"]*)"(?:\s*(?:→|->|>)\s*\$(\w+))?/);
            if (agentMatch) {
                args['agent'] = agentMatch[1];
                args['message'] = agentMatch[2];
                if (agentMatch[3]) args['capture'] = agentMatch[3];
            }
            break;
        }
        case 'handoff': {
            // @handoff agent-name: "message" → $capture
            const handoffMatch = raw.match(/^@handoff\s+([\w-]+):\s*"([^"]*)"(?:\s*(?:→|->|>)\s*\$(\w+))?/);
            if (handoffMatch) {
                args['target'] = handoffMatch[1];
                args['message'] = handoffMatch[2];
                if (handoffMatch[3]) args['capture'] = handoffMatch[3];
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
        case 'validate': {
            // @validate $var against schema:Name
            const validateMatch = raw.match(
                /^@validate\s+(\$\w+)\s+against\s+schema:(\w+)/,
            );
            if (validateMatch) {
                args['variable'] = validateMatch[1];
                args['schema'] = validateMatch[2];
            }
            break;
        }
        case 'snapshot': {
            // @snapshot "label"
            const snapMatch = raw.match(/^@snapshot\s+"([^"]+)"/);
            if (snapMatch) {
                args['label'] = snapMatch[1];
            }
            break;
        }
        case 'restore': {
            // @restore "label"
            const restoreMatch = raw.match(/^@restore\s+"([^"]+)"/);
            if (restoreMatch) {
                args['label'] = restoreMatch[1];
            }
            break;
        }
        case 'reflect': {
            // @reflect: "prompt" → $var
            const reflectMatch = raw.match(
                /^@reflect:\s*"([^"]*)"(?:\s*(?:→|->|>)\s*\$(\w+))?/,
            );
            if (reflectMatch) {
                args['prompt'] = reflectMatch[1];
                if (reflectMatch[2]) args['capture'] = reflectMatch[2];
            }
            break;
        }
        case 'team': {
            // @team name concurrency:N:
            const teamMatch = raw.match(/^@team\s+([\w-]+)/);
            if (teamMatch) {
                args['name'] = teamMatch[1];
            }
            const teamConcurrency = raw.match(/concurrency:(\d+)/);
            if (teamConcurrency) {
                args['concurrency'] = Number(teamConcurrency[1]);
            }
            break;
        }
        case 'vote': {
            // @vote count:N: "prompt" → $var
            const countMatch = raw.match(/count:(\d+)/);
            if (countMatch) {
                args['count'] = Number(countMatch[1]);
            }
            const votePromptMatch = raw.match(/"([^"]*)"(?:\s*(?:→|->|>)\s*\$(\w+))?/);
            if (votePromptMatch) {
                args['prompt'] = votePromptMatch[1];
                if (votePromptMatch[2]) args['capture'] = votePromptMatch[2];
            }
            break;
        }
        default:
            // parallel, try, on-error, else — no special parsing needed
            break;
    }

    return args;
}

/**
 * Parse a single raw `@directive ...` string into a Directive entity.
 */
function parseDirectiveRaw(
    raw: string,
    attributes: Record<string, string>,
): Directive | null {
    const trimmed = raw.trim();
    const directiveMatch = trimmed.match(/^@(\S+)\s*(.*)/);
    if (!directiveMatch) return null;

    const name = directiveMatch[1]!.replace(/:$/, '');
    const normalizedName = name.replace(/^on-error$/, 'on-error');
    if (!isDirectiveType(normalizedName)) return null;

    return {
        type: normalizedName as DirectiveType,
        raw: trimmed,
        args: parseDirectiveArgs(
            normalizedName as DirectiveType,
            trimmed,
            attributes,
        ),
    };
}

/**
 * Parse directives from a paragraph fallback text.
 *
 * Supports both:
 * - single directive paragraphs (possibly multiline payload)
 * - consecutive directive lines without blank separators
 */
function parseDirectivesFromParagraph(text: string): Directive[] {
    const trimmed = text.trim();
    if (trimmed.length === 0 || !trimmed.startsWith('@')) {
        return [];
    }

    const lines = trimmed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length > 1 && lines.every((line) => line.startsWith('@'))) {
        const directives = lines
            .map((line) => parseDirectiveRaw(line, {}))
            .filter((directive): directive is Directive => directive !== null);

        if (directives.length > 0) {
            return directives;
        }
    }

    const single = parseDirectiveRaw(trimmed, {});
    return single ? [single] : [];
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

            const directives = parseDirectivesFromParagraph(text);
            if (directives.length > 0) {
                currentDirectives.push(...directives);
                continue;
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

        /** Depth of the first heading encountered — defines "top-level" steps. */
        let primaryDepth: number | null = null;

        /** Current top-level step being built. */
        let currentStep: {
            id: string;
            title: string;
            descParts: string[];
            directives: Directive[];
            children?: Step[];
        } | null = null;

        /** Current sub-step (child of currentStep) being built. */
        let currentChild: {
            id: string;
            title: string;
            descParts: string[];
            directives: Directive[];
        } | null = null;

        // Helper to finalize current child into parent's children
        function finalizeChild(): void {
            if (currentChild && currentStep) {
                if (!currentStep.children) {
                    currentStep.children = [];
                }
                currentStep.children.push({
                    id: currentChild.id,
                    title: currentChild.title,
                    description: currentChild.descParts.join('\n').trim(),
                    directives: currentChild.directives,
                });
                currentChild = null;
            }
        }

        // Helper to finalize current step
        function finalizeStep(): void {
            finalizeChild();
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

        /** Get the active target (child step if building a child, otherwise parent step). */
        function activeTarget() {
            return currentChild ?? currentStep;
        }

        // Walk the AST at the top level
        for (const node of tree.children) {
            // Heading = step boundary with depth-aware nesting
            if (node.type === 'heading') {
                const heading = node as Heading;
                const text = extractText(heading.children);
                const depth = heading.depth;

                // Set primary depth from first heading
                if (primaryDepth === null) {
                    primaryDepth = depth;
                }

                if (depth <= primaryDepth) {
                    // Same or shallower depth → new top-level step
                    finalizeStep();
                    currentStep = {
                        id: slugify(text),
                        title: text,
                        descParts: [],
                        directives: [],
                    };
                    currentChild = null;
                } else {
                    // Deeper heading → child of current top-level step
                    finalizeChild();
                    if (currentStep) {
                        currentChild = {
                            id: slugify(text),
                            title: text,
                            descParts: [],
                            directives: [],
                        };
                    }
                }
                continue;
            }

            // Before any heading — skip (frontmatter area handled separately)
            if (!currentStep) continue;

            // Get the active target for directive/content collection
            const target = activeTarget();
            if (!target) continue;

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

                    const parentId = currentChild?.id ?? currentStep.id;
                    const blockId = `${parentId}-${name}`;
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

                    target.directives.push(directive);

                    // Also set step.children for backward compatibility
                    // (only on the parent step level, not on child sub-steps)
                    if (!currentChild) {
                        if (!currentStep.children) {
                            currentStep.children = [];
                        }
                        currentStep.children = [
                            ...currentStep.children,
                            ...mainChildren,
                        ];
                    }
                    continue;
                }

                // Unknown container directive — treat as leaf
                if (isDirectiveType(name)) {
                    const childText = dNode.children
                        ? extractText(dNode.children as PhrasingContent[])
                        : '';
                    const raw = `@${name} ${childText}`.trim();
                    target.directives.push({
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
                    target.directives.push({
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

                const directives = parseDirectivesFromParagraph(text);
                if (directives.length > 0) {
                    target.directives.push(...directives);
                    continue;
                }

                // Regular paragraph — add to description
                target.descParts.push(text);
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
