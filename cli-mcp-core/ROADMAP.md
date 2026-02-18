# Roadmap & Implementation Log — chainskills

> Fichier de suivi maintenu automatiquement pendant l'implémentation.

---

## Versions planifiées

| Version  | Phase     | Contenu                                                           | Statut      |
| -------- | --------- | ----------------------------------------------------------------- | ----------- |
| v0.1.0   | MVP       | Parse + Run séquentiel + Shell tools + CLI                        | ✅ Complété |
| v0.2.0   | DAG       | Orchestration DAG (Mastra), full control flow, inspect, streaming | ✅ Complété |
| v0.2.1   | Security  | Hardening sécurité, Result monad utilities, architecture fixes    | ✅ Complété |
| v0.3.0-α | MCP       | MCP server, SDK API, `--json` mode, `serve` command               | ✅ Complété |
| v0.3.0   | MCP+Agent | MCP client, `@agent` LLM, composite tools                         | ✅ Complété |
| v0.4.0   | Registry  | npm-like registry, `@use` résolution distante/git                 | ⏳ Planifié |
| v0.5.0   | IDE       | Copilot ACP, agents IDE                                           | ⏳ Planifié |
| v1.0.0   | Prod      | Production & scale (SQLite, Redis, rate limiting)                 | ⏳ Planifié |

> Voir aussi : [AGENTS.md](../AGENTS.md) — architecture agentique complète, structure projet, stack technique.

---

## MVP v0.1.0 — Décisions actées

| Décision       | Choix                                                 | Raison                                          |
| -------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Result<T,E>    | Union discriminée minimale `Ok\|Err` + `ok()`/`err()` | SOTA TS, simple, extensible en monade plus tard |
| @call MVP      | Shell tool provider réel (`child_process`)            | Rend le framework immédiatement utile           |
| @use MVP       | Résolution locale (`./path`)                          | Composabilité dès jour 1 = argument viral       |
| Templates ess/ | Développé mais exclu de npm (`files` field)           | Stratégie business privée                       |
| Parser         | Synchrone (`parse` + `runSync`)                       | Garde le port core simple                       |
| @agent / MCP   | Reporté à v0.3.0                                      | Pas nécessaire pour le MVP                      |
| Imports        | Node.js subpath imports `#alias/*` (package.json)     | SOTA, natif Node.js, portable sans bundler      |

---

## Log d'implémentation

### Phase 0 — Préparation

- [x] `pnpm install`
- [x] Configurer exclusion `templates/ess/` du npm publish

### Phase 1 — Infrastructure (Layer 0)

- [x] `src/infrastructure/errors.ts` — Result<T,E>, error types
- [x] `src/infrastructure/logger.ts` — Logger structuré JSON

### Phase 2 — Core Entities (Layer 1)

- [x] `src/core/entities/variable.ts`
- [x] `src/core/entities/directive.ts`
- [x] `src/core/entities/step.ts`
- [x] `src/core/entities/workflow.ts`
- [x] `src/core/entities/index.ts`

### Phase 3 — Core Ports (Layer 2)

- [x] `src/core/ports/workflow-parser.port.ts`
- [x] `src/core/ports/workflow-executor.port.ts`
- [x] `src/core/ports/state-store.port.ts`
- [x] `src/core/ports/skill-resolver.port.ts`
- [x] `src/core/ports/tool-provider.port.ts`
- [x] `src/core/ports/workflow-registry.port.ts`
- [x] `src/core/ports/index.ts`

### Phase 4 — Core Services (Layer 3)

- [x] `src/core/services/template-engine.ts`
- [x] `src/core/services/condition-parser.ts`
- [x] `src/core/services/index.ts`

### Phase 5 — Core Use Cases (Layer 4)

- [x] `src/core/use-cases/parse-workflow.ts`
- [x] `src/core/use-cases/validate-workflow.ts`
- [x] `src/core/use-cases/build-dag.ts` (stub)
- [x] `src/core/use-cases/resolve-imports.ts`
- [x] `src/core/use-cases/index.ts`
- [x] `src/core/index.ts`

### Phase 6 — Tests Core

