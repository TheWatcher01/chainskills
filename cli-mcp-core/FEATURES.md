# Feature Catalog — chainskills v0.4.0

> Catalogue exhaustif de toutes les fonctionnalités implémentées, avec use cases concrets.
> Dernière mise à jour : 2026-02-13.

### Légende

| Icône | Signification                                  |
| ----- | ---------------------------------------------- |
| ✅    | Vérifié et fonctionnel (tests + exécution CLI) |
| ⏭️    | Non testable depuis ce repo (repo séparé)      |

**Statut** : 23/24 features vérifiées — 197/197 tests passing — Agent LLM testé via GitHub Models API (gpt-4o-mini)

**Dernière vérification complète** : 2026-02-13 (post-restructuration workspace)

**Bug corrigé pendant vérification** : `parseCommand()` ne strippait pas les guillemets externes des commandes `@call shell.exec("cmd")` — fix appliqué dans `shell-tool-provider.ts`

---

## Table des matières

- [1. Workflow Format (.workflow.md) ✅](#1-workflow-format-workflowmd-)
- [2. Directives (17 types) ✅](#2-directives-17-types-)
- [3. Parser Markdown ✅](#3-parser-markdown-)
- [4. Executors (Strategy Pattern) ✅](#4-executors-strategy-pattern-)
- [5. DAG Builder ✅](#5-dag-builder-)
- [6. Execution Events ✅](#6-execution-events-)
- [7. Execution Control ✅](#7-execution-control-)
- [8. State Management ✅](#8-state-management-)
- [9. Tool Providers ✅](#9-tool-providers-)
- [10. MCP Server ✅](#10-mcp-server-)
- [11. MCP Client ✅](#11-mcp-client-)
- [12. Agent LLM (@agent / @handoff) ✅](#12-agent-llm-agent--handoff-)
- [13. Skill Resolution ✅](#13-skill-resolution-)
- [14. Template Engine & Condition Parser ✅](#14-template-engine--condition-parser-)
- [15. Validation ✅](#15-validation-)
- [16. CLI Commands (6) ✅](#16-cli-commands-6-)
- [17. SDK API ✅](#17-sdk-api-)
- [18. Result Monad ✅](#18-result-monad-)
- [19. Logger ✅](#19-logger-)
- [20. DI Container ✅](#20-di-container-)
- [21. Security ✅](#21-security-)
- [22. VS Code Extension ⏭️](#22-vs-code-extension-️)
- [23. Templates (7) ✅](#23-templates-7-)
- [24. Architecture ✅](#24-architecture-)

---

## 1. Workflow Format (.workflow.md) ✅

**Depuis**: v0.1.0 | **Fichiers**: `src/core/entities/workflow.ts`, `src/core/entities/step.ts`

Les workflows sont écrits en Markdown standard enrichi d'un frontmatter YAML et de directives `@`.

### Structure

```markdown
---
name: my-workflow
description: Description du workflow
version: "1.0.0"
inputs:
  target: string
  verbose: boolean
outputs:
  report: string
env:
  - API_KEY
tags: [security, audit]
---

# Step 1 — Titre du step

Texte libre en Markdown (instructions en langage naturel).

@call shell.exec("nmap $target") → $scan_result

# Step 2 — Analyse

@if $verbose:
@call shell.exec("echo $scan_result")
```

### Use Cases

| Use Case                             | Description                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| **Automatiser un audit de sécurité** | Écrire un workflow multi-étapes avec `@parallel` pour scanner, analyser et reporter |
| **Pipeline de code review**          | Workflow avec ESLint + tests + security scan en parallèle                           |
| **Onboarding développeur**           | Workflow guidé avec `@agent` pour expliquer le codebase                             |
| **CI/CD personnalisé**               | Alternative lisible à GitHub Actions / Makefiles                                    |
| **Documentation vivante**            | Le workflow EST la documentation — lisible par humains ET machines                  |

### Frontmatter Fields

| Champ         | Type     | Requis | Description                         |
| ------------- | -------- | ------ | ----------------------------------- |
| `name`        | string   | ✅     | Identifiant kebab-case (1-64 chars) |
| `description` | string   | ✅     | Description humaine                 |
| `version`     | string   | ✅     | Semver (`"1.0.0"`)                  |
| `inputs`      | object   | ❌     | Variables d'entrée typées           |
| `outputs`     | object   | ❌     | Variables de sortie déclarées       |
| `env`         | string[] | ❌     | Variables d'environnement requises  |
| `tags`        | string[] | ❌     | Tags de catégorisation              |

---

## 2. Directives (17 types) ✅

**Depuis**: v0.1.0 (6 types) → v0.2.0 (15 types) → v0.3.0 (17 types) | **Fichier**: `src/core/entities/directive.ts`

### Référence complète

#### `@use` — Import de Skills

```markdown
@use ./security-scanner
@use eslint-analyzer
```

| Use Case               | Quand utiliser                         |
| ---------------------- | -------------------------------------- |
| Composer des workflows | Importer un outil/skill réutilisable   |
| Modulariser la logique | Séparer les préoccupations en fichiers |

---

#### `@call` — Appel d'outil avec capture

```markdown
@call shell.exec("nmap -sV $target") → $scan_result
@call mcp.analyze($data) → $analysis
```

| Use Case                     | Quand utiliser                 |
| ---------------------------- | ------------------------------ |
| Exécuter une commande shell  | `@call shell.exec("cmd")`      |
| Appeler un outil MCP distant | `@call mcp.tool_name($input)`  |
| Capturer un résultat         | `→ $variable` stocke la sortie |

---

#### `@if` / `@else` — Branchement conditionnel

```markdown
@if $score > 80:
Résultat excellent.

@else:
Résultat insuffisant.
```

Bloc structuré (container directive) :

```markdown
:::if $count > 0

## Traitement

@call shell.exec("process $count items")

:::
```

| Use Case               | Quand utiliser                                  |
| ---------------------- | ----------------------------------------------- |
| Logique conditionnelle | Exécuter des steps selon une condition          |
| Gestion de seuils      | `@if $risk_level > 5:` → actions de remédiation |
| Feature flags          | `@if $enable_v2:` → nouveau comportement        |

**Opérateurs supportés** : `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`, `!`

---

#### `@for` — Itération bornée

```markdown
@for $port in $open_ports:
@call shell.exec("nmap -sV -p $port $target") → $detail
```

Bloc structuré :

```markdown
:::for $item in $list

## Traitement de $item

@call process($item) → $result

:::
```

| Use Case             | Quand utiliser                               |
| -------------------- | -------------------------------------------- |
| Itérer sur une liste | Scanner chaque port, analyser chaque fichier |
| Traitement par lot   | Appliquer une action à chaque élément        |

---

#### `@repeat` — Boucle avec condition d'arrêt

```markdown
@repeat max:5 until $tests_pass == true:
@call shell.exec("pnpm test") → $tests_pass
```

| Use Case          | Quand utiliser                                |
| ----------------- | --------------------------------------------- |
| Retry automatique | Réessayer jusqu'à succès (max N fois)         |
| Convergence       | Répéter jusqu'à ce qu'un critère soit atteint |
| TDD cycle         | Itérer red→green→refactor                     |

**Paramètres** : `max:N` (nombre max d'itérations), `until condition` ou `while condition`

---

#### `@parallel` — Exécution parallèle

```markdown
@parallel:

## Lint

@call eslint.check($files) → $lint

## Tests

@call test-runner.run($path) → $tests
```

Bloc structuré :

```markdown
:::parallel

## Tâche A

@call tool.a() → $result_a

## Tâche B

@call tool.b() → $result_b

:::
```

| Use Case              | Quand utiliser                                 |
| --------------------- | ---------------------------------------------- |
| Accélérer le workflow | Exécuter des tâches indépendantes en parallèle |
| Pipeline CI           | Lint + tests + security scan simultanément     |

**Note** : Avec `SimpleExecutor`, exécuté séquentiellement. Avec `MastraExecutor`, exécuté réellement en parallèle via `.parallel()`.

---

#### `@try` / `@on-error` — Gestion d'erreurs

```markdown
@try:
@call shell.exec("risky-command") → $result
@on-error: log and continue
```

Bloc structuré :

```markdown
:::try

## Opération risquée

@call external-api.call($input) → $response

:::
```

| Use Case               | Quand utiliser                                           |
| ---------------------- | -------------------------------------------------------- |
| Tolérance aux pannes   | Continuer le workflow même si un step échoue             |
| Fallback gracieux      | Logger l'erreur et continuer avec des valeurs par défaut |
| API externes instables | Encapsuler les appels réseau                             |

---

#### `@assert` — Checkpoint de validation

```markdown
@assert $budget.total == $budget.charges
@assert $scan_result != null
```

| Use Case            | Quand utiliser                                       |
| ------------------- | ---------------------------------------------------- |
| Invariants métier   | Vérifier qu'un calcul est correct avant de continuer |
| Pré-conditions      | S'assurer qu'une variable critique est définie       |
| Tests de régression | Valider les résultats intermédiaires                 |

**Comportement** : Si la condition est fausse, l'exécution s'arrête avec une erreur.

---

#### `@breakpoint` — Point d'arrêt conditionnel

```markdown
@breakpoint $count > 5
@breakpoint
```

| Use Case             | Quand utiliser                                   |
| -------------------- | ------------------------------------------------ |
| Debugging interactif | Pause le workflow quand une condition est vraie  |
| Inspection d'état    | Examiner les variables à un point précis         |
| Développement        | Breakpoints temporaires pendant le développement |

**Depuis** : v0.4.0. Pause l'exécution via `ExecutionController.pause()`.

---

#### `@output` — Déclaration des sorties

```markdown
@output: $report, $score, $passed
```

| Use Case              | Quand utiliser                                             |
| --------------------- | ---------------------------------------------------------- |
| Définir les résultats | Déclarer explicitement ce que le workflow produit          |
| Chaîner des workflows | Les outputs d'un workflow deviennent les inputs d'un autre |

---

#### `@env` — Variable d'environnement

```markdown
@env API_KEY
@env DATABASE_URL
```

| Use Case      | Quand utiliser                                |
| ------------- | --------------------------------------------- |
| Secrets       | Injecter des clés API sans les coder en dur   |
| Configuration | Adapter le comportement selon l'environnement |

**Sécurité** : Seules les variables déclarées dans le frontmatter `env:` sont accessibles (scoped).

---

#### `@workflow` — Sub-workflow inline

```markdown
@workflow validate-budget:

## Calculer total

@call calculator.sum($items) → $total

## Vérifier

@assert $total <= $budget_max
```

| Use Case      | Quand utiliser                                           |
| ------------- | -------------------------------------------------------- |
| Encapsulation | Regrouper une logique réutilisable dans un mini-workflow |
| Récursion     | Un workflow peut appeler un sub-workflow                 |

---

#### `@agent` — Délégation à un agent IA

```markdown
@agent copilot: "Analyse ce code et suggère des améliorations pour $file_content"
@agent reviewer: "Review these changes: $diff" → $review
```

| Use Case                | Quand utiliser                             |
| ----------------------- | ------------------------------------------ |
| Code review automatisée | Déléguer l'analyse à un LLM                |
| Génération de contenu   | Créer des rapports, résumés, documentation |
| Raisonnement complexe   | Tâches nécessitant du jugement humain-like |

**Agents par défaut** : `copilot`, `reviewer`, `writer` (avec system prompts adaptés).
**Compatible** : OpenAI, Anthropic, Ollama, LM Studio, Groq, tout API OpenAI-compatible.

---

#### `@handoff` — Transfert à un autre agent

```markdown
@handoff review-agent: "Review the changes made so far"
```

| Use Case              | Quand utiliser                         |
| --------------------- | -------------------------------------- |
| Pipeline multi-agents | Passer le relais d'un agent à un autre |
| Spécialisation        | Chaque agent a son domaine d'expertise |

---

## 3. Parser Markdown ✅

**Depuis**: v0.1.0 | **Fichiers**: `src/adapters/parser/markdown-parser.ts`, `frontmatter-parser.ts`, `remark-workflow-plugin.ts`

### Fonctionnalités

| Feature                 | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| **Frontmatter YAML**    | Parse `---` block via `gray-matter`                             |
| **Markdown → AST**      | `unified` + `remark-parse` → MDAST                              |
| **Directives `@`**      | `remark-directive` pour `textDirective` et `containerDirective` |
| **Container blocks**    | `:::parallel`, `:::if`, `:::for`, `:::try`, `:::workflow`       |
| **Step boundaries**     | Chaque heading Markdown (`#`, `##`) = frontière de step         |
| **Variable extraction** | Détecte `$name` et `→ $capture` patterns                        |
| **Recursive children**  | `Step.children` pour les blocs imbriqués                        |

### Use Cases

| Use Case                  | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| **Parse pour validation** | `parseWorkflow(source)` → `Result<Workflow, ParseError>` |
| **Parse pour exécution**  | AST complet avec steps, directives, children             |
| **Parse pour inspection** | Extraire la structure pour le DAG builder                |
| **Parse pour IDE**        | Positions de source pour CodeLens, Diagnostics (v0.5.0)  |

---

## 4. Executors (Strategy Pattern) ✅

**Depuis**: v0.1.0 (Simple) + v0.2.0 (Mastra) | **Fichiers**: `src/adapters/executor/simple-executor.ts`, `mastra-executor.ts`, `directive-handlers.ts`

### SimpleExecutor

Exécution séquentielle avec support complet de toutes les 17 directives.

| Feature              | Description                                    |
| -------------------- | ---------------------------------------------- |
| Séquentiel           | Steps exécutés un par un dans l'ordre          |
| `@parallel` fallback | Marqué parallèle mais exécuté séquentiellement |
| Tous les handlers    | 17 types de directives supportés               |
| Dry-run              | Simulation sans effets de bord                 |
| Events               | Émet des événements d'exécution en temps réel  |

### MastraExecutor

Orchestration DAG réelle via `@mastra/core`.

| Feature            | Description                                 |
| ------------------ | ------------------------------------------- |
| DAG réel           | `.then()`, `.parallel()`, `.branch()`       |
| Parallélisme réel  | `@parallel` exécuté vraiment en parallèle   |
| Schémas dynamiques | `z.record(z.unknown())` pour la flexibilité |
| State mapping      | `StateStore` ↔ Mastra `state`/`setState`    |
| Error handling     | `bail()`, `retryConfig` Mastra              |

### Directive Handlers partagés

Module `directive-handlers.ts` (~561 lignes) avec 17 handlers factorisés, réutilisés par les deux executors (DRY).

### Use Cases

| Use Case                         | Configuration                                   |
| -------------------------------- | ----------------------------------------------- |
| **Développement local**          | `CHAINSKILLS_EXECUTOR=simple` (rapide, offline) |
| **Production avec parallélisme** | `CHAINSKILLS_EXECUTOR=mastra` (DAG réel)        |
| **Tests unitaires**              | `SimpleExecutor` avec `createNoopAgent()`       |
| **CI/CD**                        | `SimpleExecutor` + `--dry-run` pour validation  |

---

## 5. DAG Builder ✅

**Depuis**: v0.2.0 | **Fichier**: `src/core/use-cases/build-dag.ts`

### Fonctionnalités

| Feature                    | Description                                                       |
| -------------------------- | ----------------------------------------------------------------- |
| **Analyse de dépendances** | `@call → $capture` → consommateurs automatiquement détectés       |
| **Auto-parallélisation**   | Steps sans dépendance = parallélisables automatiquement           |
| **Détection de cycles**    | Erreur si le graphe contient un cycle                             |
| **Types de nœuds**         | `step`, `branch`, `loop`, `parallel`, `try-catch`, `sub-workflow` |
| **Groupes parallèles**     | `@parallel` → nœuds regroupés                                     |

### Use Cases

| Use Case                   | Description                                           |
| -------------------------- | ----------------------------------------------------- |
| **Optimiser l'exécution**  | Identifier les steps qui peuvent tourner en parallèle |
| **Visualiser le pipeline** | `chainskills inspect` affiche le DAG en ASCII art     |
| **Valider la structure**   | Détecter les cycles et dépendances manquantes         |
| **Planifier l'exécution**  | Le MastraExecutor utilise le DAG pour orchestrer      |

---

## 6. Execution Events ✅

**Depuis**: v0.2.0 | **Fichier**: `src/core/ports/execution-events.port.ts`, `src/infrastructure/event-emitter.ts`

### 11 types d'événements

| Événement         | Émis quand                               |
| ----------------- | ---------------------------------------- |
| `workflow:start`  | Le workflow commence                     |
| `workflow:end`    | Le workflow se termine (succès ou échec) |
| `step:start`      | Un step commence                         |
| `step:end`        | Un step se termine                       |
| `step:skip`       | Un step est ignoré (condition fausse)    |
| `directive:start` | Une directive commence                   |
| `directive:end`   | Une directive se termine                 |
| `parallel:start`  | Un bloc `@parallel` commence             |
| `parallel:end`    | Un bloc `@parallel` se termine           |
| `loop:iteration`  | Une itération de `@for`/`@repeat`        |
| `error`           | Une erreur se produit                    |

### Use Cases

| Use Case          | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| **Streaming CLI** | `run.ts` affiche les événements en temps réel avec spinners |
| **Monitoring**    | Observer la progression d'un workflow long                  |
| **Logging**       | Logger chaque step/directive pour audit                     |
| **UI updates**    | VS Code StatusBar / DAG Webview (v0.5.0+)                   |
| **Métriques**     | Mesurer la durée de chaque step                             |

---

## 7. Execution Control ✅

**Depuis**: v0.4.0 | **Fichiers**: `src/core/ports/execution-controller.port.ts`, `src/core/entities/cancellation-token.ts`

### ExecutionController API

```typescript
interface ExecutionController {
  pause(): void;
  resume(): void;
  cancel(): void;
  step(): void;
  isPaused(): boolean;
  isCancelled(): boolean;
  onPaused(listener: () => void): void;
  onResumed(listener: () => void): void;
}
```

### CancellationToken

```typescript
interface CancellationToken {
  isCancelled(): boolean;
  onCancelled(listener: () => void): void;
}

class CancellationTokenSource {
  get token(): CancellationToken;
  cancel(): void;
}
```

### Use Cases

| Use Case                   | Description                                                |
| -------------------------- | ---------------------------------------------------------- |
| **Pause interactive**      | L'utilisateur pause un workflow long pour inspecter l'état |
| **Step-by-step debugging** | Avancer une directive à la fois (`step()`)                 |
| **Annulation gracieuse**   | Stopper un workflow sans corrompre l'état                  |
| **Timeout**                | Annuler automatiquement après un délai                     |
| **VS Code integration**    | Boutons Pause/Resume/Stop dans l'extension                 |
| **@breakpoint**            | Pause automatique quand une condition est vraie            |

---

## 8. State Management ✅

**Depuis**: v0.1.0 | **Fichiers**: `src/core/ports/state-store.port.ts`, `src/adapters/state/memory-store.ts`

### StateStore API

```typescript
interface StateStore {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): void;
  getAll(): Record<string, unknown>;
  clear(): void;
  serialize(): string; // v0.4.0
  deserialize(data: string): void; // v0.4.0
}
```

### Implémentations

| Adapter       | Depuis            | Description                                   |
| ------------- | ----------------- | --------------------------------------------- |
| `MemoryStore` | v0.1.0            | `Map<string, unknown>` en mémoire — dev/tests |
| `SQLiteStore` | v1.0.0 (planifié) | Persistance disque — historique               |
| `RedisStore`  | v1.0.0 (planifié) | Distribué — équipe/enterprise                 |

### Use Cases

| Use Case                      | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| **Variables inter-steps**     | `$scan_result` défini au step 1, utilisé au step 3 |
| **Persistance mid-execution** | `serialize()` sauvegarde l'état pour reprise       |
| **Reprise après crash**       | `deserialize()` restaure et continue               |
| **Inspection debugging**      | `getAll()` expose toutes les variables             |

---

## 9. Tool Providers ✅

**Depuis**: v0.1.0 (shell) + v0.3.0 (MCP, composite) | **Fichiers**: `src/adapters/tools/`

### Shell Tool Provider

```markdown
@call shell.exec("ls -la") → $files
@call shell.read("config.json") → $config
```

| Feature           | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| Security-hardened | `execFileSync` (pas de shell), metachar rejection                |
| Allowlist         | Seuls les binaires autorisés (`ls`, `cat`, `grep`, `nmap`, etc.) |
| Timeout           | Configurable via `SHELL_TIMEOUT` (default: 30s)                  |
| MaxBuffer         | Configurable via `SHELL_MAX_BUFFER` (default: 10MB)              |
| Dry-run           | Retourne `[DRY-RUN] would execute: ...`                          |
| Sanitized env     | Variables sensibles filtrées                                     |

### Composite Tool Provider

Route `@call` par namespace :

- `shell.*` → Shell Tool Provider
- `mcp.*` → MCP Client Provider
- Extensible pour d'autres namespaces

### Use Cases

| Use Case                   | Description                                |
| -------------------------- | ------------------------------------------ |
| **Exécuter des commandes** | `@call shell.exec("nmap $target")`         |
| **Lire des fichiers**      | `@call shell.read("./config.json")`        |
| **Appeler des APIs MCP**   | `@call mcp.analyze($data)`                 |
| **Multi-source**           | Combiner shell + MCP dans le même workflow |

---

## 10. MCP Server ✅

**Depuis**: v0.3.0-alpha | **Fichier**: `src/adapters/tools/mcp-server.ts` (625 lignes)

### 5 Tools exposés

| Tool                   | Description            | Annotations                 |
| ---------------------- | ---------------------- | --------------------------- |
| `chainskills_run`      | Exécuter un workflow   | destructive, non-idempotent |
| `chainskills_validate` | Valider un workflow    | read-only, idempotent       |
| `chainskills_describe` | Introspection complète | read-only, idempotent       |
| `chainskills_list`     | Lister les workflows   | read-only, idempotent       |
| `chainskills_inspect`  | Structure DAG          | read-only, idempotent       |

### 2 Prompts exposés

| Prompt             | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `create_workflow`  | Générer un `.workflow.md` à partir d'une description |
| `explain_workflow` | Expliquer la structure d'un workflow existant        |

### Dynamic Resources

Chaque `.workflow.md` découvert dans le workspace est exposé comme une MCP resource (URI `chainskills://workflow/<path>`).

### Transports

| Transport       | Commande                        | Use Case                                 |
| --------------- | ------------------------------- | ---------------------------------------- |
| stdio           | `chainskills serve`             | Copilot, Claude Desktop, tout client MCP |
| Streamable HTTP | `chainskills serve --port 3001` | Intégration web, API REST-like           |

### Use Cases

| Use Case               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| **Copilot interop**    | Copilot découvre et utilise les workflows via MCP |
| **Claude Desktop**     | Ajouter chainskills comme tool dans Claude        |
| **CI/CD programmable** | Appeler `chainskills_run` depuis un script        |
| **Multi-agent**        | Un agent utilise chainskills comme outil          |

---

## 11. MCP Client ✅

**Depuis**: v0.3.0 | **Fichier**: `src/adapters/tools/mcp-client.ts`

### Fonctionnalités

| Feature         | Description                                         |
| --------------- | --------------------------------------------------- |
| Lazy connect    | Connexion au premier appel, pas au démarrage        |
| Tool discovery  | `listTools()` pour découvrir les outils disponibles |
| Stdio transport | Lance le serveur MCP comme sous-processus           |
| Multi-server    | Support de plusieurs serveurs MCP simultanés        |
| Graceful close  | `close()` pour fermeture propre                     |

### Configuration

```bash
MCP_SERVERS='[{"name": "analysis", "command": "npx", "args": ["-y", "analysis-server"]}]'
```

### Use Cases

| Use Case                        | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| **Appeler des outils externes** | `@call mcp.analyze($data)` appelle un serveur MCP tiers |
| **Composer des services**       | Combiner plusieurs serveurs MCP dans un workflow        |
| **Intégration existante**       | Réutiliser des MCP servers déjà déployés                |

---

## 12. Agent LLM (@agent / @handoff) ✅

**Depuis**: v0.3.0 | **Fichiers**: `src/core/ports/agent-provider.port.ts`, `src/adapters/agents/openai-agent.ts`

### AgentProvider Interface

```typescript
interface AgentProvider {
  invoke(options: AgentInvokeOptions): Promise<Result<AgentResult, AgentError>>;
  has(agent: string): boolean;
  list(): string[];
}
```

### Implémentations

| Adapter       | Description                                                         |
| ------------- | ------------------------------------------------------------------- |
| `OpenAIAgent` | Compatible OpenAI (GPT-4, Claude, Ollama, etc.) via `fetch()` natif |
| `NoopAgent`   | Stub déterministe pour tests et dry-run                             |

### Configuration

```bash
AGENT_API_KEY=sk-...          # Clé API (requis pour OpenAI agent)
AGENT_BASE_URL=https://api.openai.com/v1  # URL de l'API
AGENT_MODEL=gpt-4o            # Modèle à utiliser
```

### Agents par défaut

| Agent      | System Prompt                        |
| ---------- | ------------------------------------ |
| `copilot`  | Assistant technique polyvalent       |
| `reviewer` | Expert en code review et qualité     |
| `writer`   | Rédacteur technique et documentation |

### Use Cases

| Use Case         | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| **Code review**  | `@agent reviewer: "Review: $diff"` → analyse par IA                     |
| **Génération**   | `@agent writer: "Write docs for $code"` → documentation                 |
| **Raisonnement** | `@agent copilot: "Analyze $scan_result"` → recommandations              |
| **Multi-agent**  | `@agent analyst` → `@handoff reviewer` → pipeline d'agents              |
| **Dry-run**      | `NoopAgent` retourne des réponses déterministes (pas d'API key requise) |

---

## 13. Skill Resolution ✅

**Depuis**: v0.1.0 | **Fichier**: `src/adapters/skills/local-resolver.ts`

### SkillResolver Interface

```typescript
interface SkillResolver {
  resolve(ref: string): Promise<Result<ResolvedSkill, ResolveError>>;
}
```

### Fonctionnalités

| Feature                   | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| Local resolution          | `@use ./path/to/skill` → résolution relative            |
| Path traversal protection | Interdit la sortie du workspace (`../../../etc/passwd`) |
| Normalized base           | Résolution par rapport à la racine du projet            |

### Use Cases

| Use Case                   | Description                                         |
| -------------------------- | --------------------------------------------------- |
| **Réutiliser un workflow** | `@use ./lib/common-checks` dans plusieurs workflows |
| **Composition**            | Assembler des skills locaux en workflows complexes  |
| **Monorepo**               | Partager des skills entre sous-projets              |

---

## 14. Template Engine & Condition Parser ✅

**Depuis**: v0.1.0 | **Fichiers**: `src/core/services/template-engine.ts`, `condition-parser.ts`

### Template Engine

```typescript
substituteVariables(text: string, state: StateStore): string
extractVariables(text: string): string[]
```

- Substitue `$variable` par la valeur du `StateStore`
- Extrait toutes les variables référencées dans un texte
- Supporte les propriétés imbriquées : `$result.score`, `$data.items`

### Condition Parser

```typescript
evaluateCondition(condition: string, state: StateStore): boolean
```

- Évalue les expressions booléennes : `$score > 80 && $passed == true`
- Opérateurs : `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`, `!`
- Type coercion : comparaison numérique, string, booléen

### Use Cases

| Use Case                   | Description                             |
| -------------------------- | --------------------------------------- |
| **Variable substitution**  | `"nmap $target"` → `"nmap 192.168.1.1"` |
| **Conditions @if**         | `$risk > 5` évalué dynamiquement        |
| **Conditions @repeat**     | `until $tests_pass == true`             |
| **Conditions @assert**     | `$total == $expected`                   |
| **Conditions @breakpoint** | `$count > 10`                           |

---

## 15. Validation ✅

**Depuis**: v0.1.0 | **Fichier**: `src/core/use-cases/validate-workflow.ts`

### Fonctionnalités

| Check                | Description                                           |
| -------------------- | ----------------------------------------------------- |
| Frontmatter validity | `name`, `description`, `version` requis et bien typés |
| Directive syntax     | Types de directives reconnus, arguments valides       |
| Variable references  | `$undefined_var` → warning                            |
| Step structure       | Au moins 1 step, headings valides                     |
| Cycle detection      | Via le DAG builder                                    |

### Use Cases

| Use Case                  | Description                                       |
| ------------------------- | ------------------------------------------------- |
| **Lint avant exécution**  | `chainskills validate workflow.md` en CI          |
| **Auto-validate on save** | Extension VS Code valide à chaque sauvegarde      |
| **IDE diagnostics**       | Erreurs/warnings affichés dans l'éditeur (v0.5.0) |
| **MCP validation**        | `chainskills_validate` tool pour Copilot          |

---

## 16. CLI Commands (6) ✅

**Depuis**: v0.1.0 (3) → v0.2.0 (5) → v0.3.0 (6) | **Fichiers**: `src/cli/*.ts`

### `chainskills run`

```bash
chainskills run workflow.md --input target=example.com
chainskills run workflow.md --dry-run
chainskills run workflow.md --json
chainskills run workflow.md --format=vscode
```

| Option              | Description                    |
| ------------------- | ------------------------------ |
| `--input key=value` | Variables d'entrée             |
| `--dry-run`         | Simulation sans effets         |
| `--json`            | Sortie JSON machine-readable   |
| `--format=vscode`   | Format Problem Matcher VS Code |

---

### `chainskills validate`

```bash
chainskills validate workflow.md
chainskills validate workflow.md --json
chainskills validate workflow.md --format=vscode
```

| Option            | Description                        |
| ----------------- | ---------------------------------- |
| `--json`          | Résultat de validation en JSON     |
| `--format=vscode` | `file:line:col: severity: message` |

---

### `chainskills inspect`

```bash
chainskills inspect workflow.md
chainskills inspect workflow.md --json
```

Affiche le DAG en ASCII art avec caractères box-drawing :

```
╔══════════════════════════════════════╗
║  code-review-pipeline v1.0.0        ║
╠══════════════════════════════════════╣
║                                      ║
║  ● get-changed-files                 ║
║  │                                   ║
║  ═══ @parallel ═══                   ║
║  ├─ ● lint                           ║
║  ├─ ● tests                          ║
║  └─ ● security                       ║
║  ═══════════════════                 ║
║  │                                   ║
║  ◇ evaluate [if]                     ║
║                                      ║
╚══════════════════════════════════════╝
```

---

### `chainskills init`

```bash
chainskills init my-workflow
```

Génère un fichier `my-workflow.workflow.md` avec un template de base (frontmatter + 2 steps).

---

### `chainskills list`

```bash
chainskills list
chainskills list --json
chainskills list -g
```

Liste tous les `.workflow.md` dans le répertoire courant (récursif) avec métadonnées frontmatter.

---

### `chainskills serve`

```bash
chainskills serve              # stdio (pour Copilot, Claude Desktop)
chainskills serve --port 3001  # HTTP (pour intégration web)
```

Expose toutes les fonctionnalités comme serveur MCP (5 tools, 2 prompts, dynamic resources).

---

## 17. SDK API ✅

**Depuis**: v0.3.0 | **Fichier**: `src/core/use-cases/run-workflow.ts`

### Functions

```typescript
import {
  runWorkflow,
  describeWorkflow,
  parseWorkflow,
  validateWorkflow,
  buildDAG,
} from "chainskills";

// Exécuter un workflow par chemin
const result = await runWorkflow("./workflow.md", { target: "example.com" });

// Décrire la structure d'un workflow
const description = await describeWorkflow("./workflow.md");

// Parser depuis une string
const workflow = parseWorkflow(source);

// Valider
const report = validateWorkflow(workflow);

// Construire le DAG
const dag = buildDAG(workflow);
```

### Exports publics (src/index.ts)

| Catégorie     | Exports                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entities**  | `Workflow`, `WorkflowMetadata`, `Step`, `Directive`, `DirectiveType`, `Variable`, `InputDef`, `OutputDef`                                   |
| **Ports**     | `WorkflowParser`, `WorkflowExecutor`, `StateStore`, `ToolProvider`, `SkillResolver`, `AgentProvider`, `ExecutionEventEmitter`               |
| **Use Cases** | `parseWorkflow`, `validateWorkflow`, `buildDAG`, `runWorkflow`, `describeWorkflow`                                                          |
| **Services**  | `substituteVariables`, `extractVariables`, `evaluateCondition`                                                                              |
| **Result**    | `Result`, `Ok`, `Err`, `ok`, `err`, `isOk`, `isErr`, `map`, `flatMap`, `mapErr`, `unwrapOr`, `match`                                        |
| **Config**    | `createContainer`, `Container`                                                                                                              |
| **Adapters**  | `createMastraExecutor`, `createMcpServer`, `createOpenAIAgent`, `createNoopAgent`, `createMcpClientProvider`, `createCompositeToolProvider` |
| **Events**    | `createEventEmitter`, `ExecutionEvent`, `ExecutionEventType`                                                                                |

### Use Cases

| Use Case                       | Description                                                      |
| ------------------------------ | ---------------------------------------------------------------- |
| **Intégration programmatique** | Utiliser chainskills comme librairie dans une app Node.js        |
| **MCP server**                 | Le MCP server utilise le SDK en interne                          |
| **VS Code extension**          | L'extension importera le SDK pour le parsing in-process (v0.5.0) |
| **Tests**                      | Tester des workflows depuis du code TypeScript                   |

---

## 18. Result Monad ✅

**Depuis**: v0.1.0 (base) + v0.2.1 (utilities) | **Fichier**: `src/infrastructure/errors.ts`

### Type

```typescript
type Result<T, E> = Ok<T> | Err<E>;
interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}
interface Err<E> {
  readonly ok: false;
  readonly error: E;
}
```

### Utilities

| Function                     | Description                              |
| ---------------------------- | ---------------------------------------- |
| `ok(value)`                  | Crée un `Ok<T>`                          |
| `err(error)`                 | Crée un `Err<E>`                         |
| `isOk(result)`               | Type guard pour `Ok`                     |
| `isErr(result)`              | Type guard pour `Err`                    |
| `map(result, fn)`            | Transforme la valeur si `Ok`             |
| `flatMap(result, fn)`        | Chaîne des opérations `Result`           |
| `mapErr(result, fn)`         | Transforme l'erreur si `Err`             |
| `unwrapOr(result, default)`  | Extrait la valeur ou retourne un default |
| `unwrapOrElse(result, fn)`   | Extrait la valeur ou calcule un default  |
| `match(result, { ok, err })` | Pattern matching exhaustif               |

### Domain Error Types

| Type              | Champs                         |
| ----------------- | ------------------------------ |
| `ParseError`      | `message`, `line?`, `column?`  |
| `ValidationError` | `message`, `field?`            |
| `ExecutionError`  | `message`, `stepId?`, `cause?` |
| `ResolveError`    | `message`, `ref?`              |
| `ToolError`       | `message`, `tool?`, `method?`  |

### Use Cases

| Use Case                           | Description                                                |
| ---------------------------------- | ---------------------------------------------------------- |
| **Error handling sans exceptions** | Le domaine retourne `Result`, jamais `throw`               |
| **Chaîner des opérations**         | `map(parseResult, workflow => validateWorkflow(workflow))` |
| **Pattern matching**               | `match(result, { ok: v => ..., err: e => ... })`           |
| **Valeurs par défaut**             | `unwrapOr(result, defaultValue)`                           |

---

## 19. Logger ✅

**Depuis**: v0.1.0 | **Fichier**: `src/infrastructure/logger.ts`

### Interface

```typescript
interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(correlationId: string): Logger;
}
```

### Fonctionnalités

| Feature         | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| Structured JSON | Sortie JSON sur `stderr`                                         |
| Log levels      | `debug < info < warn < error` (configurable via `APP_LOG_LEVEL`) |
| Correlation ID  | `child()` crée un logger avec un ID de corrélation               |
| Zero secrets    | Jamais de données sensibles dans les logs                        |

### Use Cases

| Use Case           | Description                                         |
| ------------------ | --------------------------------------------------- |
| **Debug**          | `logger.debug("Parsing step", { stepId })`          |
| **Audit**          | `logger.info("Workflow started", { name, inputs })` |
| **Error tracking** | `logger.error("Step failed", { error, stepId })`    |
| **Corrélation**    | Tracer une exécution avec un ID unique              |

---

## 20. DI Container ✅

**Depuis**: v0.1.0 | **Fichier**: `src/config/container.ts`

### Container Interface

```typescript
interface Container {
  config: AppConfig;
  logger: Logger;
  parser: WorkflowParser;
  executor: WorkflowExecutor;
  store: StateStore;
  tools: ToolProvider;
  resolver: SkillResolver;
  emitter: ExecutionEventEmitter;
  agent: AgentProvider;
}
```

### Wiring (createContainer)

```
env vars → AppConfig → Logger
                     → MemoryStore
                     → ShellToolProvider + MCP Client → CompositeToolProvider
                     → MarkdownParser
                     → EventEmitter
                     → LocalResolver
                     → OpenAI/Noop Agent
                     → Simple/Mastra Executor (Strategy Pattern)
```

### Use Cases

| Use Case          | Description                                             |
| ----------------- | ------------------------------------------------------- |
| **Bootstrap CLI** | `createContainer()` configure tout en une ligne         |
| **Tests**         | `createContainer({ tools: mockToolProvider })` override |
| **SDK**           | `createContainer({ executor: 'simple' })` customisation |
| **Extension**     | L'extension créera un container in-process (v0.5.0)     |

---

## 21. Security ✅

**Depuis**: v0.2.1 | **Fichiers**: Plusieurs

### Mesures implémentées

| Mesure                 | Description                                      | Fichier                                |
| ---------------------- | ------------------------------------------------ | -------------------------------------- | ------------------------ |
| **execFileSync**       | Pas de shell interprété, exécution directe       | `shell-tool-provider.ts`               |
| **Binary allowlist**   | Seuls les binaires autorisés (`ls`, `cat`, etc.) | `shell-tool-provider.ts`               |
| **Metachar rejection** | `;`, `                                           | `, `&`, `\``, `$(`, `>`, `<` interdits | `shell-tool-provider.ts` |
| **Scoped @env**        | Seules les env vars déclarées en frontmatter     | `directive-handlers.ts`                |
| **Path traversal**     | `startsWith(normalizedBase)`                     | `local-resolver.ts`                    |
| **Sanitized env**      | Variables sensibles filtrées du sous-processus   | `shell-tool-provider.ts`               |
| **No secrets in logs** | Logger structuré, zéro données sensibles         | `logger.ts`                            |
| **Result pattern**     | Pas d'exceptions pour le flux métier             | `errors.ts`                            |

### Use Cases

| Use Case             | Description                                          |
| -------------------- | ---------------------------------------------------- |
| **Exécution sûre**   | Les commandes shell sont sandboxées                  |
| **Multi-tenant**     | Chaque workflow n'accède qu'à ses propres env vars   |
| **Open source safe** | Le codebase peut être ouvert sans exposer de secrets |

---

## 22. VS Code Extension ⏭️

**Depuis**: v0.4.0 | **Repo**: `../vscode-extension/`

### Contribution Points

| Type            | Nombre | Détail                                                                                     |
| --------------- | ------ | ------------------------------------------------------------------------------------------ |
| Commands        | 10     | run, runDryRun, validate, inspect, pause/resume/stop/step, openTemplates, refreshWorkflows |
| TreeView        | 1      | `chainskillsWorkflows` dans l'Explorer                                                     |
| Problem Matcher | 1      | `$chainskills` — parse `file:line:col: severity: message`                                  |
| Task Definition | 1      | type `chainskills` avec workflow/inputs/dryRun                                             |
| Configuration   | 5      | cliPath, executor, autoValidate, showDagOnInspect, templatesPath                           |
| Language        | 1      | `workflow-markdown` (`.workflow.md`)                                                       |
| Grammar         | 1      | TextMate (17 directives + variables + blocks)                                              |

### Source Files (4)

| Fichier                   | Lignes | Rôle                                                |
| ------------------------- | ------ | --------------------------------------------------- |
| `extension.ts`            | 60     | Activation, registration de tous les composants     |
| `commands.ts`             | ~230   | 10 command handlers (appel CLI via `child_process`) |
| `tree-provider.ts`        | ~100   | WorkflowTreeProvider (discovery + metadata parsing) |
| `execution-controller.ts` | ~65    | POSIX signals (SIGSTOP/SIGCONT/SIGTERM)             |

### Use Cases

| Use Case                      | Description                                             |
| ----------------------------- | ------------------------------------------------------- |
| **Développer des workflows**  | Syntax highlighting + auto-validate = feedback immédiat |
| **Exécuter depuis l'éditeur** | Bouton ▶ dans la barre d'outils                         |
| **Explorer les workflows**    | TreeView dans l'Explorer avec métadonnées               |
| **Debugger**                  | Pause/Resume/Stop pendant l'exécution                   |
| **Templates**                 | Browse et ouvrir des templates pré-packagés             |

---

## 23. Templates (7) ✅

**Depuis**: v0.1.0 (4) → v0.2.0 (6) → v0.4.0 (7) | **Dossier**: `templates/`

| Template                             | Catégorie     | Directives utilisées                             |
| ------------------------------------ | ------------- | ------------------------------------------------ |
| `dev/code-review.workflow.md`        | Développement | `@use`, `@call`, `@parallel`, `@if`, `@output`   |
| `dev/tdd-cycle.workflow.md`          | Développement | `@repeat max:5 until`, `@call`, `@if`            |
| `dev/nextjs-app-builder.workflow.md` | Développement | `@agent`, `@call`, `@if`, `@parallel` (22 steps) |
| `cybersec/recon-target.workflow.md`  | Cybersécurité | `@call`, `@for`, `@parallel`, `@output`          |
| `cybersec/vuln-scan.workflow.md`     | Cybersécurité | `@for`, `@if`, `@try`, `@call`, `@output`        |
| `osint/domain-recon.workflow.md`     | OSINT         | `@call`, `@parallel`, `@for`, `@output`          |
| `ess/grant-application.workflow.md`  | ESS           | `@try`, `@parallel`, `@assert`, `@output`        |

### Use Cases

| Use Case             | Description                                   |
| -------------------- | --------------------------------------------- |
| **Démarrage rapide** | `chainskills init` → template prêt à l'emploi |
| **Apprentissage**    | Exemples concrets de toutes les directives    |
| **Démonstration**    | Showcase des capacités du framework           |
| **Base de travail**  | Copier et adapter un template existant        |

---

## 24. Architecture ✅

### Hexagonal (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────────────┐
│  VS Code Extension Layer (../vscode-extension/)                               │
│  10 Commands | TreeView | TextMate Grammar | Problem Matcher        │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ child_process.exec (v0.4.0)
                       │ → library import (v0.5.0)
┌──────────────────────▼──────────────────────────────────────────────┐
│  CLI Layer (Citty)                                                  │
│  run | validate | inspect | list | serve | init                     │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────┐
│  Core (domaine pur — zéro dépendance)                               │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐             │
│  │ Entities │ │ Use Cases│ │ Services   │ │ Ports    │             │
│  │ Workflow │ │ Parse    │ │ Template   │ │ 8 ports  │             │
│  │ Step     │ │ BuildDAG │ │ Condition  │ │ abstract │             │
│  │ Directive│ │ Validate │ │ Engine     │ │          │             │
│  │ Variable │ │ Run      │ │            │ │          │             │
│  │ Cancel   │ │ Describe │ │            │ │          │             │
│  └──────────┘ └──────────┘ └────────────┘ └──────────┘             │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ Ports & Adapters
┌──────────────────────▼──────────────────────────────────────────────┐
│  Adapters                                                           │
│  ┌─────────┐ ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌────────┐ │
│  │ Remark  │ │ Mastra  │ │ MCP  │ │ Skills │ │ State│ │ Agent  │ │
│  │ Parser  │ │ Executor│ │ S+C  │ │ Local  │ │ Mem  │ │ OpenAI │ │
│  │         │ │ Simple  │ │      │ │        │ │      │ │ Noop   │ │
│  └─────────┘ └─────────┘ └──────┘ └────────┘ └──────┘ └────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Ports (8 interfaces abstraites)

| Port       | Interface               | Implémentation(s)                                                 |
| ---------- | ----------------------- | ----------------------------------------------------------------- |
| Parser     | `WorkflowParser`        | `MarkdownParser` (remark)                                         |
| Executor   | `WorkflowExecutor`      | `SimpleExecutor`, `MastraExecutor`                                |
| State      | `StateStore`            | `MemoryStore`                                                     |
| Tools      | `ToolProvider`          | `ShellToolProvider`, `McpClientProvider`, `CompositeToolProvider` |
| Skills     | `SkillResolver`         | `LocalResolver`                                                   |
| Events     | `ExecutionEventEmitter` | `EventEmitter` (Node.js)                                          |
| Agent      | `AgentProvider`         | `OpenAIAgent`, `NoopAgent`                                        |
| Controller | `ExecutionController`   | Inline implementation in executors                                |

### Métriques (v0.4.0)

| Métrique                    | Valeur                        |
| --------------------------- | ----------------------------- |
| Tests                       | 197/197 passing (17 fichiers) |
| Typecheck                   | 0 erreurs                     |
| Build (CLI)                 | 5 bundles — 830 KB            |
| Build (Extension)           | webpack → 23 KB               |
| Fichiers source (CLI)       | ~65 TypeScript                |
| Fichiers source (Extension) | 4 TypeScript                  |
| Directives                  | 17 types                      |
| CLI commands                | 6                             |
| MCP tools                   | 5                             |
| MCP prompts                 | 2                             |
| Event types                 | 11                            |
| Ports                       | 8                             |
| Adapters                    | 10                            |
| Templates                   | 7                             |
