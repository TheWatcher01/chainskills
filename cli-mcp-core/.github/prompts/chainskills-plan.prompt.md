```prompt
---
name: chainskills-plan
description: Plan complet du framework chainskills — Workflows agentiques en langage naturel
agent: agent
---

# chainskills — Framework de Workflows Agentiques en Langage Naturel

## TL;DR

**chainskills** est un CLI open source TypeScript qui permet de définir, composer, partager et exécuter des workflows d'agents IA écrits en langage naturel (`.workflow.md`). Il combine le modèle de distribution de skills.sh (npm-like registry), le moteur d'orchestration DAG de Mastra, et un format de workflow en Markdown enrichi de directives légères (`@use`, `@call`, `@if`, `@for`). Aucun produit comparable n'existe — c'est le "shadcn/ui des workflows IA".

**Stack** : TypeScript/Node.js ≥20, Citty (CLI), Mastra (orchestration), MCP SDK (outils), Remark (parsing Markdown), Vitest (tests), pnpm.

**Philosophie** : Agnostique (fonctionne avec tout agent IA), modulaire (Hexagonal/Ports & Adapters), data-driven (workflows = données, pas code), CLI-first.

---

## Contexte & Recherche effectuée

### Écosystème actuel

- **skills.sh** (Vercel) : registry + CLI pour installer des skills (SKILL.md = instructions NL). 55k+ installs, 19+ agents supportés. **Limitation** : skills = connaissances passives, pas de workflows exécutables.
- **Mastra** (21k stars, équipe Gatsby) : moteur d'orchestration DAG TypeScript avec `.then()`, `.parallel()`, `.branch()`, `.foreach()`, `.dountil()`. Agents composables, état partagé, suspend/resume. **Limitation** : pas de CLI de composition, pas de registry, pas de format déclaratif.
- **GitHub Copilot CLI** : mode programmatique headless (`copilot -p`), agent handoffs, subagents parallèles, ACP (Agent Client Protocol). **Limitation** : pas de workflow DSL, pas de chaînage de skills, pas d'état persistant entre steps.
- **MCP** (Model Context Protocol) : standard pour connecter agents IA à des outils/data. JSON-RPC sur stdio/HTTP. Production-ready, adopté massivement.
- **A2A** (Agent-to-Agent Protocol, Google/Linux Foundation) : découverte et délégation entre agents. v0.3.0.

### Analyse concurrentielle

Aucun produit ne combine les 5 piliers : (1) CLI-first, (2) skills composables en workflows, (3) orchestration DAG, (4) intégration IDE-agent, (5) registry communautaire. Les plus proches couvrent ~40% chacun :

| Concurrent | Couverture | Forces | Faiblesses |
|---|---|---|---|
| skills.sh | registry + CLI + IDE | Distribution, format, community | Pas de workflows exécutables |
| Mastra | DAG + state + TypeScript | Orchestration mature, suspend/resume | Pas de CLI, pas de registry, pas déclaratif |
| LangGraph | graph stateful mature | Robuste, production-ready | Python-first, pas de registry |
| n8n/Dify/Langflow | GUI workflow builders | Visuels, accessibles | Pas CLI, pas IDE-natif |
| CrewAI/AutoGen | multi-agent | Puissant, flexible | Python-only, pas de registry |

### Faisabilité du format NL

| Approche | Lisibilité | Fiabilité machine | Composabilité |
|---|---|---|---|
| NL pur (vibe coding) | ★★★★★ | 70-80% | Aucune |
| YAML/JSON strict | ★★ | 95%+ | Bonne |
| **NL + directives @ (proposé)** | **★★★★** | **85-90%** | **Excellente** |
| Code pur (DSPy) | ★★★ | 95%+ | Excellente |

---

## Architecture

### Structure du projet

```
chainskills/
├── bin/
│   └── cli.mjs                    # Shim d'entrée avec compile cache
├── src/
│   ├── core/                      # Domaine pur — zéro dépendance externe
│   │   ├── entities/
│   │   │   ├── workflow.ts        # Entité Workflow (name, steps, inputs, outputs)
│   │   │   ├── step.ts            # Entité Step (id, type, description, directives)
│   │   │   ├── directive.ts       # Value Object Directive (@use, @call, @if, @for, etc.)
│   │   │   └── variable.ts        # Value Object Variable ($name, type, value)
│   │   ├── use-cases/
│   │   │   ├── parse-workflow.ts  # Parse .workflow.md → WorkflowIR
│   │   │   ├── build-dag.ts       # WorkflowIR → DAG d'exécution
│   │   │   ├── validate-workflow.ts # Validation sémantique (refs, types, cycles)
│   │   │   └── resolve-imports.ts # Résolution des @use (skills, tools, agents)
│   │   ├── services/
│   │   │   ├── template-engine.ts # Substitution de variables $name
│   │   │   └── condition-parser.ts # Parse des conditions @if
│   │   └── ports/                 # Interfaces abstraites
│   │       ├── workflow-parser.port.ts
│   │       ├── workflow-executor.port.ts
│   │       ├── skill-resolver.port.ts
│   │       ├── tool-provider.port.ts
│   │       ├── workflow-registry.port.ts
│   │       └── state-store.port.ts
│   ├── adapters/                  # Implémentations concrètes
│   │   ├── parser/
│   │   │   ├── remark-workflow-plugin.ts  # Plugin remark custom pour directives @
│   │   │   ├── frontmatter-parser.ts      # gray-matter pour YAML frontmatter
│   │   │   └── markdown-parser.ts         # unified + remark-parse + remark-directive → AST
│   │   ├── executor/
│   │   │   ├── mastra-executor.ts         # Adapter Mastra (createStep/createWorkflow)
│   │   │   └── simple-executor.ts         # Exécuteur séquentiel simple (fallback sans Mastra)
│   │   ├── tools/
│   │   │   ├── mcp-client.adapter.ts      # Client MCP pour appeler des outils
│   │   │   ├── mcp-server.adapter.ts      # Expose workflows comme outils MCP
│   │   │   ├── copilot-acp.adapter.ts     # Bridge vers Copilot CLI via ACP
│   │   │   └── shell.adapter.ts           # Exécution de commandes shell
│   │   ├── skills/
│   │   │   ├── local-resolver.ts          # Résout les skills depuis ~/.agents/skills/
│   │   │   ├── git-resolver.ts            # Résout les skills depuis un repo Git
│   │   │   └── registry-resolver.ts       # Résout depuis le registry chainskills
│   │   ├── state/
│   │   │   ├── memory-store.ts            # État en mémoire (dev/tests)
│   │   │   ├── sqlite-store.ts            # État persistant SQLite (production)
│   │   │   └── redis-store.ts             # État distribué Redis (scale)
│   │   └── registry/
│   │       ├── npm-registry.ts            # Publish/install via npm
│   │       └── git-registry.ts            # Publish/install via Git repos
│   ├── cli/                       # Commandes CLI
│   │   ├── run.ts                 # chainskills run <workflow.md> [--input key=value]
│   │   ├── validate.ts            # chainskills validate <workflow.md>
│   │   ├── list.ts                # chainskills list [--global]
│   │   ├── add.ts                 # chainskills add <source> [--global]
│   │   ├── remove.ts              # chainskills remove <name>
│   │   ├── init.ts                # chainskills init <name> → scaffold .workflow.md
│   │   ├── inspect.ts             # chainskills inspect <workflow.md> → affiche le DAG
│   │   ├── publish.ts             # chainskills publish → publie sur le registry
│   │   └── serve.ts               # chainskills serve → expose comme serveur MCP
│   ├── config/                    # Configuration, DI, bootstrapping
│   │   ├── container.ts           # DI container (injection des adapters)
│   │   ├── env.ts                 # Validation env vars (fail-fast)
│   │   └── defaults.ts            # Valeurs par défaut
│   └── infrastructure/
│       ├── logger.ts              # Logging structuré JSON
│       └── errors.ts              # Types d'erreur domaine (Result pattern)
├── templates/                     # Workflows d'exemple pré-packagés
│   ├── dev/
│   │   ├── code-review.workflow.md
│   │   ├── tdd-cycle.workflow.md
│   │   └── refactor-module.workflow.md
│   ├── cybersec/
│   │   ├── recon-target.workflow.md
│   │   ├── vuln-scan.workflow.md
│   │   └── pentest-report.workflow.md
│   ├── osint/
│   │   ├── person-recon.workflow.md
│   │   ├── domain-recon.workflow.md
│   │   └── social-footprint.workflow.md
│   └── ess/
│       ├── grant-application.workflow.md
│       ├── budget-zero-euro.workflow.md
│       └── multi-funder-dispatch.workflow.md
├── tests/
│   ├── parser/
│   │   ├── frontmatter.test.ts
│   │   ├── directives.test.ts
│   │   └── workflow-builder.test.ts
│   ├── runtime/
│   │   ├── step-execution.test.ts
│   │   └── workflow-run.test.ts
│   ├── mcp/
│   │   ├── client.test.ts
│   │   └── server.test.ts
│   └── cli/
│       └── commands.test.ts
├── .env.example
├── .gitignore
├── build.config.mjs
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vitest.config.ts
├── LICENSE
└── README.md
```

---

## Format `.workflow.md` — Spécification

### Frontmatter YAML (obligatoire)

```yaml
---
name: string                    # 1-64 chars, kebab-case
description: string             # Description courte (1-1024 chars)
version: string                 # Semver
inputs:                         # Schema des entrées (Zod-compatible)
  param_name: type              # Types: string, number, boolean, list, object