- [x] `tests/parser/directives.test.ts` — 21 tests
- [x] `tests/runtime/step-execution.test.ts` — 30 tests
- [x] `tests/runtime/validate-workflow.test.ts` — 9 tests

### Phase 7 — Adapters (Layer 5)

- [x] `src/adapters/state/memory-store.ts`
- [x] `src/adapters/parser/frontmatter-parser.ts`
- [x] `src/adapters/parser/remark-workflow-plugin.ts`
- [x] `src/adapters/parser/markdown-parser.ts`
- [x] `src/adapters/tools/shell-tool-provider.ts`
- [x] `src/adapters/executor/simple-executor.ts`
- [x] `src/adapters/skills/local-resolver.ts`

### Phase 8 — Tests Adapters

- [x] `tests/parser/frontmatter.test.ts` — 6 tests
- [x] `tests/parser/workflow-builder.test.ts` — 5 tests
- [x] `tests/runtime/workflow-run.test.ts` — 6 tests

### Phase 9 — Config & DI (Layer 6)

- [x] `src/config/defaults.ts`
- [x] `src/config/env.ts`
- [x] `src/config/container.ts`

### Phase 10 — CLI (Layer 7)

- [x] `src/cli/run.ts`
- [x] `src/cli/validate.ts`
- [x] `src/cli/init.ts`
- [x] `src/cli/index.ts`

### Phase 10.5 — Import Migration

- [x] Ajout `imports` dans `package.json` (Node.js subpath imports)
- [x] Mise à jour `vitest.config.ts` aliases (trailing `/`)
- [x] Migration ~90 imports cross-layer → `#alias` (`#core/*`, `#adapters/*`, `#config/*`, `#infra/*`, `#cli/*`)
- [x] Fix parser: `processSync` → `parse` + `runSync` avec `VFile`
- [x] Ajout `vfile` comme dépendance explicite

### Phase 11 — Tests CLI

- [x] `tests/cli/commands.test.ts` — 9 tests (run pipeline, validate pipeline, init scaffolding)

### Phase 12 — Root Export & Templates

- [x] `src/index.ts` — API publique (entities, ports, use cases, services, infra, config)
- [x] `templates/dev/code-review.workflow.md`
- [x] `templates/cybersec/recon-target.workflow.md`
- [x] `templates/osint/domain-recon.workflow.md`
- [x] `templates/ess/grant-application.workflow.md`

### Phase 13 — Build & Verify

- [x] `pnpm build` — 4 bundles, 252 kB total, types générés
- [x] `pnpm test` — 86/86 tests passing (7 fichiers)
- [x] `pnpm typecheck` — 0 erreurs TypeScript
- [x] Test E2E : `chainskills validate templates/dev/code-review.workflow.md` ✓
- [x] Test E2E : `chainskills run ... --dry-run` ✓
- [x] Test E2E : `chainskills init my-workflow` ✓
- [x] Fix `build.config.mjs` — import `obuild/config`, format entries `type: 'bundle'`
- [x] Fix `bin/cli.mjs` — pointe vers `dist/cli/index.mjs`
- [x] Fix `package.json` exports — chemins corrigés vers build output réel

---

## Résultats finaux MVP v0.1.0

| Métrique     | Valeur                                                       |
| ------------ | ------------------------------------------------------------ |
| Tests        | 86/86 passing (7 fichiers)                                   |
| Typecheck    | 0 erreurs                                                    |
| Build        | 4 bundles — 252 kB total (index, cli, parser, runtime)       |
| Fichiers src | ~40 fichiers TypeScript                                      |
| Architecture | Hexagonal — core pur, 6 ports, 7 adapters, DI container      |
| CLI commands | `run`, `validate`, `init`                                    |
| Templates    | 4 (.workflow.md) — dev, cybersec, osint, ess                 |
| Imports      | Node.js subpath `#alias/*` — zéro import relatif cross-layer |

---

## Changelog

