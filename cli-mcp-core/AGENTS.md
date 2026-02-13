# AGENTS.md — chainskills

> Point d'entrée universel pour tous les agents IA. Indexe l'architecture agentique complète.

## Projet

**chainskills** est un CLI open source TypeScript qui permet de définir, composer, partager et exécuter des workflows d'agents IA écrits en langage naturel (`.workflow.md`). Il combine le modèle de distribution de skills.sh (npm-like registry), le moteur d'orchestration DAG de Mastra, et un format de workflow en Markdown enrichi de directives légères (`@use`, `@call`, `@if`, `@for`). C'est le "shadcn/ui des workflows IA".

| Clé                 | Valeur                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| **Langage**         | TypeScript (strict) — Node.js ≥ 20                                      |
| **CLI framework**   | Citty ^0.2.1                                                            |
| **Orchestration**   | Mastra (DAG : `.then()`, `.parallel()`, `.branch()`, `.foreach()`)       |
| **Parsing**         | unified + remark-parse + remark-directive + gray-matter                  |
| **Interop**         | MCP SDK (Model Context Protocol) — client + server                       |
| **Validation**      | Zod ^3.25                                                                |
| **Tests**           | Vitest ^4.0                                                              |
| **Build**           | obuild ^0.4.22 (Rolldown)                                                |
| **Package manager** | pnpm                                                                     |
| **Architecture**    | Hexagonal (Ports & Adapters) — core pur, zéro dépendance                |
| **License**         | MIT                                                                      |

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

| Directive    | Sémantique                           | Syntaxe                                        |
| ------------ | ------------------------------------ | ---------------------------------------------- |
| `@use`       | Importer un skill, tool, agent       | `@use pdf-processing`                          |
| `@call`      | Appeler un outil avec capture        | `@call tool.method($input) → $output`          |
| `@if/@else`  | Branchement conditionnel             | `@if $score > 50:` ... `@else:`                |
| `@for`       | Itération bornée                     | `@for $item in $list:`                         |
| `@repeat`    | Boucle avec condition d'arrêt        | `@repeat max:5 until $valid == true:`          |
| `@parallel`  | Exécution parallèle                  | `@parallel:`                                   |
| `@try`       | Gestion d'erreurs                    | `@try:` ... `@on-error: log and continue`      |
| `@assert`    | Checkpoint de validation             | `@assert $budget.total == $budget.charges`     |
| `@output`    | Déclarer la sortie du workflow       | `@output: $report, $score`                     |
| `@workflow`  | Sub-workflow inline                  | `@workflow validate-budget:`                   |
| `@env`       | Variable d'environnement             | `@env API_KEY`                                 |
| `@agent`     | Déléguer à un agent                  | `@agent copilot: "Fix this bug"`               |
| `@handoff`   | Transférer à un autre agent          | `@handoff review-agent: "Review the changes"`  |

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

| Skill            | Fonction                                       | Fichier                                 |
| ---------------- | ---------------------------------------------- | --------------------------------------- |
| **smart**        | Auto-apprentissage à partir des échecs         | `.github/skills/smart/SKILL.md`         |
| **smart-commit** | Commits Git groupés, audit sécurité            | `.github/skills/smart-commit/SKILL.md`  |

---

## Prompts

| Prompt           | Usage                              | Fichier                                    |
| ---------------- | ---------------------------------- | ------------------------------------------ |
| **smart-commit** | Commits groupés par feature        | `.github/prompts/smart-commit.prompt.md`   |
| **smart-review** | Revue de code automatisée          | `.github/prompts/smart-review.prompt.md`   |

---

## Instructions Path-Specific

| Pattern       | Fichier                                                                 | Description                        |
| ------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| `src/core/**` | [core.instructions.md](.github/instructions/core.instructions.md)       | Domaine pur, zéro dépendance       |
| `src/cli/**`  | [cli.instructions.md](.github/instructions/cli.instructions.md)         | Conventions CLI Citty               |

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

| Phase | Version | Contenu                                       | Statut      | Date       |
| ----- | ------- | --------------------------------------------- | ----------- | ---------- |
| 1     | v0.1.0  | MVP — Parse + Run séquentiel + CLI + Tests    | ✅ Complété | 2026-02-13 |
| 2     | v0.2.0  | Orchestration DAG (Mastra), `@parallel` réel  | ⏳ Planifié | Q1 2026    |
| 3     | v0.3.0  | MCP client/server, `@agent` LLM, Result monad | ⏳ Planifié | Q2 2026    |
| 4     | v0.4.0  | Registry npm-like, résolution distante/git    | ⏳ Planifié | Q2 2026    |
| 5     | v0.5.0  | Copilot ACP, agents IDE                       | ⏳ Planifié | Q3 2026    |
| 6     | v1.0.0  | Production & Scale (SQLite, Redis, limits)    | ⏳ Planifié | Q4 2026    |

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
