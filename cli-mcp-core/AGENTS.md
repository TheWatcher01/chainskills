# AGENTS.md — chainskills

> Point d'entrée universel pour tous les agents IA. Indexe l'architecture agentique complète.

## Projet

**chainskills** est un CLI open source TypeScript qui permet de définir, composer, partager et exécuter des workflows d'agents IA écrits en langage naturel (`.workflow.md`). Il combine le modèle de distribution de skills.sh (npm-like registry), le moteur d'orchestration DAG de Mastra, et un format de workflow en Markdown enrichi de directives légères (`@use`, `@call`, `@if`, `@for`). C'est le "shadcn/ui des workflows IA".

| Clé                 | Valeur                                                             |
| ------------------- | ------------------------------------------------------------------ |
| **Langage**         | TypeScript (strict) — Node.js ≥ 20                                 |
| **CLI framework**   | Citty ^0.2.1                                                       |
| **Orchestration**   | Mastra (DAG : `.then()`, `.parallel()`, `.branch()`, `.foreach()`) |
| **Parsing**         | unified + remark-parse + remark-directive + gray-matter            |
| **Interop**         | MCP SDK (Model Context Protocol) — client + server                 |
| **Validation**      | Zod ^3.25                                                          |
| **Tests**           | Vitest ^4.0                                                        |
| **Build**           | obuild ^0.4.22 (Rolldown)                                          |
| **Package manager** | pnpm                                                               |
| **Architecture**    | Hexagonal (Ports & Adapters) — core pur, zéro dépendance           |
| **License**         | MIT                                                                |

---

## Agents (2)

| Agent      | Rôle                                             | Fichier                          |
| ---------- | ------------------------------------------------ | -------------------------------- |
| **Plan**   | Recherche & planification d'implémentation (r/o) | `.github/agents/Plan.agent.md`   |
| **Review** | QA & validation du travail complété              | `.github/agents/Review.agent.md` |

---

## Architecture — Couches

```
┌─────────────────────────────────────────────────────────┐
│  CLI Layer (Citty)                                      │
│  chainskills run | validate | add | list | serve        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Core (domaine pur — zéro dépendance)                   │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Entities │ │ Use Cases│ │ Services   │ │ Ports    │ │
│  │ Workflow │ │ Parse    │ │ Template   │ │ Executor │ │
│  │ Step     │ │ BuildDAG │ │ Condition  │ │ Resolver │ │
│  │ Directive│ │ Validate │ │ Engine     │ │ Registry │ │
│  └──────────┘ └──────────┘ └────────────┘ └──────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ Ports & Adapters
┌──────────────────────▼──────────────────────────────────┐
│  Adapters                                               │
│  ┌─────────┐ ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────┐ │
│  │ Remark  │ │ Mastra  │ │ MCP  │ │ Skills │ │ State│ │
│  │ Parser  │ │ Executor│ │ SDK  │ │ Resolve│ │ Store│ │
│  └─────────┘ └─────────┘ └──────┘ └────────┘ └──────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Structure du Projet

```
chainskills/
├── bin/
│   └── cli.mjs                    # Shim d'entrée avec compile cache
├── src/
│   ├── core/                      # Domaine pur — zéro dépendance externe
│   │   ├── entities/              # Workflow, Step, Directive, Variable
│   │   ├── use-cases/             # parse-workflow, build-dag, validate, resolve-imports
│   │   ├── services/              # template-engine, condition-parser
│   │   └── ports/                 # Interfaces abstraites (executor, parser, resolver, registry, state)
│   ├── adapters/                  # Implémentations concrètes
│   │   ├── parser/                # remark-workflow-plugin, frontmatter-parser, markdown-parser
│   │   ├── executor/              # mastra-executor, simple-executor
│   │   ├── tools/                 # mcp-client, mcp-server, copilot-acp, shell
│   │   ├── skills/                # local-resolver, git-resolver, registry-resolver
│   │   ├── state/                 # memory-store, sqlite-store, redis-store
│   │   └── registry/              # npm-registry, git-registry
│   ├── cli/                       # Commandes CLI (run, validate, list, add, init, inspect, publish, serve)
│   ├── config/                    # DI container, env validation, defaults
│   └── infrastructure/            # Logger, error types (Result pattern)
├── templates/                     # Workflows d'exemple pré-packagés
│   ├── dev/                       # code-review, tdd-cycle, refactor-module
│   ├── cybersec/                  # recon-target, vuln-scan, pentest-report
│   ├── osint/                     # person-recon, domain-recon, social-footprint
│   └── ess/                       # grant-application, budget-zero-euro, multi-funder-dispatch
├── tests/                         # Vitest — parser, runtime, mcp, cli
├── rules/                         # Règles métier externalisées (JSON)
├── .github/                       # Architecture agentique
│   ├── ROADMAP.md                 # Suivi détaillé : phases, checkboxes, changelog, métriques
│   ├── agents/                    # Plan.agent.md, Review.agent.md
│   ├── prompts/                   # Prompts réutilisables
│   ├── skills/                    # Skills Copilot custom
│   └── instructions/              # Instructions path-specific
├── .env.example
├── .gitignore
├── build.config.mjs
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── LICENSE
└── README.md
```

---

## Format `.workflow.md` — Directives @

| Directive   | Sémantique                     | Syntaxe                                       |
| ----------- | ------------------------------ | --------------------------------------------- |
| `@use`      | Importer un skill, tool, agent | `@use pdf-processing`                         |
| `@call`     | Appeler un outil avec capture  | `@call tool.method($input) → $output`         |
| `@if/@else` | Branchement conditionnel       | `@if $score > 50:` ... `@else:`               |
| `@for`      | Itération bornée               | `@for $item in $list:`                        |
| `@repeat`   | Boucle avec condition d'arrêt  | `@repeat max:5 until $valid == true:`         |
| `@parallel` | Exécution parallèle            | `@parallel:`                                  |
| `@try`      | Gestion d'erreurs              | `@try:` ... `@on-error: log and continue`     |
| `@assert`   | Checkpoint de validation       | `@assert $budget.total == $budget.charges`    |
| `@output`   | Déclarer la sortie du workflow | `@output: $report, $score`                    |
| `@workflow` | Sub-workflow inline            | `@workflow validate-budget:`                  |
| `@env`      | Variable d'environnement       | `@env API_KEY`                                |
| `@agent`    | Déléguer à un agent            | `@agent copilot: "Fix this bug"`              |
| `@handoff`  | Transférer à un autre agent    | `@handoff review-agent: "Review the changes"` |

---

## Commandes CLI

```bash
# Exécution
chainskills run workflow.md --input target=example.com
chainskills run workflow.md --dry-run