| Date       | Phase  | Action                                                | Fichiers                                          |
| ---------- | ------ | ----------------------------------------------------- | ------------------------------------------------- |
| 2026-02-13 | 0      | Création du fichier de suivi                          | `.github/ROADMAP.md`                              |
| 2026-02-13 | 0-10   | Implémentation MVP complète                           | ~40 fichiers src/ + 6 fichiers tests/             |
| 2026-02-13 | 10.5   | Migration imports → `#alias` subpath                  | ~25 fichiers mis à jour                           |
| 2026-02-13 | 11     | Tests CLI                                             | `tests/cli/commands.test.ts`                      |
| 2026-02-13 | 12     | Root export + 4 templates                             | `src/index.ts` + `templates/**/*.workflow.md`     |
| 2026-02-13 | 13     | Build, typecheck, E2E, fix build pipeline             | `build.config.mjs`, `bin/cli.mjs`, `package.json` |
| 2026-02-13 | v0.2   | Phase 1-8 : DAG, parser blocs, executors, events, CLI | ~15 fichiers créés/modifiés                       |
| 2026-02-13 | v0.2   | Phase 9 : Tests (55 nouveaux, 141 total)              | 4 nouveaux fichiers tests                         |
| 2026-02-13 | v0.2   | Phase 10 : Templates enrichis (2 new, 2 updated)      | `templates/**/*.workflow.md`                      |
| 2026-02-13 | v0.2   | Phase 11-12 : Exports, build, docs, vérification      | `src/index.ts`, `AGENTS.md`, `README.md`          |
| 2026-02-13 | v0.2.1 | Security hardening + Result monad + arch fixes        | 10 fichiers modifiés, 1 créé                      |
| 2026-02-13 | v0.3α  | MCP server, SDK API, `serve`, `--json`, config MCP    | 6 fichiers créés, 8 modifiés, 149 tests           |
| 2026-02-13 | v0.3.0 | @agent LLM + MCP client + composite tools             | 6 fichiers créés, 10 modifiés, 179 tests          |

---

## v0.2.0 — DAG Orchestration & Full Control Flow

### Décisions actées v0.2.0

| Décision                  | Choix                                                        | Raison                                                            |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Executor strategy         | Coexistence `SimpleExecutor` + `MastraExecutor` via DI       | Strategy pattern SOTA — switch via env var, fallback offline/test |
| Schémas Mastra dynamiques | `z.record(z.unknown())` pour input/output                    | chainskills dynamiquement typé — variables résolues au runtime    |
| Directive handlers        | Module partagé `directive-handlers.ts` entre les 2 executors | DRY, testable indépendamment, un seul endroit à maintenir         |
| Events d'exécution        | Port Observer (core) + adapter EventEmitter (Node.js)        | Découplage CLI/executor, streaming temps réel                     |
| DAG auto-parallélisation  | Analyse de dépendances de variables ($capture → $consumer)   | Steps sans lien = parallélisables automatiquement — power feature |
| Parser blocs structurés   | `containerDirective` de remark-directive + `Step.children`   | API existante dans remark-directive, zéro nouvelle dépendance     |
| CLI streaming             | `@clack/prompts` (spinners, progress, log)                   | Déjà installé, UX moderne, non-blocking                           |
| Env var executor          | `CHAINSKILLS_EXECUTOR=simple\|mastra` (default: `mastra`)    | Config externalisée, fail-fast validation                         |

### Phase 1 — Core : DAG intelligent + analyse de dépendances

- [x] Enrichir `DAGNode` — ajouter `type`, `condition`, `iterable`, `children`
- [x] Implémenter l'analyse de dépendances de variables (`@call → $capture` → consommateurs)
- [x] Détecter les groupes `@parallel` → nœuds parallèles
- [x] Détecter les branches `@if/@else` → nœuds `type: 'branch'`
- [x] Détecter les boucles `@for` / `@repeat` → nœuds `type: 'loop'`
- [x] Détecter les blocs `@try/@on-error` → nœuds `type: 'try-catch'`
- [x] Détecter les sub-workflows `@workflow` → nœud composite
- [x] Détection de cycles → `ValidationError`

### Phase 2 — Parser : support des blocs structurés

- [x] Enrichir le remark plugin — gérer les `containerDirective` pour `@parallel:`, `@if:`, `@for:`, `@repeat:`, `@try:`, `@workflow:`
- [x] Peupler `Step.children` — walk récursif des enfants de container
- [x] Ajouter le parsing `@else` — association au `@if` précédent
- [x] Parser les arguments `@for` — `variable`, `iterable`, `concurrency` optionnel
- [x] Parser les arguments `@repeat` — `max`, `until`/`while`

