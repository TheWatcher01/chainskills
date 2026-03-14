# Plan d'implémentation SOTA — ChainSkills v0.7.0 → v1.x

> Document de planification basé sur l'audit complet du codebase (mars 2026)
> et la recherche SOTA couvrant 2024–2026.
>
> **Objectif :** Documenter exhaustivement ce qui existe, ce qui manque, et le plan
> d'implémentation pour chaque bloc (A–E) du brainstorming.

---

## Table des matières

- [0. Audit du codebase existant](#0-audit-du-codebase-existant)
- [BLOC A — Mastra DAG : exploitation des capacités sous-utilisées](#bloc-a--mastra-dag)
- [BLOC B — WorkflowGraph : entité domaine centrale](#bloc-b--workflowgraph)
- [BLOC C — Context Translator & Token Optimizer](#bloc-c--context-translator--token-optimizer)
- [BLOC D — ExecutionMemory & PatternRetriever](#bloc-d--executionmemory--patternretriever)
- [BLOC E — Hybridation ML / Neuro-Symbolique](#bloc-e--hybridation-ml--neuro-symbolique)
- [Priorisation & Séquencement](#priorisation--séquencement)
- [Annexe — Références SOTA](#annexe--références-sota)

---

## 0. Audit du codebase existant

### 0.1 État actuel (v0.6.0 / CLI v0.7.0)

| Composant | État | Fichiers clés |
|-----------|------|---------------|
| **Architecture hexagonale** | ✅ Complète | `core/entities/`, `core/ports/`, `core/services/`, `core/use-cases/`, `adapters/` |
| **Result<T,E> Monad** | ✅ Partout | `infrastructure/errors.ts` — `ok()`, `err()`, jamais de throw business |
| **21 directives** | ✅ Toutes implémentées | `core/entities/directive.ts` — use, call, if, else, for, repeat, parallel, try, on-error, assert, breakpoint, output, workflow, env, agent, handoff, validate, snapshot, restore, reflect, team, vote |
| **DAG Builder** | ✅ Complet | `core/use-cases/build-dag.ts` — analyse de variables, auto-parallélisation, détection de cycles |
| **Mastra Executor** | ✅ Fonctionnel | `adapters/executor/mastra-executor.ts` — .then(), .parallel() utilisés |
| **Simple Executor** | ✅ Fonctionnel | `adapters/executor/simple-executor.ts` — fallback sans Mastra |
| **Directive Handlers** | ✅ 21 handlers | `adapters/executor/directive-handlers.ts` — ~1300 lignes, toutes directives |
| **Execution Events** | ✅ 16 types | `core/ports/execution-events.port.ts` — workflow, step, directive, parallel, loop, snapshot, reflection, validation, error |
| **SQLite Persistence** | ✅ Schéma v1 | `adapters/state/sqlite-persistence.ts` — tables: runs, run_events, snapshots, learned_rules |
| **Run History** | ✅ Complet | `adapters/state/sqlite-run-history.ts` — startRun, endRun, recordEvent, listRuns, getSuccessRate |
| **Snapshot Manager** | ✅ Complet | `adapters/state/sqlite-snapshot-manager.ts` — save, load, loadByLabel, listByRun |
| **Rules Store** | ✅ Complet | `adapters/state/sqlite-rules-store.ts` — addRule, getRulesForWorkflow, getGlobalRules, recordHit |
| **Reflection Engine** | ✅ Fonctionnel | `core/services/reflection-engine.ts` — analyse via AgentProvider, génère des ReflectionRule |
| **Rules Applicator** | ✅ Fonctionnel | `core/services/rules-applicator.ts` — formatRulesAsContext, getApplicableRules |
| **CLI Commands** | ✅ 11 commandes | run, validate, init, inspect, list, serve, certify, history, replay, snapshot, rules |
| **MCP Server** | ✅ Complet | `adapters/tools/mcp-server.ts` — 5 tools + 2 prompts |
| **MCP Client** | ✅ Complet | `adapters/tools/mcp-client.ts` — connexion à serveurs MCP externes |
| **Agent Provider** | ✅ OpenAI | `adapters/agents/openai-agent.ts` + `agent-pool.ts` |
| **VSCode Extension** | ✅ v0.5.0 | 8 providers (CodeLens, Completion, Hover, Diagnostics, Folding, Link, Symbol, FileDecoration) |
| **Tests** | ✅ 197 tests / 32 fichiers | Unit + integration, compatible ESM |

### 0.2 Ce qui N'EXISTE PAS encore (delta avec le brainstorming)

| Composant proposé | Statut | Détail |
|-------------------|--------|--------|
| **@retry directive** | ❌ Absent | Pas de directive retry avec backoff configurable |
| **@suspend directive** | ❌ Absent | @breakpoint existe (pause debug) mais pas de suspend/resume Mastra natif |
| **@dountil directive** | ❌ Absent | @repeat couvre while/until mais pas le mapping Mastra .dountil() |
| **@map directive** | ❌ Absent | Aucun équivalent de .map() Mastra |
| **@use import fichier externe** | ⚠️ Partiel | @use existe pour skills locaux, pas pour import de .workflow.md complet |
| **WorkflowGraph entité unifiée** | ❌ Absent | Le DAG existe (`DAG` + `DAGNode`) mais pas l'entité `WorkflowGraph` canonique avec metadata |
| **Multi-renderers** | ⚠️ Partiel | ASCII renderer dans `cli/inspect.ts` + JSON output. Pas de Mermaid, Cytoscape, ReactFlow, TOON |
| **DAG WebView VSCode** | ❌ Absent | Roadmap v0.6.0 mais pas encore implémenté |
| **IContextTranslator** | ❌ Absent | Aucun port de traduction de contexte |
| **AgentContext injection** | ❌ Absent | Les agents ne reçoivent pas leur position dans le DAG |
| **TOON format** | ❌ Absent | Aucun support du format token-optimized |
| **TokenOptimizer pipeline** | ❌ Absent | Pas de ComplexityClassifier, ContextCompressor, HistoryTrimmer, ModelRouter |
| **ExecutionMemory** | ⚠️ Embryonnaire | Run history + snapshots + rules existent dans SQLite, mais pas d'ExecutionTrace enrichie avec stdout/stderr |
| **PatternMiner** | ❌ Absent | Pas de TF-IDF, clustering, Apriori, anomaly detection |
| **PatternRetriever** | ❌ Absent | Pas d'agrégateur central avec scoring ML |
| **SkillRefiner** | ❌ Absent | Pas d'auto-amélioration des workflows |
| **OutputValidationPipeline** | ⚠️ Partiel | @validate + @assert existent, mais pas ConsistencyScorer, SemanticEntropyDetector, HistoricalAnomalyML |
| **ClassicalMLRouter** | ❌ Absent | Pas de routing ML entre modèles |
| **WorkflowOptimizer MCTS** | ❌ Absent | Pas d'optimisation automatique de workflows |
| **Streaming --stream** | ⚠️ Partiel | Events en temps réel existent via emitter, mais pas de barre de progression par step ni SSE |
| **chainskills resume** | ❌ Absent | Pas de commande CLI resume |
| **chainskills inspect --run-id** | ❌ Absent | Inspect est statique (fichier), pas de vue d'un run suspendu |
| **OpenTelemetry export** | ❌ Absent | Logger JSON structuré existe, mais pas d'export OTel |

### 0.3 Stack technique confirmée

| Composant | Version actuelle | Version SOTA | Rôle |
|-----------|-----------------|--------------|------|
| TypeScript | ^5.9.0 (strict) | — | Typage sûr, inférence avancée |
| Node.js | >=20 | **≥22.13.0** (requis par Mastra v1.x) | ESM natif, performance V8 |
| pnpm | ^10.17.1 | — | Monorepo workspaces, déduplication |
| @mastra/core | **^1.3.0** | **v1.10.0** (mars 2026) | Orchestration workflows graph-based |
| @modelcontextprotocol/sdk | ^1.26.0 | — | Protocole standard outil-agent |
| Zod | ^3.25.0 | — | Schémas runtime + TypeScript inféré |
| Vitest | ^4.0.0 | — | Unit + intégration, compatible ESM |
| obuild (Rolldown) | ^0.4.22 | — | Bundling Rust-based ultra-rapide |
| better-sqlite3 | ^12.6.2 | — | Persistence SQLite synchrone |
| citty | ^0.2.1 | — | CLI framework |

> **ALERTE MIGRATION :** @mastra/core v1.0.0 (20 jan 2026) a introduit des **breaking changes** :
> les imports top-level depuis `@mastra/core` ne sont plus autorisés (sauf `Mastra` et `Config`).
> Il faut utiliser les subpath imports (`@mastra/core/workflows`, etc.).
> Le projet utilise actuellement `^1.3.0` mais la version actuelle est **v1.10.0**.
> Node.js minimum requis par Mastra v1.x est **22.13.0** (le projet spécifie >=20).
> **Action requise :** Mettre à jour `engines.node` et vérifier la compatibilité des imports.

---

## BLOC A — Mastra DAG : exploitation des capacités sous-utilisées

### A1. Mapping complet des patterns de contrôle

**État actuel :** Le `MastraExecutor` utilise `.then()` et `.parallel()` uniquement. Le `DAGBuilder` produit un `DAG` avec `parallelGroups` qui sont traduits en `.then()` (1 step) ou `.parallel()` (N steps). Les patterns `.branch()`, `.dowhile()`, `.dountil()`, `.foreach()` de Mastra ne sont **pas utilisés directement** — le contrôle de flux est géré dans `directive-handlers.ts` au niveau step, pas au niveau Mastra workflow.

**Recherche SOTA (mars 2026) :** Mastra **v1.10.0** (Apache 2.0) offre 7 méthodes de contrôle de flux, toutes confirmées :
- `.then(step)` — séquentiel ✅ utilisé
- `.parallel([steps])` — parallèle ✅ utilisé — output keyed par step ID
- `.branch(conditions[])` — conditionnel ❌ non utilisé — array de `[conditionFn, step]` tuples, premier match exécuté
- `.dowhile(step, conditionFn)` — boucle while ❌ non utilisé — condition async reçoit `{ inputData }`
- `.dountil(step, conditionFn)` — boucle until ❌ non utilisé — répète jusqu'à condition true
- `.foreach(step, { concurrency?: N })` — itération ❌ non utilisé — output = array matching input length
- `.map(transformerFn)` — transformation ❌ absent — helpers `getStepResult()`, `getInitData()`, `mapVariable()`

**Règle de chaînage Mastra :** chaque `outputSchema` doit matcher l'`inputSchema` suivant, ou utiliser `.map()` pour le bridging.
Le projet utilise actuellement un `DynamicSchema = z.record(z.unknown())` universel, ce qui contourne cette contrainte.

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| A1.1 Auditer les capacités Mastra v1.3+ non exploitées | P1 | S | — |
| A1.2 Enrichir `MastraExecutor.translateAndExecute()` pour utiliser `.branch()` | P2 | M | A1.1 |
| A1.3 Mapper `.dowhile()` / `.dountil()` pour @repeat directives | P2 | M | A1.1 |
| A1.4 Mapper `.foreach()` pour @for directives avec option concurrency | P2 | M | A1.1 |
| A1.5 Créer directive `@dountil` (mapping vers Mastra `.dountil()`) | P3 | S | A1.3 |
| A1.6 Créer directive `@map` (transformation de données inline) | P3 | M | A1.1 |
| A1.7 Ajouter `DirectiveType` pour `'retry'`, `'suspend'`, `'dountil'`, `'map'` dans `directive.ts` | P2 | S | — |

**Fichiers impactés :**
- `core/entities/directive.ts` — ajout des nouveaux DirectiveType
- `adapters/executor/mastra-executor.ts` — enrichir translateAndExecute
- `adapters/executor/directive-handlers.ts` — ajout handlers retry, suspend, dountil, map
- `adapters/parser/remark-workflow-plugin.ts` — parsing des nouvelles syntaxes

### A2. Retry & Error Handling configurable

**État actuel :** `@try` / `@on-error` existent et fonctionnent. Pas de retry automatique avec backoff. Le error handling est binaire : succès ou fallback.

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| A2.1 Créer directive `@retry` avec params `max`, `backoff`, `delay` | P1 | M | A1.7 |
| A2.2 Parser la syntaxe `@retry max:3 backoff:exponential delay:500ms:` | P1 | M | A2.1 |
| A2.3 Implémenter `handleRetry()` dans directive-handlers avec backoff | P1 | M | A2.2 |
| A2.4 Intégrer avec le retry natif Mastra si disponible | P2 | M | A2.3, A1.1 |
| A2.5 Ajouter `retry:` dans frontmatter comme configuration par défaut | P3 | S | A2.3 |

**Syntaxe cible :**
```markdown
@retry max:3 backoff:exponential delay:500ms:
  @call flaky-api.call($input) → $result
  @on-error:
    @call fallback.call($input) → $result
```

### A3. Suspend / Resume — Human-in-the-Loop

**État actuel :** `@breakpoint` existe comme pause conditionnelle de debug. Le `MastraExecutionController` implémente `pause()/resume()/cancel()` mais c'est une abstraction ChainSkills, pas le suspend/resume natif de Mastra.

**Recherche SOTA (Mastra v1.10.0) :** Le suspend/resume natif est très complet :
- `suspend(payload)` dans `execute()` d'un step — persiste l'état automatiquement
- Steps peuvent déclarer `resumeSchema` et `suspendSchema` (Zod) pour typer les données suspend/resume
- `run.resume({ resumeData, step })` pour reprendre — `step` optionnel si un seul step suspendu
- Streaming : `closeOnSuspend` ferme le stream automatiquement, `resumeStream()` le reprend
- `suspendData` disponible automatiquement dans execute lors de la reprise
- Compatible multi-requêtes via `createRun({ runId })` pour reprendre un run existant

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| A3.1 Créer directive `@suspend` avec label et persistance d'état | P2 | L | A1.7 |
| A3.2 Connecter au `suspend()` natif de Mastra pour persistance automatique | P2 | L | A3.1 |
| A3.3 Créer commande CLI `chainskills resume <runId> --data '{}'` | P2 | M | A3.2 |
| A3.4 Enrichir schéma SQLite pour stocker l'état suspendu d'un workflow | P2 | M | A3.1 |
| A3.5 Émettre events `step:suspended` et `workflow:resumed` | P3 | S | A3.1 |
| A3.6 Ajouter indicateur visuel dans VSCode pour les runs suspendus | P3 | M | A3.5 |

**Syntaxe cible :**
```markdown
@suspend label:"awaiting-approval"
```

### A4. Workflow as Step — Import de fichier externe

**État actuel :** `@use` résout des skills locaux via `SkillResolver`. `@workflow` permet des sous-workflows inline. `resolve-imports.ts` existe comme use-case. Mais l'import d'un `.workflow.md` externe comme step n'est pas implémenté.

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| A4.1 Enrichir `@use` pour supporter `@use ./path/to.workflow.md as alias` | P2 | M | — |
| A4.2 Implémenter la résolution de fichier dans `resolve-imports.ts` | P2 | M | A4.1 |
| A4.3 Créer un step Mastra depuis un workflow importé (workflow-as-step) | P2 | L | A4.2 |
| A4.4 Supporter résolution Git `@use github:org/repo/path.workflow.md as alias` | P3 | L | A4.2, v0.8.0 |

**Syntaxe cible :**
```markdown
@use ./shared/security-check.workflow.md as security-check
@call security-check($target) → $sec_result
```

### A5. Streaming & Observabilité temps réel

**État actuel :** Le système d'events (`ExecutionEventEmitter`) est complet avec 16 types d'events ChainSkills. La CLI affiche les events en temps réel. Mais pas de barre de progression ni de SSE.

**Recherche SOTA (Mastra v1.10.0) :** Mastra offre un streaming natif riche :
- `run.stream()` retourne un `WorkflowRunOutput` (async iterable via `for await...of`)
- Chaque step reçoit un `writer` dans `execute()` pour pousser des events custom dans le stream
- `run.watch(callback)` pour observer un run en temps réel (two flavors: `watch` et `watch-v2`)
- Events Mastra : `start`, `step-start`, `text-delta`, `tool-call`, `tool-result`, `step-finish`, `finish`, `workflow-start`, `workflow-step-start`, `workflow-step-progress`
- API expérimentale `streamVNext` avec `MastraWorkflowStream` (extends `ReadableStream`)
- Observe pattern : clients peuvent se connecter à un stream en cours et recevoir tous les events depuis le début

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| A5.1 Ajouter `--stream` à la CLI avec barre de progression par step | P2 | M | — |
| A5.2 Mapper les 11 events Mastra vers les 16 events ChainSkills | P3 | M | A1.1 |
| A5.3 MCP tool `workflow_stream` avec Server-Sent Events | P3 | L | A5.2 |
| A5.4 Directive `@on-event step-complete: @call webhook.notify($event)` | P3 | L | A5.2 |

### A6. Step Creation enrichi — Types Mastra

**État actuel :** Tous les steps sont créés via `createStep()` avec `DynamicSchema = z.record(z.unknown())`. L'AgentProvider est invoqué via `handleAgent()` dans les directive-handlers, pas via un step Mastra natif Agent.

**Recherche SOTA (Mastra v1.10.0) :** Mastra supporte 3 patterns de création de step :
1. Custom `execute` function (c'est ce que ChainSkills utilise)
2. `createStep(agent)` → auto `{ prompt: string }` input, `{ text: string }` output
3. `createStep(agent, { structuredOutput: { schema } })` → output Zod-typé
4. Les **Processors** (ToolCallFilter, TokenLimiterProcessor) transforment les messages avant le LLM — ce ne sont pas des steps de workflow

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| A6.1 Supporter `@call agent:name($input) schema:Schema → $result` | P3 | M | — |
| A6.2 Supporter `@call processor:name($input) → $result` pour transformations pures | P3 | M | — |
| A6.3 Utiliser les types de step Mastra natifs (Agent step, Tool step) quand applicable | P3 | L | A1.1 |

### A7. Persistance des runs & historique

**État actuel :** ✅ **Déjà largement implémenté.**
- `sqlite-run-history.ts` : startRun, endRun, recordEvent, getRun, listRuns, getEvents, getSuccessRate
- `sqlite-snapshot-manager.ts` : save, load, loadByLabel, listByRun
- CLI `history` : liste des runs, détails, events, filtres
- CLI `replay` : rejeu d'un run historique
- CLI `snapshot` : gestion des snapshots

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| A7.1 Ajouter `totalTokens` et `totalCost` aux runs (si agent utilisé) | P3 | S | — |
| A7.2 `chainskills inspect --run-id <id>` pour inspecter un run passé/suspendu | P2 | M | A3.4 |
| A7.3 Ajouter durée par step dans le run_events | P3 | S | — |
| A7.4 Évaluer la migration vers Mastra Storage natif (LibSQL/Postgres) | P3 | L | A0 |

**Note sur Mastra Storage :** Mastra v1.10.0 supporte 10+ backends de stockage via `MastraCompositeStore`
(LibSQL, PostgreSQL, MongoDB, Upstash, CloudflareKV, D1, DynamoDB, MSSQL, LanceDB, ClickHouse).
ChainSkills utilise actuellement better-sqlite3 directement. La migration vers Mastra Storage
permettrait de bénéficier du storage pluggable sans code custom, mais ajouterait un couplage fort
avec Mastra. **Recommandation :** conserver better-sqlite3 pour le storage ChainSkills (runs, rules, patterns)
et utiliser Mastra Storage uniquement pour l'état de workflow Mastra natif (suspend/resume).

### A8. Observabilité avancée

**État actuel :** Logger JSON structuré existe (`infrastructure/logger.ts`). Events en temps réel via emitter. Pas d'export OpenTelemetry.

**Recherche SOTA (Mastra v1.10.0) :** Mastra a un système **AI Tracing** natif (`@mastra/core/ai-tracing`) qui capture token usage, model params, tool execution, conversation flows. Exporteurs pluggables :
- `@mastra/otel-exporter` → OTLP (Datadog, New Relic, SigNoz, Jaeger, MLflow, Dash0, Traceloop, Laminar)
- Exporteurs dédiés : Langfuse, Braintrust, LangSmith
- ClickHouse recommandé pour production
- Configuration via `observability: { serviceName, exporters[] }` sur le constructeur Mastra

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| A8.1 Enrichir le logger avec niveaux structurés par step | P3 | S | — |
| A8.2 Exploiter le AI Tracing natif de Mastra via config `observability` | P2 | M | A0 |
| A8.3 `chainskills run --profile` → timing détaillé par step post-exécution | P2 | M | — |
| A8.4 Intégration Langfuse via exporteur Mastra natif (au lieu de custom) | P3 | S | A8.2 |
| A8.5 `CHAINSKILLS_OTEL_ENDPOINT` → bridging vers le OTel exporter Mastra | P3 | M | A8.2 |

### A0. Migration Mastra v1.x (PRÉREQUIS)

**CRITIQUE :** Le projet utilise `@mastra/core ^1.3.0` mais la version actuelle est **v1.10.0**.
La v1.0.0 (20 jan 2026) a introduit des **breaking changes** sur les imports.
De plus, Node.js ≥22.13.0 est requis par Mastra v1.x (le projet spécifie >=20).

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| A0.1 Mettre à jour `engines.node` de `>=20` à `>=22.13.0` | P0 | S | — |
| A0.2 Mettre à jour `@mastra/core` de `^1.3.0` à `^1.10.0` | P0 | M | A0.1 |
| A0.3 Migrer les imports : `@mastra/core` → subpath imports (`@mastra/core/workflows`) | P0 | M | A0.2 |
| A0.4 Vérifier compatibilité `createStep`, `createWorkflow` avec la nouvelle API | P0 | M | A0.3 |
| A0.5 Tester tous les 197 tests après migration | P0 | S | A0.4 |

> **Note :** Cette migration est un prérequis pour tous les blocs A. Elle débloque l'accès
> aux features Mastra sous-utilisées (suspend/resume natif, streaming, AI tracing, storage pluggable).

---

## BLOC B — WorkflowGraph : entité domaine centrale

### État actuel

Le `DAG` existe dans `core/use-cases/build-dag.ts` avec :
- `DAGNode` : stepId, dependencies, type, condition, iterable, loopVariable, maxIterations, loopMode, children, elseBranch, fallback, produces, consumes, concurrency
- `DAG` : nodes, entryPoints, parallelGroups
- `DAGNodeType` : sequential, parallel, branch, loop, try-catch

**Ce qui manque :** L'entité `WorkflowGraph` unifiée proposée dans le brainstorming (nodes + edges + metadata enrichie) n'existe pas. Le DAG actuel est bon mais limité aux informations structurelles. Il n'y a pas d'entité centralisée qui combine la structure du DAG avec les métadonnées du workflow et sert de source de vérité unique pour tous les renderers/consumers.

### B1. WorkflowGraph — Entité domaine unifiée

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| B1.1 Créer `core/entities/workflow-graph.ts` avec interface `WorkflowGraph` | P1 | M | — |
| B1.2 Enrichir les `NodeType` avec : suspend, transform, subworkflow, mcp | P2 | S | B1.1 |
| B1.3 Ajouter des `WorkflowEdge` explicites (source → target, type, condition) | P2 | M | B1.1 |
| B1.4 Créer use-case `build-workflow-graph.ts` qui combine buildDAG + Workflow metadata | P1 | M | B1.1, B1.3 |
| B1.5 Migrer les consumers existants (MastraExecutor, CLI inspect) vers WorkflowGraph | P2 | L | B1.4 |

**Interface cible :**
```typescript
interface WorkflowGraph {
  readonly workflow: WorkflowMeta  // name, version, description, inputs, outputs
  readonly nodes: readonly WorkflowNode[]
  readonly edges: readonly WorkflowEdge[]
  readonly parallelGroups: readonly (readonly string[])[]
  readonly entryPoints: readonly string[]
  readonly criticalPath: readonly string[]  // longest path DAG
}

interface WorkflowNode extends DAGNode {
  readonly title: string
  readonly description: string
  readonly directives: readonly DirectiveSummary[]
  readonly nodeCategory: NodeCategory  // tool, skill, agent, handoff, mcp, control-flow
}

interface WorkflowEdge {
  readonly source: string
  readonly target: string
  readonly type: 'sequential' | 'data-dependency' | 'conditional' | 'error-fallback'
  readonly label?: string  // variable name or condition
}
```

### B2. Multi-renderers — Pattern Strategy

**État actuel :** Un seul renderer ASCII dans `cli/inspect.ts` (inline, non réutilisable) + JSON output.

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| B2.1 Créer port `core/ports/workflow-renderer.port.ts` avec interface `IWorkflowRenderer` | P1 | S | B1.1 |
| B2.2 Extraire `AsciiRenderer` depuis `cli/inspect.ts` comme adapter | P2 | M | B2.1 |
| B2.3 Créer `MermaidRenderer` → export Mermaid DSL | P1 | M | B2.1 |
| B2.4 Créer `AgentContextRenderer` → JSON compact pour injection @agent/@handoff | P1 | M | B2.1, C2 |
| B2.5 Créer `CytoscapeRenderer` → JSON pour export/import interop | P3 | M | B2.1 |
| B2.6 Créer `ReactFlowRenderer` → JSON React Flow pour WebView | P2 | M | B2.1, B3 |
| B2.7 Créer `ToonRenderer` → format TOON optimisé tokens | P2 | M | B2.1, C1 |
| B2.8 `chainskills inspect --format mermaid|json|ascii|toon` | P2 | S | B2.2, B2.3 |

**Interface :**
```typescript
interface IWorkflowRenderer {
  readonly format: string
  render(graph: WorkflowGraph): string | object
}
```

### B3. DAG WebView VSCode

**État actuel :** Roadmap v0.6.0 ("DAG Webview") mais pas encore implémenté. L'extension VSCode v0.5.0 a les language providers mais aucune webview.

**Recherche SOTA :** React Flow est le standard pour les node editors DAG en React. Algorithmes de layout : dagre (simple) ou elk (avancé, hiérarchique). L'aesthetic "n8n-like" est la référence UX.

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| B3.1 Créer WebView panel VSCode avec React Flow | P1 | XL | B2.6 |
| B3.2 10 types de nodes visuels (Tool, Skill, Agent, Handoff, Parallel, Decision, Loop, MCP, Error, Suspend) | P1 | L | B3.1 |
| B3.3 Interactions phase 1 : zoom/pan, click → détails sidebar | P1 | M | B3.1 |
| B3.4 Highlight du chemin critique (longest path DAG) | P2 | M | B1.5 |
| B3.5 Coloration live pendant exécution | P2 | L | B3.1, A5.2 |
| B3.6 Badge taux de succès historique par node | P3 | M | B3.1, A7 |
| B3.7 Export PNG/SVG | P3 | M | B3.1 |
| B3.8 Commandes VSCode : `ChainSkills: Show Workflow Graph`, `Show Live Execution` | P1 | S | B3.1 |

---

## BLOC C — Context Translator & Token Optimizer

### C1. Validation scientifique (SOTA 2024–2026)

| Source | Résultat clé | Implication ChainSkills |
|--------|-------------|--------------------------|
| Études JSON structuré (2024-2025) | +8 à +38 pts de précision avec JSON projeté compact | AgentContext JSON compact pour @agent/@handoff |
| TOON (Tensorlake, v3.0 2025) | -30 à -60% tokens vs JSON, ~74% précision | Format TOON pour workflows en system prompt |
| WorFBench (ICLR 2025) | GPT-4 atteint seulement 52.47% sur graph planning | INPUT structuré critique pour performances agent |
| Semantic Entropy (Nature 2024) | Détection hallucinations par entropie sémantique | Module de détection d'incertitude |
| AFlow (ICLR 2025, Oral) | GPT-4o-mini dépasse GPT-4o à 4.55% du coût | WorkflowOptimizer MCTS |
| LLMLingua-2 (Microsoft, ACL 2024) | Jusqu'à 20x compression, perte minimale | Pipeline de compression de prompts |

**Règle fondamentale :** L'INPUT structuré améliore les performances (+8 à +38 pts), mais l'OUTPUT contraint les dégrade (-10 à -15%). Ne jamais forcer JSON en sortie pendant le raisonnement agent.

### C2. Port IContextTranslator

**État actuel :** ❌ N'existe pas. Les agents reçoivent un prompt texte libre. Aucune injection de contexte structuré (position DAG, steps complétés, variables disponibles).

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| C2.1 Créer port `core/ports/context-translator.port.ts` | P1 | S | — |
| C2.2 Créer `adapters/context/agent-context-translator.ts` — implémentation principale | P1 | L | C2.1, B1.4 |
| C2.3 Implémenter `toAgentContext()` → JSON compact avec position DAG, I/O, progression | P1 | L | C2.2 |
| C2.4 Implémenter `toToon()` → format TOON pour system prompt | P2 | M | C2.2 |
| C2.5 Implémenter `toMermaid()` → délégation au MermaidRenderer | P2 | S | C2.2, B2.3 |
| C2.6 Implémenter `toMinimalSubgraph()` → sous-graphe projeté pour sub-agents | P2 | M | C2.2 |
| C2.7 Injection automatique AgentContext dans `handleAgent()` / `handleHandoff()` | P1 | M | C2.3 |
| C2.8 Config `CHAINSKILLS_AGENT_CONTEXT=auto|manual|off` | P2 | S | C2.7 |

**Interface :**
```typescript
interface IContextTranslator {
  toAgentContext(graph: WorkflowGraph, agentId: string): AgentContext
  toToon(graph: WorkflowGraph): string
  toMermaid(graph: WorkflowGraph): string
  toProjectedJson(graph: WorkflowGraph, projection: string[]): object
  toMinimalSubgraph(graph: WorkflowGraph, nodeId: string, depth: number): WorkflowGraph
}

interface AgentContext {
  readonly currentStep: { id: string; title: string; description: string }
  readonly position: { index: number; total: number; depth: number }
  readonly completedSteps: readonly { id: string; status: string; output?: unknown }[]
  readonly pendingSteps: readonly { id: string; title: string }[]
  readonly parallelSiblings: readonly string[]
  readonly availableVariables: Record<string, unknown>
  readonly expectedOutputs: readonly { name: string; type: string }[]
  readonly workflowProgress: number  // 0.0 - 1.0
}
```

### C3. Stratégie de format par contexte

| Contexte | Format optimal | Gain attendu | Priorité |
|----------|----------------|--------------|----------|
| @agent reçoit task + position DAG | AgentContext JSON compact | +8 à +38 pts précision | P1 |
| Workflow complet en system prompt | TOON | -30 à -60% tokens | P2 |
| Inspection CLI | Mermaid DSL | Lisibilité native LLM | P2 |
| Sub-agent → sous-graphe | JSON projeté minimal | x12 réduction contexte | P2 |
| Orchestrateur planifie | Texte libre → conversion post | Évite -15% sur raisonnement | P1 (règle) |

### C4. TokenOptimizer — Pipeline de prétraitement

**État actuel :** ❌ N'existe pas. Pas de compression de prompts ni de routing ML.

**Note architecturale :** Ce bloc est le plus ambitieux et le plus risqué. Il nécessite des dépendances ML (ONNX Runtime, DistilBERT) qui alourdissent significativement le bundle. Recommandation : implémenter en tant que **package optionnel** (`@chainskills/ml-optimizer`) installable séparément.

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| C4.1 Créer package `@chainskills/ml-optimizer` dans le monorepo | P3 | M | — |
| C4.2 Implémenter `ComplexityClassifier` (DistilBERT ONNX, ~12ms) | P3 | XL | C4.1 |
| C4.3 Implémenter `ContextCompressor` (LLMLingua-2 style) | P3 | XL | C4.1 |
| C4.4 Implémenter `HistoryTrimmer` (ACON-style compression) | P3 | L | C4.1 |
| C4.5 Implémenter `ModelRouter` (routing petit modèle vs LLM complet) | P3 | XL | C4.2 |
| C4.6 Intégrer comme plugin optionnel dans le pipeline d'exécution | P3 | M | C4.2-C4.5 |

**Recommandation :** Reporter à v1.x. Prioriser d'abord l'injection de contexte structuré (C2) qui apporte des gains immédiats sans dépendances ML.

---

## BLOC D — ExecutionMemory & PatternRetriever

### D1. ExecutionMemory — Taxonomie des mémoires

**État actuel :** Infrastructure de base existe :
- ✅ `runs` table avec status, inputs, outputs, duration, error
- ✅ `run_events` table avec event_type, step_id, data
- ✅ `snapshots` table pour persistance d'état
- ✅ `learned_rules` table avec condition, action, confidence, hit_count
- ✅ `ReflectionEngine` qui analyse via LLM et génère des `ReflectionRule`
- ✅ `RulesApplicator` qui injecte les règles dans le contexte agent

**Ce qui manque :**
- ❌ Capture de stdout/stderr par step (épisodique)
- ❌ Compression zstd des traces
- ❌ PatternMiner ML (TF-IDF, clustering, Apriori, anomaly detection)
- ❌ SkillRefiner (auto-amélioration des .workflow.md)
- ❌ Catégorisation mémoire épisodique/sémantique/procédurale

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| D1.1 Enrichir `StepResult` avec stdout, stderr, exitCode dans le port | P1 | M | — |
| D1.2 Capturer stdout/stderr dans `handleCall()` et `handleAgent()` | P1 | M | D1.1 |
| D1.3 Créer table `step_traces` en SQLite (migration v2) | P1 | M | D1.2 |
| D1.4 Créer entité `ExecutionTrace` / `StepTrace` dans core/entities | P1 | M | D1.3 |
| D1.5 Compression optionnelle zstd des traces volumineuses | P3 | M | D1.3 |
| D1.6 Config `memory:` dans frontmatter .workflow.md | P2 | M | D1.3 |
| D1.7 Privacy : redact-secrets, truncate-long-outputs | P2 | M | D1.3 |

**Schéma SQLite (migration v2) :**
```sql
CREATE TABLE step_traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(id),
    step_id TEXT NOT NULL,
    directive TEXT,
    stdout TEXT,
    stderr TEXT,
    exit_code INTEGER,
    status TEXT NOT NULL,  -- success, error, timeout, retry
    retry_count INTEGER DEFAULT 0,
    duration_ms INTEGER,
    agent_confidence REAL,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_step_traces_run ON step_traces(run_id);

CREATE TABLE patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL,  -- error, performance, sequence
    description TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    confidence REAL DEFAULT 0.5,
    context_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### D1.8 PatternMiner — ML classique

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| D1.8a TF-IDF + clustering (kmeans/dbscan) sur stderr → classes d'erreurs | P3 | XL | D1.3 |
| D1.8b Apriori : extraction de séquences "stepA échoue → stepB suit" | P3 | L | D1.3 |
| D1.8c Anomaly detection : time-series pour step 3σ plus lent | P3 | L | D1.3 |
| D1.8d Logistic regression : probabilité d'échec prédite avant exécution | P3 | XL | D1.3 |

**Recommandation :** Reporter le PatternMiner ML à v1.x. Prioriser la capture de traces (D1.1-D1.4) qui apporte de la valeur immédiate.

### D1.9 SkillRefiner — Auto-amélioration des workflows

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| D1.9a Créer `SkillRefiner` qui analyse N runs et suggère des enrichissements | P2 | L | D1.3, D1.4 |
| D1.9b Mode `suggest` : propose les améliorations en commentaire | P2 | M | D1.9a |
| D1.9c Mode `auto` : modifie le .workflow.md directement (avec git diff review) | P3 | L | D1.9b |
| D1.9d Config `refine: suggest|auto|off` + `refine-threshold: N` dans frontmatter | P2 | S | D1.9a |

### D2. PatternRetriever — Le cerveau décisionnel

**État actuel :** `RulesApplicator` existe et injecte les règles apprises dans le contexte agent. Mais c'est un système simple (lookup SQL + injection texte). Le PatternRetriever proposé est beaucoup plus ambitieux : agrégation parallèle de 6 sources, scoring ML, coverageScore.

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| D2.1 Créer port `core/ports/pattern-retriever.port.ts` | P2 | S | — |
| D2.2 Implémenter retriever basique : skills + workflows + rules (Promise.all) | P2 | L | D2.1 |
| D2.3 Ajouter scoring `coverageScore` (0.0-1.0) basé sur hits historiques | P2 | M | D2.2, D1.3 |
| D2.4 Intégrer dans `handleAgent()` : injecter les patterns avant raisonnement LLM | P2 | M | D2.3 |
| D2.5 Embeddings + similarité vectorielle (FAISS ou SQLite-VSS) | P3 | XL | D2.2 |
| D2.6 Scoring ML classique (Random Forest) pour re-ranking | P3 | XL | D2.5 |
| D2.7 Contraintes symboliques : règles hard injectées comme guard-rails | P2 | M | D2.2 |

**Recommandation :** Implémenter D2.1-D2.4 (retriever basique + coverageScore) en v0.8/v0.9. Reporter D2.5-D2.6 (ML avancé) à v1.x.

---

## BLOC E — Hybridation ML / Neuro-Symbolique

### E1. OutputValidationPipeline — Chaîne multi-couches

**État actuel :**
- ✅ `@validate` directive existe avec Zod schema validation (`handleValidate()`)
- ✅ `@assert` directive existe pour validation symbolique conditionnelle (`handleAssert()`)
- ✅ `SchemaValidator` port avec validation Zod runtime
- ❌ ConsistencyScorer (multi-sampling)
- ❌ SemanticEntropyDetector
- ❌ HistoricalAnomalyML

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| E1.1 Créer port `core/ports/output-validator.port.ts` avec pipeline 5 étapes | P2 | M | — |
| E1.2 Étape 1 : `StructuralValidator` (déjà existant via @validate/Zod) — wrapper | P2 | S | E1.1 |
| E1.3 Étape 2 : `ConsistencyScorer` (multi-sampling LLM, style SelfCheckGPT) | P3 | XL | E1.1 |
| E1.4 Étape 3 : `SymbolicGuard` (déjà existant via @assert) — wrapper | P2 | S | E1.1 |
| E1.5 Étape 4 : `SemanticEntropyDetector` (entropie sémantique, Nature 2024) | P3 | XL | E1.1 |
| E1.6 Étape 5 : `HistoricalAnomalyML` (comparaison vs runs historiques) | P3 | L | E1.1, D1.3 |
| E1.7 Décision de sortie : Accept | Retry | Escalate | Fallback, configurable par step | P2 | M | E1.1 |

### E2. @assert enrichi

**État actuel :** `@assert` évalue une condition et fait échouer le step si fausse. Pas de `@on-violation` ni de retry avec contexte.

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| E2.1 Ajouter `@on-violation: retry with context` à @assert | P2 | M | A2 |
| E2.2 Assertions sur types : `is integer`, `is string`, `is array` | P2 | M | — |
| E2.3 Assertions sur valeurs : `>= 0`, `== $expected`, `contains "text"` | P2 | M | — |
| E2.4 Enrichir la condition-parser pour supporter ces opérateurs | P2 | M | E2.2, E2.3 |

**Syntaxe cible :**
```markdown
@assert $security.critical_count is integer and >= 0
@assert $security.scanned_files == $files.length
@on-violation: retry with context: "Previous output violated: $violation"
```

### E3. ClassicalMLRouter — Routing intelligent

**État actuel :** ❌ N'existe pas. Tous les appels @agent vont au même provider (OpenAI).

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| E3.1 Créer port `core/ports/ml-router.port.ts` | P3 | S | — |
| E3.2 Implémentation basique : règles heuristiques (taille prompt, type de tâche) | P2 | M | E3.1 |
| E3.3 Implémentation ML : DistilBERT ONNX classifier | P3 | XL | E3.1, C4.1 |
| E3.4 Directive `@route ml-based: prefer:accuracy → agent:auto` | P3 | M | E3.1 |
| E3.5 Retrain incrémental basé sur les runs historiques | P3 | XL | E3.3, D1.3 |

**Recommandation :** Implémenter E3.2 (heuristiques) en v0.9. Reporter E3.3-E3.5 (ML) à v1.x.

### E4. WorkflowOptimizer MCTS — Auto-amélioration

**Recherche SOTA :** AFlow (ICLR 2025 Oral) démontre que GPT-4o-mini peut dépasser GPT-4o en performance à 4.55% du coût via optimisation automatique de workflows par MCTS. Le framework traite les workflows LLM comme du code optimisable.

| Tâche | Priorité | Complexité | Dépendance |
|-------|----------|------------|------------|
| E4.1 Recherche et prototypage : reproduire l'approche AFlow sur un workflow ChainSkills | P3 | XL | D1.3, D2 |
| E4.2 Implémentation MCTS pour exploration de variantes de workflows | P3 | XXL | E4.1 |
| E4.3 Benchmark automatique : comparer variantes sur success rate / coût / vitesse | P3 | L | E4.2 |

**Recommandation :** Clairement v1.x+. Nécessite d'abord les fondations (mémoire d'exécution, pattern retriever).

---

## Priorisation & Séquencement

### Phase 0 — Migration Mastra v1.x (PRÉREQUIS CRITIQUE)

**Objectif :** Mettre à jour @mastra/core de ^1.3.0 à ^1.10.0, corriger les imports, valider les tests

| # | Tâche | Bloc | Priorité | Complexité |
|---|-------|------|----------|------------|
| 0 | Migration Mastra v1.x + Node.js >=22.13.0 | A0.1-A0.5 | **P0** | M |

**Estimation :** 1-2 jours. **Bloque tout le Bloc A.**

### Phase 1 — Fondations (v0.7.0–v0.8.0) — "Les bases qui débloquent tout"

**Objectif :** WorkflowGraph unifié + Context Translator + Capture de traces

| # | Tâche | Bloc | Priorité | Complexité |
|---|-------|------|----------|------------|
| 1 | WorkflowGraph entité domaine unifiée | B1.1-B1.4 | P1 | M-L |
| 2 | IWorkflowRenderer port + MermaidRenderer | B2.1, B2.3 | P1 | M |
| 3 | IContextTranslator port + AgentContext injection | C2.1-C2.3, C2.7 | P1 | L |
| 4 | @retry directive avec backoff | A2.1-A2.3 | P1 | M |
| 5 | Capture stdout/stderr dans StepTrace | D1.1-D1.4 | P1 | M |
| 6 | Nouvelles DirectiveType (retry, suspend, dountil, map) | A1.7 | P2 | S |

**Estimation :** ~30-40 tâches unitaires, ~2-3 semaines de développement.

### Phase 2 — Intelligence (v0.8.0–v0.9.0) — "L'agent qui apprend"

**Objectif :** PatternRetriever + SkillRefiner + Suspend/Resume + WebView DAG

| # | Tâche | Bloc | Priorité | Complexité |
|---|-------|------|----------|------------|
| 7 | PatternRetriever basique avec coverageScore | D2.1-D2.4 | P2 | L |
| 8 | SkillRefiner (mode suggest) | D1.9a-D1.9b | P2 | L |
| 9 | @suspend + CLI resume | A3.1-A3.4 | P2 | L |
| 10 | DAG WebView VSCode (React Flow) | B3.1-B3.3 | P1 (v0.6 roadmap) | XL |
| 11 | Multi-renderers (Ascii, Mermaid, ReactFlow, TOON) | B2.2-B2.7 | P2 | M |
| 12 | @use import fichier externe | A4.1-A4.3 | P2 | M |
| 13 | OutputValidationPipeline (wrappers existants + décisions) | E1.1-E1.2, E1.4, E1.7 | P2 | M |
| 14 | @assert enrichi (types, opérateurs, @on-violation) | E2.1-E2.4 | P2 | M |
| 15 | Enrichir MastraExecutor avec .branch(), .foreach() natifs | A1.2-A1.4 | P2 | M |

**Estimation :** ~40-50 tâches unitaires, ~4-6 semaines de développement.

### Phase 3 — Optimisation (v0.9.0–v1.0.0) — "Performance et polish"

| # | Tâche | Bloc | Priorité |
|---|-------|------|----------|
| 16 | ML Router basique (heuristiques) | E3.1-E3.2 | P2 |
| 17 | OpenTelemetry export optionnel | A8.2 | P3 |
| 18 | DAG WebView : live execution, badges, export | B3.4-B3.7 | P2-P3 |
| 19 | Streaming SSE via MCP | A5.3 | P3 |
| 20 | Privacy (redact-secrets, truncate) | D1.7 | P2 |
| 21 | @use résolution Git | A4.4 | P3 |

### Phase 4 — ML avancé (v1.x+) — "Le cerveau"

| # | Tâche | Bloc | Priorité |
|---|-------|------|----------|
| 22 | TokenOptimizer (package @chainskills/ml-optimizer) | C4 | P3 |
| 23 | PatternMiner ML (TF-IDF, clustering, anomaly) | D1.8 | P3 |
| 24 | Embeddings + FAISS/SQLite-VSS | D2.5-D2.6 | P3 |
| 25 | ML Router (DistilBERT ONNX) | E3.3-E3.5 | P3 |
| 26 | ConsistencyScorer + SemanticEntropyDetector | E1.3, E1.5 | P3 |
| 27 | WorkflowOptimizer MCTS (AFlow) | E4 | P3 |

---

## Mapping Roadmap existante ↔ Blocs

| Version existante | Blocs du brainstorming à intégrer |
|-------------------|-----------------------------------|
| **v0.6.0** (en cours) — Copilot AI | B3 (DAG WebView), B2.6 (ReactFlowRenderer) |
| **v0.7.0** — Debug & Test | A2 (retry), A1.7 (nouvelles directives), B1 (WorkflowGraph), D1.1-D1.4 (traces) |
| **v0.8.0** — Registry | A4 (@use import externe), C2 (ContextTranslator), D2 (PatternRetriever) |
| **v0.9.0** — Polish | B2 (multi-renderers), E1-E2 (validation), A8 (observabilité), E3.2 (ML Router basique) |
| **v1.0.0** — Production | D1.8 (PatternMiner), C4 (TokenOptimizer), E3-E4 (ML avancé), A3 (suspend/resume) |

---

## Principes d'implémentation

### 1. Architecture hexagonale stricte

Tout nouveau composant suit le pattern :
```
core/ports/nouveau-port.port.ts      → Interface (le contrat)
core/entities/nouvelle-entite.ts      → Entité domaine (données pures)
adapters/nouveau/implementation.ts    → Implémentation (les dépendances externes)
config/container.ts                   → Injection de dépendances
```

Le domaine core/ ne doit **jamais** importer de dépendances externes (Mastra, better-sqlite3, etc.).

### 2. Chaque feature = tests

- Chaque nouveau port → tests unitaires (mock de l'interface)
- Chaque nouvel adapter → tests d'intégration
- Objectif : maintenir le ratio 197+ tests, ajouter ~10-20 tests par feature

### 3. Backward compatibility

- Les nouvelles directives sont additives (pas de breaking change)
- Les formats de sortie existants (JSON, ASCII) restent inchangés
- Les nouveaux renderers sont opt-in (via `--format`)
- Le TokenOptimizer est un package séparé optionnel

### 4. Progressive enhancement

- Phase 1 fonctionne sans ML (heuristiques, règles, SQL)
- Phase 2 ajoute des capacités apprenantes (patterns, coverage score)
- Phase 3-4 introduisent le ML optionnel (ONNX, FAISS)

---

## Annexe — Références SOTA

### Publications validées

| Ref | Titre | Venue | Date | Pertinence |
|-----|-------|-------|------|------------|
| [1] | Semantic Entropy | Nature | Juin 2024 | Détection hallucinations — entropie sémantique |
| [2] | LLMLingua-2 | ACL 2024 | 2024 | Compression de prompts — jusqu'à 20x |
| [3] | SelfCheckGPT | EMNLP 2023 | 2023 | Validation par consistance multi-sampling |
| [4] | AFlow | ICLR 2025 (Oral) | 2025 | Optimisation auto de workflows par MCTS |
| [5] | WorFBench | ICLR 2025 | 2025 | Benchmark graph planning — GPT-4 à 52.47% |
| [6] | TOON | Tensorlake | 2025 | Format token-optimisé -30 à -60% vs JSON |
| [7] | DeepSWE | — | 2025 | stdout/stderr comme état d'environnement, 59% SWE-Bench |
| [8] | MemRL / LEGOMem | — | 2025-2026 | Mémoire épisodique/sémantique/procédurale pour agents |

### Frameworks et outils

| Outil | Version actuelle | Version SOTA | Licence | Usage dans ChainSkills |
|-------|-----------------|--------------|---------|------------------------|
| Mastra | ^1.3.0 | **v1.10.0** (9 mars 2026) | Apache 2.0 | DAG engine principal |
| React Flow | — | latest | MIT | WebView DAG VSCode |
| dagre / elk | — | — | MIT / EPL-2.0 | Layout algorithmique DAG |
| ONNX Runtime | — | — | MIT | ML inference (phases 3-4) |
| FAISS / SQLite-VSS | — | — | MIT | Recherche vectorielle (phase 4) |

### Sources Mastra (vérifiées mars 2026)

- [@mastra/core npm](https://www.npmjs.com/package/@mastra/core) — v1.10.0, 235 projets dépendants
- [Workflows Overview](https://mastra.ai/docs/workflows/overview) — .then/.parallel/.branch/.dowhile/.dountil/.foreach/.map
- [Suspend & Resume](https://mastra.ai/docs/workflows/suspend-and-resume) — resumeSchema, suspendSchema, closeOnSuspend
- [Workflow Streaming](https://mastra.ai/docs/streaming/workflow-streaming) — run.stream(), writer, resumeStream()
- [AI Tracing](https://mastra.ai/docs/observability/tracing) — exporteurs OTel, Langfuse, Braintrust, LangSmith
- [Storage Blog](https://mastra.ai/blog/mastra-storage) — 10+ backends, MastraCompositeStore
- [v1.0 Changelog](https://mastra.ai/blog/changelog-2026-01-20) — breaking changes imports

---

> **Document généré le 2026-03-14**
> **Basé sur :** audit complet du codebase ChainSkills v0.6.0/v0.7.0, recherche SOTA 2024-2026
> **Pour :** Claude Code Opus 4.6
