# Roadmap & Implementation Log — chainskills

> Fichier de suivi maintenu automatiquement pendant l'implémentation.

---

## Versions planifiées

| Version | Phase    | Contenu                                                           | Statut      |
| ------- | -------- | ----------------------------------------------------------------- | ----------- |
| v0.1.0  | MVP      | Parse + Run séquentiel + Shell tools + CLI                        | ✅ Complété |
| v0.2.0  | DAG      | Orchestration DAG (Mastra), full control flow, inspect, streaming | 🔄 En cours |
| v0.3.0  | MCP      | MCP client/server, `@agent` LLM, Result monadique                 | ⏳ Planifié |
| v0.4.0  | Registry | npm-like registry, `@use` résolution distante/git                 | ⏳ Planifié |
| v0.5.0  | IDE      | Copilot ACP, agents IDE                                           | ⏳ Planifié |
| v1.0.0  | Prod     | Production & scale (SQLite, Redis, rate limiting)                 | ⏳ Planifié |

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

| Date       | Phase | Action                                    | Fichiers                                          |
| ---------- | ----- | ----------------------------------------- | ------------------------------------------------- |
| 2026-02-13 | 0     | Création du fichier de suivi              | `.github/ROADMAP.md`                              |
| 2026-02-13 | 0-10  | Implémentation MVP complète               | ~40 fichiers src/ + 6 fichiers tests/             |
| 2026-02-13 | 10.5  | Migration imports → `#alias` subpath      | ~25 fichiers mis à jour                           |
| 2026-02-13 | 11    | Tests CLI                                 | `tests/cli/commands.test.ts`                      |
| 2026-02-13 | 12    | Root export + 4 templates                 | `src/index.ts` + `templates/**/*.workflow.md`     |
| 2026-02-13 | 13    | Build, typecheck, E2E, fix build pipeline | `build.config.mjs`, `bin/cli.mjs`, `package.json` |

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

- [ ] Enrichir `DAGNode` — ajouter `type`, `condition`, `iterable`, `children`
- [ ] Implémenter l'analyse de dépendances de variables (`@call → $capture` → consommateurs)
- [ ] Détecter les groupes `@parallel` → nœuds parallèles
- [ ] Détecter les branches `@if/@else` → nœuds `type: 'branch'`
- [ ] Détecter les boucles `@for` / `@repeat` → nœuds `type: 'loop'`
- [ ] Détecter les blocs `@try/@on-error` → nœuds `type: 'try-catch'`
- [ ] Détecter les sub-workflows `@workflow` → nœud composite
- [ ] Détection de cycles → `ValidationError`

### Phase 2 — Parser : support des blocs structurés

- [ ] Enrichir le remark plugin — gérer les `containerDirective` pour `@parallel:`, `@if:`, `@for:`, `@repeat:`, `@try:`, `@workflow:`
- [ ] Peupler `Step.children` — walk récursif des enfants de container
- [ ] Ajouter le parsing `@else` — association au `@if` précédent
- [ ] Parser les arguments `@for` — `variable`, `iterable`, `concurrency` optionnel
- [ ] Parser les arguments `@repeat` — `max`, `until`/`while`

### Phase 3 — SimpleExecutor : enrichir le control flow séquentiel

- [ ] `@if/@else` réel — évaluer condition, exécuter le bon bloc
- [ ] `@for` réel — itérer sur la liste, exécuter enfants par élément
- [ ] `@repeat` réel — boucler avec condition `until`/`while` + compteur `max`
- [ ] `@try/@on-error` réel — wrapper try/catch, exécuter `@on-error` sur erreur
- [ ] `@parallel` séquentiel — marqué parallèle mais exécuté séquentiellement
- [ ] `@workflow` réel — résoudre et exécuter le sub-workflow récursivement
- [ ] Wirer `resolveImports` dans le pipeline CLI (`run.ts`)

### Phase 4 — MastraExecutor : adapter DAG avec orchestration réelle