### Phase 3 — SimpleExecutor : enrichir le control flow séquentiel

- [x] `@if/@else` réel — évaluer condition, exécuter le bon bloc
- [x] `@for` réel — itérer sur la liste, exécuter enfants par élément
- [x] `@repeat` réel — boucler avec condition `until`/`while` + compteur `max`
- [x] `@try/@on-error` réel — wrapper try/catch, exécuter `@on-error` sur erreur
- [x] `@parallel` séquentiel — marqué parallèle mais exécuté séquentiellement
- [x] `@workflow` réel — résoudre et exécuter le sub-workflow récursivement
- [x] Wirer `resolveImports` dans le pipeline CLI (`run.ts`)

### Phase 4 — MastraExecutor : adapter DAG avec orchestration réelle

- [x] Créer `src/adapters/executor/mastra-executor.ts`
- [x] Fonction `translateToMastra(dag, workflow)` → DAG chainskills → Mastra workflow
- [x] Créer les `createStep` dynamiques (schémas lâches, délégation aux handlers)
- [x] Gestion du state workflow — mapper `StateStore` ↔ Mastra `state`/`setState`
- [x] Gestion des erreurs + retries — mapper vers modèle Mastra (`bail()`, `retryConfig`)
- [x] Mode dry-run via Mastra

### Phase 5 — Config : Strategy pattern pour l'executor

- [x] Enrichir `AppConfig` — `executor: 'simple' | 'mastra'`
- [x] Ajouter `CHAINSKILLS_EXECUTOR` dans `env.ts`
- [x] Mettre à jour le DI container — switch `config.executor`
- [x] Mettre à jour `.env.example`

### Phase 6 — Factorisation : extraire les handlers de directives

- [x] Créer `src/adapters/executor/directive-handlers.ts` — handlers par type (~561 lignes, 15 handlers)
- [x] Injecter les handlers dans `SimpleExecutor` et `MastraExecutor`

### Phase 7 — CLI : inspect + streaming + commandes

- [x] Créer `src/cli/inspect.ts` — DAG ASCII art (═, ◇, ↻, ⚡, ●) + `--json`
- [x] Créer `src/cli/list.ts` — recherche récursive `.workflow.md` + métadonnées frontmatter + `--json`
- [x] Streaming dans `run.ts` — événements temps réel (step, directive, parallel, loop, error)
- [x] Mettre à jour le router CLI — ajouter `inspect`, `list`, bump version `0.2.0`

### Phase 8 — Événements d'exécution (port Observer)

- [x] Créer `src/core/ports/execution-events.port.ts` — 11 types d'événements, `ExecutionEvent` union, `createEventEmitter()` factory
- [x] Adapter observer — emitter typé avec `on/off/emit` dans les deux executors

### Phase 9 — Tests

- [x] `tests/runtime/build-dag.test.ts` — 16 tests (DAG enrichi, auto-parallélisation, cycles)
- [x] `tests/runtime/control-flow.test.ts` — 18 tests (`@if/@else`, `@for`, `@repeat`, `@try`, `@parallel`, `@workflow`)
- [x] `tests/parser/container-directives.test.ts` — 12 tests (directives container + `Step.children`)
- [x] `tests/runtime/execution-events.test.ts` — 9 tests (ordre des events, events parallèles)
- [x] Étendre `tests/cli/commands.test.ts` — `inspect`, `list` ajoutés (9 tests total)

### Phase 10 — Templates enrichis

- [x] Mettre à jour `templates/dev/code-review.workflow.md` — ajouté `@parallel` (v0.2.0)
- [x] Créer `templates/dev/tdd-cycle.workflow.md` — `@repeat max:5 until` (v0.2.0)
- [x] Créer `templates/cybersec/vuln-scan.workflow.md` — `@for` + `@if` + `@try` (v0.2.0)
- [x] Enrichir `templates/ess/grant-application.workflow.md` — `@try/@on-error` + `@parallel` (v0.2.0)