outputs:                        # Schema des sorties
  result_name: type
env:                            # Variables d'environnement requises
  - API_KEY
  - DATABASE_URL
tags: [dev, cybersec, osint]    # Catégories pour le registry
metadata:
  author: string
  license: MIT
  min-chainskills: "0.1.0"
---
```

### Directives @ — Vocabulaire contrôlé

| Directive | Sémantique | Syntaxe |
|---|---|---|
| `@use` | Importer un skill, tool, agent, ou sub-workflow | `@use pdf-processing` `@use mcp://github` `@use ./sub-workflow.workflow.md` |
| `@call` | Appeler un outil/skill/agent avec capture de résultat | `@call tool.method($input) → $output` |
| `@if` / `@else` | Branchement conditionnel | `@if $score > 50:` ... `@else:` ... |
| `@for` | Itération bornée | `@for $item in $list:` |
| `@repeat` | Boucle avec condition d'arrêt | `@repeat max:5 until $valid == true:` |
| `@parallel` | Exécution parallèle des steps enfants | `@parallel:` |
| `@try` / `@on-error` | Gestion d'erreurs | `@try:` ... `@on-error: log and continue` |
| `@assert` | Checkpoint de validation | `@assert $budget.total == $budget.charges` |
| `@output` | Déclarer la sortie du workflow | `@output: $report, $score` |
| `@workflow` | Définir un sub-workflow inline | `@workflow validate-budget:` |
| `@env` | Référencer une variable d'environnement | `@env API_KEY` |
| `@agent` | Déléguer à un agent spécifique | `@agent copilot: "Fix this bug"` |
| `@handoff` | Transférer à un autre agent (Copilot handoff) | `@handoff review-agent: "Review the changes"` |

