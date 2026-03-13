/**
 * CLI command: `chainskills certify`
 *
 * Manages the validation lifecycle of workflows:
 * - `certify <file>` — mark as validated with SHA-256 hash
 * - `certify <file> --verify` — check integrity against stored hash
 * - `certify <file> --deprecate` — mark as deprecated
 * - `certify <file> --status` — show current validation status
 *
 * @module cli/certify
 */

import { defineCommand } from 'citty';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import {
    computeWorkflowHash,
    verifyWorkflowIntegrity,
} from '#core/services/workflow-integrity.js';

/**
 * Update a frontmatter field in a workflow source string.
 *
 * If the field exists, replace it. If not, insert it before the closing `---`.
 */
function setFrontmatterField(
    source: string,
    field: string,
    value: string,
): string {
    const fmMatch = source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
    if (!fmMatch) return source;

    const prefix = fmMatch[1]!;
    let body = fmMatch[2]!;
    const suffix = fmMatch[3]!;
    const rest = source.slice(fmMatch[0].length);

    const fieldRegex = new RegExp(`^${field}:.*$`, 'm');
    if (fieldRegex.test(body)) {
        body = body.replace(fieldRegex, `${field}: ${value}`);
    } else {
        body = `${body}\n${field}: ${value}`;
    }

    return `${prefix}${body}${suffix}${rest}`;
}

export const certifyCommand = defineCommand({
    meta: {
        name: 'certify',
        description: 'Manage workflow validation lifecycle',
    },
    args: {
        file: {
            type: 'positional',
            description: 'Path to the .workflow.md file',
            required: true,
        },
        verify: {
            type: 'boolean',
            description: 'Verify integrity against stored hash',
            default: false,
        },
        deprecate: {
            type: 'boolean',
            description: 'Mark workflow as deprecated',
            default: false,
        },
        status: {
            type: 'boolean',
            description: 'Show current validation status',
            default: false,
        },
        by: {
            type: 'string',
            description: 'Who is certifying (default: current user)',
            required: false,
        },
    },
    async run({ args }) {
        const filePath = resolve(args.file);
        let source: string;

        try {
            source = readFileSync(filePath, 'utf-8');
        } catch {
            console.error(pc.red(`Cannot read file: ${filePath}`));
            process.exitCode = 1;
            return;
        }

        // Extract existing frontmatter values
        const statusMatch = source.match(/^status:\s*(\S+)/m);
        const hashMatch = source.match(/^validationHash:\s*(\S+)/m);
        const byMatch = source.match(/^validatedBy:\s*(.+)/m);
        const atMatch = source.match(/^validatedAt:\s*(.+)/m);

        const currentStatus = statusMatch?.[1] ?? 'draft';
        const currentHash = hashMatch?.[1];

        // --status: show info and exit
        if (args.status) {
            console.log(pc.cyan('\n⟫ Workflow Certification Status\n'));
            console.log(`  ${pc.bold('File:')}      ${filePath}`);
            console.log(`  ${pc.bold('Status:')}    ${statusColor(currentStatus)}`);
            if (currentHash) {
                console.log(`  ${pc.bold('Hash:')}      ${pc.dim(currentHash.slice(0, 16))}...`);
            }
            if (byMatch) {
                console.log(`  ${pc.bold('Certified by:')} ${byMatch[1]!.trim()}`);
            }
            if (atMatch) {
                console.log(`  ${pc.bold('Certified at:')} ${atMatch[1]!.trim()}`);
            }

            // Quick integrity check
            if (currentHash) {
                const intact = verifyWorkflowIntegrity(source, currentHash);
                console.log(
                    `  ${pc.bold('Integrity:')}  ${intact ? pc.green('OK — no changes since certification') : pc.red('MODIFIED — workflow changed after certification')}`,
                );
            }
            console.log('');
            return;
        }

        // --verify: check hash integrity
        if (args.verify) {
            if (!currentHash) {
                console.log(pc.yellow('No validation hash found — workflow has not been certified'));
                process.exitCode = 1;
                return;
            }

            const intact = verifyWorkflowIntegrity(source, currentHash);
            if (intact) {
                console.log(pc.green('✓ Integrity verified — workflow is unmodified since certification'));
            } else {
                console.log(pc.red('✗ Integrity check FAILED — workflow has been modified after certification'));
                console.log(pc.dim('  Run `chainskills certify <file>` to re-certify'));
                process.exitCode = 1;
            }
            return;
        }

        // --deprecate: mark as deprecated
        if (args.deprecate) {
            let updated = setFrontmatterField(source, 'status', 'deprecated');
            writeFileSync(filePath, updated, 'utf-8');
            console.log(pc.yellow(`⚠ Workflow marked as ${pc.bold('deprecated')}: ${filePath}`));
            return;
        }

        // Default: certify (validate)
        const certifier = args.by ?? process.env['USER'] ?? 'unknown';
        const now = new Date().toISOString();
        let updated = source;
        updated = setFrontmatterField(updated, 'status', 'validated');
        updated = setFrontmatterField(updated, 'validatedBy', certifier);
        updated = setFrontmatterField(updated, 'validatedAt', `"${now}"`);
        // Recompute hash AFTER setting status fields (hash excludes them)
        const finalHash = computeWorkflowHash(updated);
        updated = setFrontmatterField(updated, 'validationHash', finalHash);

        writeFileSync(filePath, updated, 'utf-8');

        console.log(pc.green(`\n✓ Workflow certified successfully\n`));
        console.log(`  ${pc.bold('File:')}    ${filePath}`);
        console.log(`  ${pc.bold('Status:')}  ${pc.green('validated')}`);
        console.log(`  ${pc.bold('By:')}      ${certifier}`);
        console.log(`  ${pc.bold('At:')}      ${now}`);
        console.log(`  ${pc.bold('Hash:')}    ${pc.dim(finalHash.slice(0, 16))}...`);
        console.log('');
    },
});

function statusColor(status: string): string {
    switch (status) {
        case 'validated':
            return pc.green(status);
        case 'deprecated':
            return pc.red(status);
        default:
            return pc.yellow(status);
    }
}