### Phase 11 — Documentation & exports

- [x] Mettre à jour `src/index.ts` — `DAGNodeType`, `ExecutionEvent*`, `createEventEmitter`, `createMastraExecutor` exportés
- [x] Mettre à jour `build.config.mjs` — 5 entry points (ajout `mastra-executor`)
- [x] Bump `package.json` version → `0.2.0` + ajout export `./mastra`
- [x] Mettre à jour `ROADMAP.md` — checkboxes + changelog
- [x] Mettre à jour `README.md` — nouvelles directives, roadmap, `@repeat`/`@env`/`@workflow`
- [x] Mettre à jour `AGENTS.md` — v0.2.0 ✅ Complété + métriques

### Vérification finale v0.2.0

- [x] `pnpm typecheck` — 0 erreurs
- [x] `pnpm test` — 141 tests passing (11 fichiers) — objectif dépassé
- [x] `pnpm build` — 5 bundles, 636 kB total (21 fichiers)
- [x] E2E `chainskills inspect workflow.md` — DAG ASCII avec groupes parallèles
- [x] E2E `chainskills list` — 6 workflows trouvés avec métadonnées
- [x] E2E `chainskills validate` — templates v0.2.0 validés
- [x] Core compile sans `@mastra/core` (imports uniquement dans adapters)

---

## Résultats finaux v0.2.0

| Métrique     | Valeur                                                                          |
| ------------ | ------------------------------------------------------------------------------- |
| Tests        | 141/141 passing (11 fichiers)                                                   |
| Typecheck    | 0 erreurs                                                                       |
| Build        | 5 bundles — 636 kB total (index, cli, parser, simple-executor, mastra-executor) |
| Fichiers src | ~50 fichiers TypeScript                                                         |
| Architecture | Hexagonal — core pur, 7 ports, 8 adapters, DI container, Strategy executor      |
| CLI commands | `run`, `validate`, `init`, `inspect`, `list`                                    |
| Templates    | 6 (.workflow.md) — dev ×2, cybersec ×2, osint ×1, ess ×1                        |
| Directives   | 15 types supportés (`@if/@else`, `@for`, `@repeat`, `@try`, `@parallel`, etc.)  |
| Events       | 11 types d'événements typés, streaming temps réel                               |
| DAG          | Auto-parallélisation par analyse de dépendances, détection de cycles            |

---

## v0.2.1 — Security Hardening & Result Monad

### Changements v0.2.1

- [x] **A1**: Shell injection fix — `execSync` → `execFileSync` + allowlist + metachar rejection
- [x] **A2**: Scoped `@env` — frontmatter-declared env vars only
- [x] **A3**: Path traversal fix — `startsWith(normalizedBase)` dans local-resolver
- [x] **A4**: Result monad utilities — `map`, `flatMap`, `mapErr`, `unwrapOr`, `unwrapOrElse`, `match`
- [x] **A5**: Directive handlers — `throw` → `return { error }` (Result pattern)
- [x] **A6**: Architecture fix — `createEventEmitter()` déplacé du port vers `#infra/event-emitter.js`
- [x] **A7**: Dependency pinning — `@mastra/core: "latest"` → `^1.3.0`
- [x] **A8**: README.md — features honnêtes (🔜 Coming), Quick Start from source
- [x] **A9**: `.env.example` enrichi — shell, MCP config
- [x] **A10**: ESM fix — `require()` → `await import()` dans container, `createContainer()` async

### Vérification v0.2.1

- [x] 0 erreurs typecheck
- [x] 141/141 tests passing

---

## v0.3.0-alpha.1 — MCP Server for Copilot

### Décisions actées v0.3.0-alpha

| Décision    | Choix                                                 | Raison                                                   |
| ----------- | ----------------------------------------------------- | -------------------------------------------------------- |
| MCP API     | `McpServer` + `registerTool()` (non-deprecated API)   | Future-proof, Zod inputSchema, annotations support       |
| Tool naming | `chainskills_run`, `chainskills_validate`, etc.       | Snake_case convention MCP, namespace isolation           |
| Transports  | stdio (default) + streamable HTTP                     | stdio pour Copilot, HTTP pour web ; SSE deprecated       |
| SDK API     | `runWorkflow()` + `describeWorkflow()` dans use-cases | Réutilisable par MCP + CLI `--json` + SDK programmatique |
| Config      | `mcpTransport`, `mcpServerName`, `mcpServerVersion`   | Externalisé en env vars, Twelve-Factor compliant         |

