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
import { replayCommand } from './replay.js';
import { benchCommand } from './bench.js';
import { distillCommand } from './distill.js';
import { publishCommand } from './publish.js';
import { addCommand } from './add.js';
import { arenaCommand } from './arena.js';
import { generateCommand } from './generate.js';
import { benchSuiteCommand } from './bench-suite.js';
import { leaderboardCommand } from './leaderboard.js';
import { exportHfCommand } from './export-hf.js';
import { importSessionCommand } from './import-session.js';
import { compareCommand } from './compare.js';
import { scorecardCommand } from './scorecard.js';
import { routeCommand } from './route.js';
import { deepCompareCommand } from './deep-compare.js';
import { exploreCommand } from './explore.js';

const main = defineCommand({
    meta: {
        name: 'chainskills',
        version: '2.0.0',
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
        replay: replayCommand,
        bench: benchCommand,
        distill: distillCommand,
        publish: publishCommand,
        add: addCommand,
        arena: arenaCommand,
        generate: generateCommand,
        'bench-suite': benchSuiteCommand,
        leaderboard: leaderboardCommand,
        'export-hf': exportHfCommand,
        'import-session': importSessionCommand,
        compare: compareCommand,
        scorecard: scorecardCommand,
        route: routeCommand,
        'deep-compare': deepCompareCommand,
        explore: exploreCommand,
    },
});

runMain(main);