- [ ] Créer `src/adapters/executor/mastra-executor.ts`
- [ ] Fonction `translateToMastra(dag, workflow)` → DAG chainskills → Mastra workflow
- [ ] Créer les `createStep` dynamiques (schémas lâches, délégation aux handlers)
- [ ] Gestion du state workflow — mapper `StateStore` ↔ Mastra `state`/`setState`
- [ ] Gestion des erreurs + retries — mapper vers modèle Mastra (`bail()`, `retryConfig`)
- [ ] Mode dry-run via Mastra

### Phase 5 — Config : Strategy pattern pour l'executor

- [ ] Enrichir `AppConfig` — `executor: 'simple' | 'mastra'`
- [ ] Ajouter `CHAINSKILLS_EXECUTOR` dans `env.ts`
- [ ] Mettre à jour le DI container — switch `config.executor`
- [ ] Mettre à jour `.env.example`

### Phase 6 — Factorisation : extraire les handlers de directives

- [ ] Créer `src/adapters/executor/directive-handlers.ts` — handlers par type
- [ ] Injecter les handlers dans `SimpleExecutor` et `MastraExecutor`

### Phase 7 — CLI : inspect + streaming + commandes

- [ ] Créer `src/cli/inspect.ts` — DAG ASCII art + `--json`
- [ ] Créer `src/cli/list.ts` — lister les `.workflow.md` locaux
- [ ] Streaming dans `run.ts` — `@clack/prompts` spinners, progression step-by-step
- [ ] Mettre à jour le router CLI — ajouter `inspect`, `list`, bump version `0.2.0`

### Phase 8 — Événements d'exécution (port Observer)

- [ ] Créer `src/core/ports/execution-events.port.ts` — événements typés
- [ ] Adapter observer — `EventEmitter` Node.js dans `src/adapters/executor/`

### Phase 9 — Tests

- [ ] `tests/runtime/build-dag.test.ts` — DAG enrichi, auto-parallélisation, cycles
- [ ] `tests/runtime/control-flow.test.ts` — `@if/@else`, `@for`, `@repeat`, `@try`, `@parallel`, `@workflow`
- [ ] `tests/runtime/mastra-executor.test.ts` — intégration Mastra (parallel, branch, foreach)
- [ ] `tests/parser/container-directives.test.ts` — directives container + `Step.children`
- [ ] Étendre `tests/cli/commands.test.ts` — `inspect`, `list`, streaming events
- [ ] `tests/runtime/execution-events.test.ts` — ordre des events, events parallèles

### Phase 10 — Templates enrichis

- [ ] Mettre à jour `templates/dev/code-review.workflow.md` — ajouter `@parallel`
- [ ] Créer `templates/dev/tdd-cycle.workflow.md` — `@repeat` (red → green → refactor)
- [ ] Créer `templates/cybersec/vuln-scan.workflow.md` — `@for` + `@if` seuil
- [ ] Enrichir `templates/ess/grant-application.workflow.md` — `@try/@on-error` + `@parallel`

### Phase 11 — Documentation & exports

- [ ] Mettre à jour `src/index.ts` — exporter nouveaux types
- [ ] Mettre à jour `build.config.mjs` — éventuelle nouvelle entrée
- [ ] Bump `package.json` version → `0.2.0`
- [ ] Mettre à jour `ROADMAP.md` — checkboxes + changelog
- [ ] Mettre à jour `README.md` — nouvelles directives, mode DAG, `inspect`, streaming

### Vérification finale v0.2.0

- [ ] `pnpm typecheck` — 0 erreurs
- [ ] `pnpm test` — objectif ~140+ tests (vs 86 en v0.1.0)
- [ ] `pnpm build` — build propre
- [ ] E2E `chainskills run ... --dry-run` avec DAG parallèle
- [ ] E2E `chainskills inspect workflow.md` — DAG ASCII
- [ ] E2E `chainskills list` — workflows listés
- [ ] E2E `CHAINSKILLS_EXECUTOR=simple` — fallback séquentiel
- [ ] Core compile sans `@mastra/core` (imports uniquement dans adapters)