### Phase B — Implementation

- [x] **B11**: `src/core/use-cases/run-workflow.ts` — SDK API (`runWorkflow`, `describeWorkflow`)
- [x] **B12**: `--json` flag ajouté à `src/cli/run.ts`
- [x] **B13**: `--json` flag ajouté à `src/cli/validate.ts`
- [x] **B14**: `src/adapters/tools/mcp-server.ts` — MCP server adapter (5 tools, resources, 2 prompts)
- [x] **B15**: `src/cli/serve.ts` — CLI `serve` command (stdio + HTTP transport)
- [x] **B16**: `.vscode/mcp.json` — Copilot auto-discovery
- [x] **B17**: Config MCP fields dans `defaults.ts` et `env.ts`
- [x] **B18**: `tests/mcp/mcp-server.test.ts` — 8 tests (server creation, SDK API, config)

### MCP Tools exposés

| Tool                   | Description                                     | Annotations                             |
| ---------------------- | ----------------------------------------------- | --------------------------------------- |
| `chainskills_run`      | Exécuter un workflow `.workflow.md`             | destructive, non-idempotent, open-world |
| `chainskills_validate` | Valider un workflow sans l'exécuter             | read-only, idempotent                   |
| `chainskills_describe` | Introspection complète (structure, DAG, inputs) | read-only, idempotent                   |
| `chainskills_list`     | Lister les workflows dans un répertoire         | read-only, idempotent                   |
| `chainskills_inspect`  | DAG structure d'un workflow                     | read-only, idempotent                   |

### MCP Prompts exposés

| Prompt             | Description                                |
| ------------------ | ------------------------------------------ |
| `create_workflow`  | Générer un nouveau `.workflow.md`          |
| `explain_workflow` | Analyser et expliquer un workflow existant |

### Vérification v0.3.0-alpha.1

- [x] 0 erreurs typecheck
- [x] 149/149 tests passing (12 fichiers)
- [x] CLI version bumped → `0.3.0`
- [x] `package.json` version → `0.3.0-alpha.1`
- [x] Export `./mcp` ajouté dans `package.json`

---

## Résultats v0.3.0-alpha.1

| Métrique      | Valeur                                                |
| ------------- | ----------------------------------------------------- |
| Tests         | 149/149 passing (12 fichiers)                         |
| Typecheck     | 0 erreurs                                             |
| Fichiers src  | ~55 fichiers TypeScript                               |
| CLI commands  | `run`, `validate`, `init`, `inspect`, `list`, `serve` |
| MCP Tools     | 5 (run, validate, describe, list, inspect)            |
| MCP Prompts   | 2 (create_workflow, explain_workflow)                 |
| MCP Resources | Dynamique (auto-discovery des `.workflow.md`)         |
| Transports    | stdio (Copilot) + streamable HTTP (web)               |

---

## v0.3.0 — @agent LLM Integration & MCP Client

### Décisions actées v0.3.0

| Décision          | Choix                                                     | Raison                                                       |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Agent adapter     | OpenAI-compatible via native `fetch` (no SDK)             | Universel (OpenAI, Anthropic, Ollama, LM Studio, Groq)       |
| Agent port        | `AgentProvider` (invoke, has, list)                       | Découplage total provider/domaine — Strategy pattern         |
| Noop agent        | `createNoopAgent()` pour tests/dry-run                    | Stub deterministic — tests sans API key                      |
| MCP client        | `@modelcontextprotocol/sdk` Client + StdioClientTransport | Standard MCP, lazy connect, auto-discovery des tools         |
| Composite tools   | `createCompositeToolProvider({ shell, mcp })`             | Extensible — ajout SSE, HTTP, custom providers par namespace |
| Config agent      | `AGENT_API_KEY`, `AGENT_BASE_URL`, `AGENT_MODEL` env vars | Twelve-Factor, secret manager-ready                          |
| Config MCP client | `MCP_SERVERS` env var (JSON string)                       | Flexible — multiple servers, no config file needed           |

