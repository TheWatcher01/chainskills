/**
 * CLI entry point — main Citty router.
 *
 * Registers all sub-commands and handles global options.
 *
 * @module cli/index
 */

import { defineCommand, runMain } from 'citty';
import { runCommand } from './run.js';
import { validateCommand } from './validate.js';
import { initCommand } from './init.js';
import { inspectCommand } from './inspect.js';
import { listCommand } from './list.js';
import { serveCommand } from './serve.js';
import { certifyCommand } from './certify.js';
import { historyCommand } from './history.js';
import { replayCommand } from './replay.js';
import { snapshotCommand } from './snapshot.js';
import { rulesCommand } from './rules.js';

const main = defineCommand({
    meta: {
        name: 'chainskills',
        version: '0.7.0',
        description:
            'Compose, share, and run AI agent workflows written in natural language',
    },
    subCommands: {
        run: runCommand,
        validate: validateCommand,
        init: initCommand,
        inspect: inspectCommand,
        list: listCommand,
        serve: serveCommand,
        certify: certifyCommand,
        history: historyCommand,
        replay: replayCommand,
        snapshot: snapshotCommand,
        rules: rulesCommand,
    },
});

runMain(main);