### Exemple — Code Review Pipeline

```markdown
---
name: code-review-pipeline
description: >
  Pipeline de code review automatisé : lint, tests, sécurité,
  puis génération d'un rapport consolidé.
version: "1.0.0"
inputs:
  repo_path: string
  branch: string
outputs:
  report: string
  passed: boolean
env:
  - GITHUB_TOKEN
tags: [dev, code-review, ci]
metadata:
  author: chainskills
  license: MIT
---

@use eslint-analyzer
@use security-scanner
@use test-runner
@use report-generator
@env GITHUB_TOKEN

# Step 1 — Analyser les changements

Récupère la liste des fichiers modifiés entre la branche
principale et $branch dans le repo $repo_path.

@call git.diff($repo_path, "main", $branch) → $changed_files
@assert $changed_files.length > 0

# Step 2 — Exécuter les checks en parallèle

@parallel:

  ## 2a — Lint
  @call eslint-analyzer.check($changed_files) → $lint_results

  ## 2b — Tests unitaires
  @call test-runner.run($repo_path, coverage: true) → $test_results

  ## 2c — Scan de sécurité
  @call security-scanner.scan($changed_files) → $security_results

# Step 3 — Évaluer les résultats

@if $security_results.critical_count > 0:
  $passed = false
  Log: "BLOQUANT — $security_results.critical_count vulnérabilités critiques"
@else:
  @if $lint_results.error_count == 0 && $test_results.passed:
    $passed = true
  @else:
    $passed = false

# Step 4 — Générer le rapport

@call report-generator.create(
  lint: $lint_results,
  tests: $test_results,
  security: $security_results,
  verdict: $passed
) → $report

@output: $report, $passed
```

### Exemple — OSINT Domain Recon

```markdown
---
name: domain-recon
description: Reconnaissance complète d'un domaine cible.
version: "1.0.0"
inputs:
  target_domain: string
outputs:
  recon_report: string
tags: [osint, recon]
---

@use whois-lookup
@use dns-enum
@use subdomain-finder
@use port-scanner
@use web-tech-detector

# Step 1 — WHOIS

@call whois-lookup.query($target_domain) → $whois

# Step 2 — Énumération parallèle

@parallel:

  ## DNS Records
  @call dns-enum.all_records($target_domain) → $dns

  ## Sous-domaines
  @call subdomain-finder.enumerate($target_domain) → $subdomains

  ## Technologies web
  @call web-tech-detector.detect("https://$target_domain") → $tech_stack

# Step 3 — Scan des ports (sur chaque sous-domaine)

@for $sub in $subdomains:
  @try:
    @call port-scanner.top100($sub) → $ports
    Append {subdomain: $sub, ports: $ports} to $port_results
  @on-error:
    Log: "Timeout on $sub — skipping"
    Continue

# Step 4 — Consolidation

@call report-generator.create(
  whois: $whois, dns: $dns,
  subdomains: $subdomains,
  tech: $tech_stack, ports: $port_results
) → $recon_report

@output: $recon_report
```