### Phase C — @agent Directive & LLM Integration

- [x] **C1**: `src/core/ports/agent-provider.port.ts` — AgentProvider interface (invoke, has, list)
- [x] **C2**: `src/adapters/agents/openai-agent.ts` — OpenAI-compatible adapter (native fetch) + NoopAgent
- [x] **C3**: `src/adapters/executor/directive-handlers.ts` — async `handleAgentOrHandoff` with real invocation
- [x] **C4**: `src/adapters/executor/simple-executor.ts` — AgentProvider in deps + executeStep param
- [x] **C5**: `src/adapters/executor/mastra-executor.ts` — AgentProvider in deps
- [x] **C6**: `src/config/container.ts` — Agent wiring (OpenAI or noop based on AGENT_API_KEY)
- [x] **C7**: `.env.example` — AGENT_API_KEY, AGENT_BASE_URL, AGENT_MODEL
- [x] **C8**: Exports — AgentProvider types + adapters in ports/index.ts and src/index.ts
- [x] **C9**: `tests/agent/agent-provider.test.ts` — 15 tests (noop, OpenAI config, network, container)

### Phase D — MCP Client Tool Provider

- [x] **D1**: `src/adapters/tools/mcp-client.ts` — MCP client adapter (lazy connect, StdioClientTransport, tool discovery)
- [x] **D2**: `src/adapters/tools/composite-tool-provider.ts` — Routes @call by namespace (shell/mcp/...)
- [x] **D3**: `src/config/container.ts` — Composite tool provider wiring (shell + optional MCP client from MCP_SERVERS)
- [x] **D4**: `.env.example` — MCP_SERVERS (JSON string)
- [x] **D5**: Exports — createMcpClientProvider, createCompositeToolProvider in src/index.ts
- [x] **D6**: `tests/mcp/mcp-client.test.ts` — 15 tests (composite routing, namespace checks, container integration)

### Agent capabilities

| Feature             | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `@agent <name>`     | Delegate task to named agent (copilot, reviewer, writer) |
| `@handoff <name>`   | Transfer execution to another agent                      |
| `@agent ... → $var` | Capture agent response in variable                       |
| Default agents      | copilot, reviewer, writer (with system prompts)          |
| Custom agents       | Via `AGENT_*` env vars or programmatic config            |
| Variable injection  | Workflow variables injected into agent system prompt     |
| Noop mode           | Stub responses for dry-run/tests (no API key needed)     |

### MCP Client capabilities

| Feature           | Description                             |
| ----------------- | --------------------------------------- |
| `@call mcp.*`     | Call tools on external MCP servers      |
| Lazy connect      | Connect on first call, not at startup   |
| Tool discovery    | Auto-lists tools from connected servers |
| Stdio transport   | Spawn external MCP server as subprocess |
| Composite routing | shell._ → shell, mcp._ → MCP client     |
| Graceful close    | `close()` method for clean shutdown     |

### Vérification v0.3.0

- [x] 0 erreurs typecheck
- [x] 179/179 tests passing (14 fichiers)
- [x] `pnpm build` — 770 kB total (24 fichiers), 5 bundles
- [x] All new exports visible in bundle

---

## Résultats v0.3.0

| Métrique        | Valeur                                                |
| --------------- | ----------------------------------------------------- |
| Tests           | 179/179 passing (14 fichiers)                         |
| Typecheck       | 0 erreurs                                             |
| Build           | 5 bundles — 770 kB total (24 fichiers)                |
| Fichiers src    | ~60 fichiers TypeScript                               |
| CLI commands    | `run`, `validate`, `init`, `inspect`, `list`, `serve` |
| MCP Server      | 5 tools, 2 prompts, dynamic resources                 |
| MCP Client      | Lazy connect, tool discovery, stdio transport         |
| Agent providers | OpenAI-compatible (any LLM) + noop (tests/dry-run)    |
| Tool providers  | Composite (shell + MCP client), extensible            |
| Directives      | 17 types (ajout: `@agent`, `@handoff` real impl)      |
