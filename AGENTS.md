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

## Agents (3)

| Agent        | Rôle                                                      | Fichier                            |
| ------------ | --------------------------------------------------------- | ---------------------------------- |
| **Research** | Recherche approfondie web+codebase, sourcing et freshness | `.github/agents/Research.agent.md` |
| **Plan**     | Recherche & planification d'implémentation (r/o)          | `.github/agents/Plan.agent.md`     |
| **Review**   | QA & validation du travail complété                       | `.github/agents/Review.agent.md`   |

**Handoff graph :**

```
[Research] ──→ [Plan] ──→ (implementation) ──→ [Review]
    ↑                                              │
    └──────────── re-research if blocked ──────────┘
```

---

## Architecture — Couches

```
┌─────────────────────────────────────────────────────────────────────┐
│  VS Code Extension Layer (../vscode)                                │
│  ChatParticipant | CodeLens | Completion | Hover | DAG Webview      │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ import as library
┌──────────────────────▼──────────────────────────────────────────────┐
│  CLI Layer (Citty)                                                  │
│  chainskills run | validate | inspect | list | serve | init         │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────┐
│  Core (domaine pur — zéro dépendance)                               │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐             │
│  │ Entities │ │ Use Cases│ │ Services   │ │ Ports    │             │
│  │ Workflow │ │ Parse    │ │ Template   │ │ Executor │             │
│  │ Step     │ │ BuildDAG │ │ Condition  │ │ Resolver │             │
│  │ Directive│ │ Validate │ │ Engine     │ │ Registry │             │
│  │ Cancel   │ │ RunWF    │ │            │ │ Agent    │             │
│  └──────────┘ └──────────┘ └────────────┘ └──────────┘             │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ Ports & Adapters
┌──────────────────────▼──────────────────────────────────────────────┐
│  Adapters                                                           │
│  ┌─────────┐ ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌────────┐ │
│  │ Remark  │ │ Mastra  │ │ MCP  │ │ Skills │ │ State│ │ Agent  │ │
│  │ Parser  │ │ Executor│ │ SDK  │ │ Resolve│ │ Store│ │ OpenAI │ │
│  └─────────┘ └─────────┘ └──────┘ └────────┘ └──────┘ └────────┘ │
└─────────────────────────────────────────────────────────────────────┘
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
│   ├── ess/                       # grant-application, budget-zero-euro, multi-funder-dispatch
│   └── meta/                      # Meta-workflows : agent-factory, research-domain
├── tests/                         # Vitest — parser, runtime, mcp, cli
├── rules/                         # Règles métier externalisées (JSON)
├── .github/                       # Architecture agentique
│   ├── ROADMAP.md                 # Suivi détaillé : phases, checkboxes, changelog, métriques
│   ├── agents/                    # Research.agent.md, Plan.agent.md, Review.agent.md
│   ├── prompts/                   # Prompts réutilisables
│   ├── skills/                    # Skills Copilot custom (smart, smart-commit, research)
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

| Directive     | Sémantique                     | Syntaxe                                       |
| ------------- | ------------------------------ | --------------------------------------------- |
| `@use`        | Importer un skill, tool, agent | `@use pdf-processing`                         |
| `@call`       | Appeler un outil avec capture  | `@call tool.method($input) → $output`         |
| `@if/@else`   | Branchement conditionnel       | `@if $score > 50:` ... `@else:`               |
| `@for`        | Itération bornée               | `@for $item in $list:`                        |
| `@repeat`     | Boucle avec condition d'arrêt  | `@repeat max:5 until $valid == true:`         |
| `@parallel`   | Exécution parallèle            | `@parallel:`                                  |
| `@try`        | Gestion d'erreurs              | `@try:` ... `@on-error: log and continue`     |
| `@assert`     | Checkpoint de validation       | `@assert $budget.total == $budget.charges`    |
| `@output`     | Déclarer la sortie du workflow | `@output: $report, $score`                    |
| `@workflow`   | Sub-workflow inline            | `@workflow validate-budget:`                  |
| `@env`        | Variable d'environnement       | `@env API_KEY`                                |
| `@agent`      | Déléguer à un agent            | `@agent copilot: "Fix this bug"`              |
| `@handoff`    | Transférer à un autre agent    | `@handoff review-agent: "Review the changes"` |
| `@breakpoint` | Point d'arrêt conditionnel     | `@breakpoint $count > 5`                      |

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

### Custom — Copilot (3)

| Skill            | Fonction                                            | Fichier                                |
| ---------------- | --------------------------------------------------- | -------------------------------------- |
| **smart**        | Auto-apprentissage à partir des échecs              | `.github/skills/smart/SKILL.md`        |
| **smart-commit** | Commits Git groupés, audit sécurité                 | `.github/skills/smart-commit/SKILL.md` |
| **research**     | Protocole de recherche multi-sources avec freshness | `.github/skills/research/SKILL.md`     |

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

> **Roadmap portfolio (root)** : [ROADMAP.md](ROADMAP.md) — vue globale multi-projets.
> **Roadmap canonique CLI/Core** : [cli-mcp-core/.github/ROADMAP.md](cli-mcp-core/.github/ROADMAP.md) — suivi détaillé phases/checklists/changelog.
> Toute mise à jour de statut doit synchroniser la roadmap portfolio et la roadmap canonique impactée.

| Phase | Version | Contenu                                                          | Statut      | Date       |
| ----- | ------- | ---------------------------------------------------------------- | ----------- | ---------- |
| 1     | v0.1.0  | MVP — Parse + Run séquentiel + CLI + Tests                       | ✅ Complété | 2026-02-13 |
| 2     | v0.2.0  | Orchestration DAG (Mastra), `@parallel` réel                     | ✅ Complété | 2026-02-13 |
| 3     | v0.3.0  | MCP client/server, `@agent` LLM, composite tools                 | ✅ Complété | 2026-02-13 |
| 4     | v0.4.0  | Extension VS Code skeleton, core enhancements                    | ✅ Complété | 2026-02-13 |
| 5     | v0.5.0  | IDE Language Features (CodeLens, Completion, Hover, Diagnostics) | 🔄 En cours | Q2 2026    |
| 6     | v0.6.0  | Copilot Chat `@chainskills`, Agent Mode tools, DAG Webview       | ⏳ Planifié | Q2 2026    |
| 7     | v0.7.0  | Debug Adapter (DAP), Test Controller, Rename/References          | ⏳ Planifié | Q3 2026    |
| 8     | v0.8.0  | Registry npm-like, résolution distante/git                       | ⏳ Planifié | Q3 2026    |
| 9     | v0.9.0  | Polish, integration tests, marketplace publish                   | ⏳ Planifié | Q4 2026    |
| 10    | v1.0.0  | Production & Scale (SQLite, Redis, enterprise)                   | ⏳ Planifié | Q4 2026    |

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

### v0.4.0 — Extension VS Code & Core Enhancements ✅ COMPLÉTÉ (2026-02-13)

**Fonctionnalités Core (Phase 1) :**

- ExecutionController API — `pause()`, `resume()`, `cancel()`, `step()` avec listeners
- CancellationToken entity — graceful cancellation avec observer pattern
- StateStore serialization — `serialize()`/`deserialize()` pour mid-execution persistence
- `@breakpoint` directive — conditional debugging (17ème directive)
- CLI `--format=vscode` flag — Problem Matcher format
- Result monad utilities — `map`, `flatMap`, `mapErr`, `unwrapOr`, `match`

**Extension VS Code (Phase 2) :**

- Repo `../vscode/` — 10 commands, 1 TreeView, TextMate grammar, Problem Matcher
- WorkflowTreeProvider — discovers `.workflow.md` files, parses frontmatter
- ExecutionController — POSIX signals (SIGSTOP/SIGCONT/SIGTERM)
- Auto-validate on save, file watcher, 5 configuration properties
- Webpack 5 → 23 KB bundle

**Métriques :**

- CLI: 197/197 tests passing, 0 erreurs typecheck
- Extension: 490 lignes TS → 23 KB bundle, 18 fichiers créés

### v0.5.0 — IDE Language Features (En cours)

**Objectif** : Transformer l'extension en vrai IDE pour `.workflow.md`

**Intégrations prévues (Top 15 VS Code APIs) :**

| Feature                     | API                             | Impact |
| --------------------------- | ------------------------------- | ------ |
| Copilot Chat `@chainskills` | `createChatParticipant`         | ★★★★★  |
| Agent Mode Tools            | `lm.registerTool`               | ★★★★★  |
| CodeLens Run/Validate       | `CodeLensProvider`              | ★★★★☆  |
| Live Diagnostics            | `DiagnosticCollection`          | ★★★★☆  |
| Autocomplete @/$/@call      | `CompletionItemProvider`        | ★★★★☆  |
| DAG Webview                 | `WebviewPanel` (D3.js)          | ★★★★☆  |
| Debug Adapter (DAP)         | `DebugAdapterDescriptorFactory` | ★★★★★  |
| Test Controller             | `TestController`                | ★★★★☆  |
| StatusBar                   | `StatusBarItem`                 | ★★★☆☆  |
| Hover Documentation         | `HoverProvider`                 | ★★★☆☆  |
| Document Links              | `DocumentLinkProvider`          | ★★★☆☆  |
| File Decorations            | `FileDecorationProvider`        | ★★★☆☆  |
| Document Symbols            | `DocumentSymbolProvider`        | ★★★☆☆  |
| Folding Ranges              | `FoldingRangeProvider`          | ★★☆☆☆  |
| Variable Rename             | `RenameProvider`                | ★★★☆☆  |