---

## Commandes CLI

```bash
# Exécution
chainskills run workflow.md --input target_domain=example.com
chainskills run workflow.md --input-file params.json
chainskills run workflow.md --dry-run              # Affiche le plan sans exécuter

# Validation
chainskills validate workflow.md                   # Vérifie syntaxe + dépendances
chainskills inspect workflow.md                    # Affiche le DAG visuel en ASCII

# Gestion des workflows
chainskills init my-workflow                       # Scaffold un .workflow.md
chainskills list                                   # Liste les workflows du projet
chainskills list -g                                # Liste les workflows globaux

# Registry (install/publish)
chainskills add owner/repo                         # Install depuis Git
chainskills add owner/repo@workflow-name           # Install un workflow spécifique
chainskills add owner/repo -g                      # Install global
chainskills publish                                # Publie sur le registry
chainskills find [query]                           # Recherche dans le registry

# Interopérabilité
chainskills serve                                  # Expose les workflows comme serveur MCP
chainskills serve --port 3001                      # MCP sur HTTP
```

---

## Stack technique

| Couche | Package | Rôle |
|---|---|---|
| CLI framework | `citty` ^0.2.1 | Routing commandes, auto-help |
| Prompts interactifs | `@clack/prompts` ^0.11 | Spinners, selects, confirms |
| Couleurs terminal | `picocolors` ^1.1 | Formatage console |
| Frontmatter | `gray-matter` ^4.0.3 | Parse YAML frontmatter |
| Markdown AST | `unified` + `remark-parse` ^11 | Markdown → MDAST |
| Directives custom | `remark-directive` ^4.0 | Support directives @ |
| Traversée AST | `unist-util-visit` ^5 | Walk/transform AST nodes |
| Orchestration DAG | `@mastra/core` latest | createStep, createWorkflow, parallel, branch |
| MCP client/server | `@modelcontextprotocol/sdk` ^1.26 | Appels outils + exposition workflows |
| Schemas | `zod` ^3.25 | Validation typée inputs/outputs |
| Bundler | `obuild` ^0.4.22 | Bundle TypeScript (Rolldown) |
| Tests | `vitest` ^4.0 | Unit + integration tests |
| Formatting | `prettier` ^3.8 | Code formatting |
| TypeScript | `typescript` ^5.9 | Type checking |

---

## Steps d'implémentation

### Phase 1 — MVP (v0.1.0) : Parse + Run séquentiel

1. **Initialiser le repo** : `pnpm init`, `tsconfig.json`, `build.config.mjs`, `.gitignore`, `.env.example`
2. **Entités core** : `Workflow`, `Step`, `Directive`, `Variable` — classes pures, zéro dépendance
3. **Port `WorkflowParser`** : interface abstraite `parse(source: string) → WorkflowIR`
4. **Adapter parser** : `gray-matter` + `unified` + `remark-parse` + plugin custom pour directives `@`
5. **Port `WorkflowExecutor`** : interface abstraite `execute(workflow: WorkflowIR, inputs: Record) → Result`
6. **Adapter simple-executor** : exécute les steps séquentiellement, substitue les `$variables`, log les résultats
7. **CLI commandes** : `chainskills run`, `chainskills validate`, `chainskills init`
8. **Tests** : parser (frontmatter, directives, variables), exécution séquentielle simple
9. **README.md** : objectif, install, usage, .env.example, commandes, roadmap

### Phase 2 — Orchestration DAG (v0.2.0)

10. **Adapter Mastra** : transformer WorkflowIR → `createStep()` + `createWorkflow()` avec `.then()`, `.parallel()`, `.branch()`
11. **Support `@parallel`** : détection des blocs parallèles dans l'AST → `.parallel([stepA, stepB])`
12. **Support `@if`/`@else`** : condition parser → `.branch([{ when, then }])`
13. **Support `@for`** : itération bornée → `.foreach(step)`
14. **Support `@repeat`** : boucle avec condition → `.dountil(step, { when })`
15. **État partagé** : `stateSchema` Zod-typé, `setState()` entre steps
16. **Tests** : DAG avec branches, parallélisme, boucles

