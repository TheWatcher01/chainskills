# Roadmap & Implementation Log — chainskills

> Fichier de suivi maintenu automatiquement pendant l'implémentation.

---

## Versions planifiées

| Version | Phase    | Contenu                                           | Statut      |
| ------- | -------- | ------------------------------------------------- | ----------- |
| v0.1.0  | MVP      | Parse + Run séquentiel + Shell tools + CLI        | ✅ Complété |
| v0.2.0  | DAG      | Orchestration DAG (Mastra), `@parallel` réel      | ⏳ Planifié |
| v0.3.0  | MCP      | MCP client/server, `@agent` LLM, Result monadique | ⏳ Planifié |
| v0.4.0  | Registry | npm-like registry, `@use` résolution distante/git | ⏳ Planifié |
| v0.5.0  | IDE      | Copilot ACP, agents IDE                           | ⏳ Planifié |
| v1.0.0  | Prod     | Production & scale (SQLite, Redis, rate limiting) | ⏳ Planifié |

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