# Validation & inspection
chainskills validate workflow.md
chainskills inspect workflow.md          # DAG visuel ASCII

# Gestion des workflows
chainskills init my-workflow
chainskills list [-g]
chainskills add owner/repo[@workflow]
chainskills remove <name>
chainskills publish

# Interopérabilité MCP
chainskills serve [--port 3001]
```

---

## Skills

### Custom — Copilot (2)

| Skill            | Fonction                               | Fichier                                |
| ---------------- | -------------------------------------- | -------------------------------------- |
| **smart**        | Auto-apprentissage à partir des échecs | `.github/skills/smart/SKILL.md`        |
| **smart-commit** | Commits Git groupés, audit sécurité    | `.github/skills/smart-commit/SKILL.md` |

### Externes — Workflows DAG (1)

| Skill                | Fonction                                                                                              | Source                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **mastra-workflows** | Orchestration DAG avec Mastra 1.x (`createStep`, `.then()`, `.parallel()`, `.branch()`, `.foreach()`) | `~/.agents/skills/mastra-workflows/SKILL.md` |

---

## Prompts

| Prompt           | Usage                       | Fichier                                  |
| ---------------- | --------------------------- | ---------------------------------------- |
| **smart-commit** | Commits groupés par feature | `.github/prompts/smart-commit.prompt.md` |
| **smart-review** | Revue de code automatisée   | `.github/prompts/smart-review.prompt.md` |

---

## Instructions Path-Specific

| Pattern       | Fichier                                                           | Description                  |
| ------------- | ----------------------------------------------------------------- | ---------------------------- |
| `src/core/**` | [core.instructions.md](.github/instructions/core.instructions.md) | Domaine pur, zéro dépendance |
| `src/cli/**`  | [cli.instructions.md](.github/instructions/cli.instructions.md)   | Conventions CLI Citty        |

---

## Validated Commands

```bash
# Build
pnpm build

# Tests
pnpm test                    # vitest run
pnpm dev                     # vitest watch

# Lint
pnpm lint                    # prettier --check .

# Run CLI (dev)
pnpm exec tsx src/cli/index.ts run workflow.md

# npx (published)
npx chainskills run workflow.md
```

---

## Roadmap

> **Fichier de suivi détaillé** : [.github/ROADMAP.md](ROADMAP.md) — phases, checkboxes, décisions, changelog, métriques.
> Toute mise à jour de roadmap doit aussi mettre à jour ce fichier.

| Phase | Version | Contenu                                          | Statut      | Date       |
| ----- | ------- | ------------------------------------------------ | ----------- | ---------- |
| 1     | v0.1.0  | MVP — Parse + Run séquentiel + CLI + Tests       | ✅ Complété | 2026-02-13 |
| 2     | v0.2.0  | Orchestration DAG (Mastra), `@parallel` réel     | ✅ Complété | 2026-02-13 |
| 3     | v0.3.0  | MCP client/server, `@agent` LLM, composite tools | ✅ Complété | 2026-02-13 |
| 4     | v0.4.0  | Extension VS Code, Copilot Chat, DAG visualizer  | 🔄 En cours | 2026-02-13 |
| 5     | v0.5.0  | Registry npm-like, résolution distante/git       | ⏳ Planifié | Q3 2026    |
| 6     | v0.6.0  | Language Server Protocol, IDE features avancées  | ⏳ Planifié | Q3 2026    |
| 7     | v1.0.0  | Production & Scale (SQLite, Redis, limits)       | ⏳ Planifié | Q4 2026    |

### v0.1.0 — MVP Complété

**Fonctionnalités :**

- Architecture Hexagonal complète (core pur + 6 ports + 7 adapters)
- Parser Markdown (frontmatter YAML + directives `@`)
- Moteur d'exécution séquentiel avec gestion d'état
- Shell tool provider réel (`@call shell.*`)
- Résolution locale de skills (`@use ./path`)
- CLI fonctionnel : `run`, `validate`, `init`
- 86 tests unitaires et d'intégration (100% passing)
- 4 templates pré-packagés (dev, cybersec, osint, ess)
- Build optimisé (obuild/Rolldown) — 252 kB
- Node.js subpath imports (`#core/*`, `#adapters/*`, etc.)

**Métriques :**

- ~40 fichiers TypeScript
- 7 fichiers de tests (Vitest)
- 0 erreurs typecheck
- Architecture prête pour extension (DAG, MCP, Registry)

### v0.2.0 — DAG Orchestration & Full Control Flow

**Fonctionnalités :**

- DAG builder complet (`buildDAG`) — détection de type, analyse de dépendances, groupes parallèles, détection de cycles
- Parser block-level (`:::parallel`, `:::if`, `:::for`, `:::try`, `:::workflow`) — containerDirective récursif
- Moteur d'exécution séquentiel complet — 15 directives (`@if/@else`, `@for`, `@repeat`, `@try/@on-error`, `@parallel`, `@assert`, `@env`, `@output`, `@agent`, `@handoff`)
- MastraExecutor — orchestration DAG réelle avec `.then()`/`.parallel()` via @mastra/core
- Strategy pattern pour sélection d'executor (`CHAINSKILLS_EXECUTOR=simple|mastra`)
- Directive handlers partagés (DRY) — `directive-handlers.ts`
- Système d'événements typé — 11 types d'événements, emitter avec `on/off/emit`
- CLI `inspect` — visualisation DAG ASCII avec caractères box-drawing (═, ◇, ↻, ⚡, ●), mode `--json`
- CLI `list` — recherche récursive de `.workflow.md` avec métadonnées frontmatter, mode `--json`
- CLI `run` — streaming d'événements en temps réel (step, directive, parallel, loop, error)
- 6 templates pré-packagés (dev: code-review, tdd-cycle | cybersec: recon-target, vuln-scan | osint: domain-recon | ess: grant-application)
- Templates enrichis avec `@parallel`, `@repeat`, `@for`, `@try`

**Métriques :**

- ~50 fichiers TypeScript
- 11 fichiers de tests (Vitest) — 141 tests
- 0 erreurs typecheck
- Architecture prête pour extension (MCP, Registry, Copilot ACP)

### v0.3.0 — MCP Interop & @agent LLM

**Fonctionnalités :**

- MCP Server adapter (5 tools, 2 prompts, dynamic resources via `registerTool`/`registerPrompt`/`registerResource`)
- CLI `serve` command (stdio for Copilot + streamable HTTP for web)
- SDK API (`runWorkflow`, `describeWorkflow`) — reused by MCP, CLI `--json`, and programmatic usage
- `--json` mode for `run` and `validate` commands
- `@agent` / `@handoff` directives — real LLM integration via OpenAI-compatible API
- AgentProvider port + NoopAgent for tests/dry-run
- MCP Client tool provider — `@call mcp.tool_name()` to invoke tools on external MCP servers
- Composite tool provider — routes `shell.*` and `mcp.*` to correct backend
- `.vscode/mcp.json` — Copilot auto-discovery of chainskills MCP server
- Security: shell injection fix (`execFileSync` + allowlist), scoped `@env`, path traversal protection
- Result monad utilities (map, flatMap, mapErr, unwrapOr, match)
- Architecture fix: `createEventEmitter()` moved from port to infrastructure

**Métriques :**

- ~60 fichiers TypeScript
- 14 fichiers de tests (Vitest) — 179 tests
- 0 erreurs typecheck
- Build: 5 bundles — 770 kB total (24 fichiers)
### v0.4.0 — VS Code Extension & Debugging (En cours)

**Phase 1 — Core Enhancements** ✅ **COMPLÉTÉ** (2026-02-13)

**Fonctionnalités :**

- ExecutionController API — `pause()`, `resume()`, `cancel()`, `step()` avec listeners
- CancellationToken entity — graceful cancellation avec observer pattern
- StateStore serialization — `serialize()`/`deserialize()` pour mid-execution persistence
- `@breakpoint` directive — conditional debugging (16ème directive)
- CLI `--format=vscode` flag — Problem Matcher format (`file:line:col: severity: message`)
- Result monad utilities — `map`, `flatMap`, `mapErr`, `unwrapOr`, `match`
- ExecutionController implémenté pour SimpleExecutor et MastraExecutor
- 18 nouveaux tests (cancellation-token, state-store, execution-controller)

**Métriques Phase 1 :**

- 197/197 tests passing (↑18 depuis v0.3.0)
- 0 erreurs typecheck
- 7 smart commits groupés par feature
- Architecture prête pour extension VS Code

**Phase 2 — Extension Skeleton** ✅ **COMPLÉTÉ** (2026-02-13)

**Fonctionnalités :**

- Nouveau repo `chainskills-vscode/` — structure complète avec src/, syntaxes/, .vscode/
- package.json — VS Code extension manifest avec contribution points :
  - 10 commands (run, runDryRun, validate, inspect, pause/resume/stop/step, openTemplates, refreshWorkflows)
  - 1 TreeView (chainskillsWorkflows in Explorer)
  - 1 Problem Matcher (`$chainskills` parse `--format=vscode`)
  - 1 Task definition (type `chainskills` with workflow/inputs/dryRun)
  - 5 configuration properties (cliPath, executor, autoValidate, showDagOnInspect, templatesPath)
- WorkflowTreeProvider — discovers `.workflow.md` files, parses frontmatter metadata
- ExecutionController — pause/resume/cancel avec POSIX signals (SIGSTOP/SIGCONT/SIGTERM)
- TextMate grammar — syntax highlighting pour 16 directives, variables `$name`, blocks `:::`
- language-configuration.json — bracket matching, auto-closing pairs, folding
- Command handlers — 10 handlers avec CLI integration via `child_process.exec()`
- Auto-validate on save — configurable via `chainskills.autoValidate`
- File watcher — refreshes TreeView on `.workflow.md` changes
- Menu contributions — editor title, view title, view context menu, command palette
- Context keys — `chainskills.isExecuting`, `chainskills.isPaused` pour command visibility

**Build & Testing :**

- TypeScript 5.4.5, Node16 modules, ES2022 target
- Webpack 5.105.2 — bundle `src/*.ts` → `dist/extension.js` (23 KB)
- ESLint + Prettier ready
- Launch config pour debugging (F5 → Extension Development Host)
- TESTING.md — comprehensive test guide (quick test 5min, full test 15min)
- test-workflow.workflow.md — validation workflow

**Métriques Phase 2 :**

- 490 lignes TypeScript → 23 KB bundle
- 18 fichiers créés (src: 4, config: 8, docs: 3, test: 1, syntaxes: 1, language-config: 1)
- 0 erreurs typecheck après corrections
- 1 commit git avec message détaillé