### Phase 3 — Intégration MCP + Skills (v0.3.0)

17. **Adapter MCP client** : `@call tool.method()` → appel MCP `client.callTool()`
18. **Résolveur de skills** : `@use skill-name` → cherche dans `~/.agents/skills/`, charge le SKILL.md comme contexte
19. **Support `@agent`** : délégation à un agent IA via Vercel AI SDK
20. **Support `@env`** : injection typée des variables d'environnement
21. **`chainskills serve`** : expose les workflows comme serveur MCP (chaque workflow = un tool)
22. **Tests** : appels MCP mockés, résolution de skills, exposition MCP

### Phase 4 — Registry & Distribution (v0.4.0)

23. **`chainskills add`** : installer un workflow depuis un repo Git (clone → copie dans `~/.chainskills/workflows/`)
24. **`chainskills list`** : lister workflows locaux et globaux
25. **`chainskills find`** : recherche dans le registry
26. **`chainskills publish`** : publie le workflow courant
27. **Lock file** : `~/.chainskills/.workflow-lock.json` (même format que skills.sh)
28. **Workflow templates** : 3-4 workflows pré-packagés (code-review, domain-recon, grant-application)

### Phase 5 — Copilot + Agents IDE (v0.5.0)

29. **Adapter Copilot ACP** : `@handoff agent-name: "prompt"` → utilise ACP pour déléguer
30. **Adapter subagents** : `@agent copilot: "task"` → `copilot -p "task" --allow-all-tools`
31. **Fichier `.agent.md` auto-généré** : `chainskills agent` génère un custom agent Copilot qui orchestre le workflow
32. **Support multi-agent** : GitHub Copilot, Claude Code, Cursor (via MCP)

### Phase 6 — Production & Scale (v1.0.0)

33. **State backends** : SQLite adapter (durabilité locale), Redis adapter (distribué)
34. **Inngest integration** : déploiement durable des workflows longs
35. **Observabilité** : logging structuré JSON, traces, métriques d'exécution
36. **Suspend/resume** : human-in-the-loop pour les steps nécessitant approbation
37. **Visual inspector** : `chainskills inspect` affiche le DAG en ASCII art + stats

### Roadmap future (post-v1.0)

38. **Runtimes multi-langages** : Go CLI, Python CLI (portabilité)
39. **Web UI** : dashboard de monitoring des workflows en cours
40. **Marketplace web** : https://chainskills.dev avec leaderboard (comme skills.sh)
41. **VS Code extension** : exécution et monitoring directement dans l'IDE
42. **AI workflow optimizer** : analyse les .workflow.md et suggère des optimisations (parallélisme, caching)

---

## Décisions architecturales

| Décision | Choix | Raison |
|---|---|---|
| CLI framework | **Citty** over Commander.js | Zéro dépendances, natif `parseArgs`, aligné UnJS |
| Bundler | **obuild** over tsup | tsup déprécié, obuild utilise Rolldown (même que skills.sh) |
| Orchestration | **Mastra** over LangGraph | TypeScript-native, API intuitive (`.then()/.parallel()`), v1.0 GA |
| Parsing | **Remark directives** over custom regex | Standard CommonMark proposition, AST propre, extensible |
| Directive prefix | **`@`** over `::` | Plus lisible en NL, évoque annotations Java/Python |
| Format workflow | **`.workflow.md`** over `.yaml` | Lisible humains ET agents, versionnable, diffable |
| Architecture | **Hexagonal** | Core pur sans dépendances → testable sans DB/serveur/framework |
| Formatcompat | **skills.sh** | Mêmes conventions (YAML frontmatter, kebab-case, `~/.agents/`) |

---

## Vérification

| Quoi | Comment |
|---|---|
| Parser fonctionne | `vitest run tests/parser/` — parse les exemples .workflow.md → WorkflowIR correct |
| Exécution séquentielle | `chainskills run templates/dev/code-review.workflow.md --dry-run` |
| DAG correct | `chainskills inspect templates/dev/code-review.workflow.md` → affiche le graphe |
| MCP fonctionne | `chainskills serve` puis appeler via MCP client → workflow s'exécute |
| Registry fonctionne | `chainskills add chainskills/templates@code-review` → installe le workflow |
| Build | `pnpm build` → `dist/` sans erreurs |
| Tests | `pnpm test` → 100% passent |
| Lint | `pnpm lint` → 0 erreurs |
| npx | `npx chainskills run workflow.md` → fonctionne sans install |

```
