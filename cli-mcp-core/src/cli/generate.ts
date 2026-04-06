/**
 * CLI command: `chainskills generate --template <workflow> --variations N`
 *
 * Generates workflow variants using an LLM with different constraints.
 *
 * @module cli/generate
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import pc from 'picocolors';
import { createContainer } from '#config/container.js';
import { parseWorkflow } from '#core/use-cases/parse-workflow.js';
import { validateWorkflow } from '#core/use-cases/validate-workflow.js';
import { buildGenerationPrompt, extractWorkflowSource } from '#core/services/workflow-generation.js';
import { DEFAULT_CONSTRAINTS, type WorkflowVariant, type GenerationReport } from '#core/entities/generation-config.js';

export const generateCommand = defineCommand({
    meta: {
        name: 'generate',
        description: 'Generate workflow variants from a template using LLM',
    },
    args: {
        template: {
            type: 'string',
            description: 'Path to the base .workflow.md template',
            required: true,
        },
        variations: {
            type: 'string',
            description: 'Number of variations to generate (default: 5)',
            default: '5',
        },
        model: {
            type: 'string',
            description: 'LLM model to use for generation',
            default: 'gpt-4o-mini',
        },
        'output-dir': {
            type: 'string',
            description: 'Directory to save generated workflows',
            default: './generated',
        },
        constraints: {
            type: 'string',
            description: 'Comma-separated constraints (default: speed,reliability,validation,parallel,observability)',
            required: false,
        },
        json: {
            type: 'boolean',
            description: 'Output report as JSON',
            default: false,
        },
    },
    async run({ args }) {
        const templatePath = resolve(args.template);
        const numVariations = Number(args.variations) || 5;
        const model = args.model;
        const outputDir = resolve(args['output-dir']);
        const jsonMode = args.json;

        // Parse constraint list
        const constraintNames = args.constraints
            ? args.constraints.split(',').map((c) => c.trim())
            : DEFAULT_CONSTRAINTS.map((c) => c.name);

        const constraints = constraintNames
            .map((name) => DEFAULT_CONSTRAINTS.find((c) => c.name === name) ?? { name, description: name })
            .slice(0, numVariations);

        // Read template
        let templateSource: string;
        try {
            templateSource = readFileSync(templatePath, 'utf-8');
        } catch {
            console.error(pc.red(`Cannot read template: ${templatePath}`));
            process.exit(1);
        }

        // Parse to get workflow name
        const container = await createContainer({ logLevel: 'warn' });
        const parseResult = parseWorkflow(templateSource, container.parser);
        if (!parseResult.ok) {
            console.error(pc.red(`Template parse error: ${parseResult.error.message}`));
            process.exit(1);
        }

        const workflowName = parseResult.value.name;

        if (!jsonMode) {
            console.log(pc.cyan(`⟫ Generating ${numVariations} variants of "${workflowName}"`));
            console.log(pc.dim(`  Model: ${model}`));
            console.log(pc.dim(`  Constraints: ${constraints.map((c) => c.name).join(', ')}`));
        }

        // Create output directory
        mkdirSync(outputDir, { recursive: true });

        const variants: WorkflowVariant[] = [];
        let totalTokens = 0;

        for (let i = 0; i < numVariations; i++) {
            const constraint = constraints[i % constraints.length]!;

            if (!jsonMode) {
                process.stdout.write(`  [${i + 1}/${numVariations}] ${constraint.name}... `);
            }

            // Generate
            const prompt = buildGenerationPrompt(templateSource, constraint, workflowName);

            const prevModel = process.env['AGENT_MODEL'];
            process.env['AGENT_MODEL'] = model;

            const result = await container.agent.invoke({
                agent: 'copilot',
                prompt,
                model,
            });

            if (prevModel !== undefined) process.env['AGENT_MODEL'] = prevModel;
            else delete process.env['AGENT_MODEL'];

            if (!result.ok) {
                variants.push({
                    baseWorkflow: workflowName,
                    variantIndex: i,
                    constraint: constraint.name,
                    source: '',
                    valid: false,
                    validationError: result.error.message,
                    model,
                    generatedAt: new Date().toISOString(),
                });
                if (!jsonMode) console.log(pc.red('FAILED'));
                continue;
            }

            const generatedSource = extractWorkflowSource(result.value.content);
            const tokens = result.value.usage;
            if (tokens) totalTokens += tokens.totalTokens;

            // Validate generated workflow
            const genParseResult = parseWorkflow(generatedSource, container.parser);
            let valid = false;
            let validationError: string | undefined;

            if (genParseResult.ok) {
                const validation = validateWorkflow(genParseResult.value);
                valid = validation.ok ? validation.value.valid : false;
                if (!valid) {
                    validationError = validation.ok
                        ? validation.value.diagnostics.map((d) => d.message).join('; ')
                        : validation.error.message;
                }
            } else {
                validationError = genParseResult.error.message;
            }

            const variant: WorkflowVariant = {
                baseWorkflow: workflowName,
                variantIndex: i,
                constraint: constraint.name,
                source: generatedSource,
                valid,
                validationError,
                model,
                tokens: tokens ? { prompt: tokens.promptTokens, completion: tokens.completionTokens, total: tokens.totalTokens } : undefined,
                generatedAt: new Date().toISOString(),
            };

            variants.push(variant);

            // Save to file
            const filename = `${workflowName}-${constraint.name}-${i}.workflow.md`;
            writeFileSync(resolve(outputDir, filename), generatedSource, 'utf-8');

            if (!jsonMode) {
                console.log(valid ? pc.green('OK') : pc.yellow(`WARN (${validationError})`));
            }
        }

        const successful = variants.filter((v) => v.valid).length;
        const failed = variants.length - successful;

        const report: GenerationReport = {
            template: workflowName,
            totalVariations: numVariations,
            successful,
            failed,
            totalTokens,
            variants,
            generatedBy: model,
            timestamp: new Date().toISOString(),
        };

        if (jsonMode) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log(pc.cyan(`\n⟫ Generation complete`));
            console.log(`  Generated: ${pc.green(String(successful))} valid, ${pc.red(String(failed))} invalid`);
            console.log(`  Tokens: ${totalTokens}`);
            console.log(`  Output: ${outputDir}/`);
        }
    },
});
