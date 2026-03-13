# Propositions d'evolution — ChainSkills v0.7+

> Basé sur une recherche SOTA approfondie (mars 2026) des architectures agentiques,
> systèmes de mémoire, context engineering, et agents auto-évolutifs.

---

## Vision rappel

ChainSkills = **couche de fiabilisation des AI agents** par workflows validés et reproductibles.
L'agent accumule un capital de workflows prouvés et apprend de ses erreurs.
Le but n'est pas de remplacer les agents, mais de leur ajouter ce qui leur manque.

---

## Proposition 1 — Mémoire Agentique (A-Mem + MemRL)

### Le problème
Aujourd'hui ChainSkills exécute des workflows en mode stateless. Chaque run repart de zéro.
L'agent ne se souvient pas de ce qui a marché ou échoué.

### La solution : 3 couches de mémoire

Inspiré de [A-Mem (NeurIPS 2025)](https://arxiv.org/abs/2502.12110) et [MemRL (Jan 2026)](https://arxiv.org/abs/2601.03192).

```
┌─────────────────────────────────────────────────────┐
│                  MEMORY LAYERS                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. EPISODIC MEMORY (court terme)                    │
│     Quoi : Log structuré de chaque run               │
│     Contenu : inputs, outputs, durée, succès/échec,  │
│               erreurs, trace des directives           │
│     Stockage : SQLite local (.chainskills/runs.db)   │
│     Usage : Replay, debug, comparaison               │
│                                                      │
│  2. SEMANTIC MEMORY (long terme)                     │
│     Quoi : Base de connaissances des workflows        │
│     Contenu : Patterns qui marchent, anti-patterns,   │
│               associations domaine↔workflow            │
│     Stockage : Embeddings + ChromaDB local            │
│     Usage : Suggestion de workflow pour une tâche      │
│                                                      │
│  3. PROCEDURAL MEMORY (savoir-faire)                 │
│     Quoi : Workflows validés avec score d'utilité     │
│     Contenu : Le workflow + son historique de runs     │
│               + score Q-value (MemRL)                 │
│     Stockage : Fichiers .workflow.md + métadonnées    │
│     Usage : L'agent choisit LE BON workflow           │
│             pour une tâche donnée                     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Impact sur le format `.workflow.md`

Nouveaux champs frontmatter :

```yaml
---
name: code-review
# ... champs existants ...

# NOUVEAU — Validation & reproductibilité
status: validated          # draft | validated | deprecated
validatedBy: TheWatcher01
validatedAt: 2026-03-13
validationHash: sha256:abc123...

# NOUVEAU — Mémoire & apprentissage
memory:
  runCount: 47
  successRate: 0.94
  avgDuration: 12400       # ms
  lastRun: 2026-03-12
  qValue: 0.87             # score d'utilité appris (MemRL)
  tags: [typescript, review, quality]
---
```

### Implémentation

| Composant | Port (interface) | Adapter initial |
|---|---|---|
| Episodic Memory | `MemoryStore` port | SQLite (better-sqlite3) |
| Semantic Memory | `SemanticIndex` port | ChromaDB local ou simple TF-IDF |
| Procedural Memory | Extension du frontmatter | Fichier JSON sidecar `.meta.json` |
| Q-Value updater | `UtilityTracker` port | Algorithme MemRL simplifié |

### Nouveau port core

```typescript
interface MemoryStore {
  recordRun(run: RunRecord): Promise<void>;
  getRuns(workflowName: string, limit?: number): Promise<RunRecord[]>;
  getSuccessRate(workflowName: string): Promise<number>;
  findSimilarWorkflows(task: string, topK?: number): Promise<ScoredWorkflow[]>;
  updateUtility(workflowName: string, reward: number): Promise<void>;
}
```

---

## Proposition 2 — Reflexion & Auto-correction (Meta-Policy Reflexion)

### Le problème
Quand un workflow échoue, l'agent ne sait pas POURQUOI ni comment éviter de refaire la même erreur.

### La solution : boucle de réflexion

Inspiré de [Meta-Policy Reflexion (Sep 2025)](https://arxiv.org/abs/2509.03990) et [SAGE](https://arxiv.org/abs/2409.00872).

```
Workflow échoue
    ↓
@reflect : L'agent analyse l'échec
    ↓
Génère une "règle corrective" (predicate-like)
    Ex: "IF @call shell.exec AND timeout > 30s THEN split_into_subtasks"
    ↓
Stocke dans Meta-Policy Memory (MPM)
    ↓
Prochaine exécution : règles MPM injectées en contexte
    ↓
Hard Admissibility Check (HAC) :
    Bloque les actions qui violent une règle apprise
```

### Nouvelles directives

```markdown
# Après un @try/@on-error, déclencher une réflexion
@reflect: "Analyser pourquoi $error s'est produit et proposer une correction"
  → $reflection

# Appliquer les règles apprises (automatique ou explicite)
@guard $action against $learned_rules
```

### Nouvelle directive `@reflect`

| Attribut | Type | Description |
|---|---|---|
| `prompt` | string | Question de réflexion |
| `context` | string[] | Variables à inclure dans l'analyse |
| `store` | boolean | Sauvegarder la réflexion en mémoire (défaut: true) |
| `capture` | string | Variable de capture → $reflection |

### Implémentation

```typescript
interface ReflectionEngine {
  reflect(context: ReflectionContext): Promise<Reflection>;
  getRelevantRules(task: string): Promise<Rule[]>;
  applyHardCheck(action: Action, rules: Rule[]): AdmissibilityResult;
}

interface Reflection {
  cause: string;           // Pourquoi ça a échoué
  rule: string;            // Règle corrective générée
  confidence: number;      // 0-1
  applicability: string[]; // Tags des workflows concernés
}
```

---

## Proposition 3 — Auto-génération de Workflows (EvoAgentX-inspired)

### Le problème
Aujourd'hui les workflows sont écrits manuellement. L'agent devrait pouvoir
générer lui-même de nouveaux workflows à partir de tâches répétitives observées.

### La solution : Workflow Evolution Engine

Inspiré de [EvoAgentX (EMNLP 2025)](https://aclanthology.org/2025.emnlp-demos.47/).

```
L'agent observe des patterns répétitifs
    ↓
@evolve : Propose un nouveau workflow draft
    ↓
Humain review + valide (ou rejette)
    ↓
Si validé → rejoint le capital de workflows
    ↓
Optimisation itérative (TextGrad/AFlow-style)
    ↓
Le workflow s'améliore à chaque run
```

### Nouvelle commande CLI

```bash
# Générer un workflow à partir d'une description
chainskills generate "review de code TypeScript avec lint, security et tests"
  → Génère un .workflow.md draft basé sur le capital existant

# Optimiser un workflow existant basé sur l'historique des runs
chainskills optimize code-review.workflow.md
  → Analyse les runs passés, propose des améliorations

# Apprendre des sessions Copilot (analyse du chat history)
chainskills learn --from-history .vscode/copilot-chat-history.json
  → Extrait les patterns répétitifs → propose des workflows
```

### Nouvelle directive `@evolve`

```markdown
# Dans un workflow meta
@evolve from $task_description using $existing_workflows → $new_workflow

# Optimiser un step spécifique
@evolve optimize $step_id based_on $run_history → $improved_step
```

### Implémentation

```typescript
interface WorkflowEvolver {
  generate(description: string, context: EvolverContext): Promise<Result<Workflow, EvolveError>>;
  optimize(workflow: Workflow, history: RunRecord[]): Promise<Result<Workflow, EvolveError>>;
  extractPatterns(chatHistory: ChatMessage[]): Promise<WorkflowPattern[]>;
}
```

---

## Proposition 4 — Context Engineering Layer

### Le problème
Les workflows injectent tout le contexte d'un coup dans le LLM.
Le context window est gaspillé, les résultats dérivent.

### La solution : gestion intelligente du contexte

Inspiré de [Anthropic Context Engineering (Sep 2025)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
et des leçons de [Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus).

### 4 stratégies intégrées au runtime

```
┌──────────────────────────────────────────────────────┐
│            CONTEXT ENGINEERING PIPELINE                │
├──────────────────────────────────────────────────────┤
│                                                       │
│  1. WRITE — Sauvegarder le contexte hors window       │
│     @snapshot $state → .chainskills/snapshots/         │
│     Permet de reprendre un workflow après interruption │
│                                                       │
│  2. SELECT — Injecter uniquement le pertinent          │
│     Avant chaque @agent, sélectionner les variables    │
│     et le contexte réellement nécessaires              │
│     (pas tout le state store)                          │
│                                                       │
│  3. COMPRESS — Résumer l'historique                     │
│     Après N steps, compresser les résultats passés     │
│     en résumé pour libérer de l'espace contexte        │
│                                                       │
│  4. ISOLATE — Séparer les contextes par sous-tâche     │
│     Chaque @parallel branch a son propre contexte      │
│     isolé (déjà en partie fait via le DAG)             │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Nouvelles directives

```markdown
# Sauvegarder un snapshot de l'état courant
@snapshot "checkpoint-after-analysis"

# Reprendre depuis un snapshot
@restore "checkpoint-after-analysis"

# Compresser le contexte (résumer les N derniers résultats)
@compress last:5 into $summary

# Sélectionner le contexte pour un @agent
@agent copilot with context($relevant_var1, $relevant_var2): "task"
```

---

## Proposition 5 — Guardrails & Validation Déterministe

### Le problème
Les LLM peuvent halluciner même dans un workflow validé.
Il faut des garde-fous HORS du LLM.

### La solution : validation neurosymbolique

Inspiré de la recherche sur les [guardrails déterministes (2026)](https://promptengineering.org/agents-at-work-the-2026-playbook-for-building-reliable-agentic-workflows/)
et l'approche [neurosymbolique](https://dev.to/aws/ai-agent-guardrails-rules-that-llms-cannot-bypass-596d).

### Nouvelles directives

```markdown
# Valider la sortie d'un @agent contre un schéma JSON
@validate $agent_output against schema:ReviewReport

# Définir un garde-fou qui ne peut PAS être contourné par le LLM
@guardrail no-destructive-commands:
  deny: [rm -rf, DROP TABLE, git push --force]
  on-violation: abort

# Vérifier la cohérence entre deux résultats
@consistency-check $result1 vs $result2:
  tolerance: 0.05
  on-mismatch: retry(max:2)

# Sortie structurée obligatoire
@output schema:
  report: { type: string, minLength: 100 }
  score: { type: number, min: 0, max: 1 }
  passed: { type: boolean }
```

### Nouveau port core

```typescript
interface GuardrailEngine {
  validateSchema(output: unknown, schema: JSONSchema): ValidationResult;
  checkAdmissibility(action: Action, rules: GuardrailRule[]): AdmissibilityResult;
  consistencyCheck(a: unknown, b: unknown, tolerance: number): ConsistencyResult;
}
```

---

## Proposition 6 — Hooks d'Apprentissage (Feedback Loop)

### Le problème
L'humain valide ou rejette un résultat, mais cette information est perdue.

### La solution : hooks de feedback intégrés au cycle de vie

```
┌──────────────────────────────────────────────────────┐
│            LEARNING FEEDBACK LOOP                     │
├──────────────────────────────────────────────────────┤
│                                                       │
│  workflow:end                                         │
│    ↓                                                  │
│  @on-complete hook :                                  │
│    - Enregistrer le run en mémoire épisodique         │
│    - Calculer le reward (succès/échec/partiel)        │
│    - Mettre à jour le Q-value du workflow (MemRL)     │
│    ↓                                                  │
│  SI échec → @reflect automatique                      │
│    - Analyser la cause                                │
│    - Générer une règle corrective                     │
│    - Stocker dans Meta-Policy Memory                  │
│    ↓                                                  │
│  SI succès répété (3+ runs OK) → proposer validation  │
│    - Notifier l'humain : "Ce workflow a réussi        │
│      3 fois de suite, voulez-vous le valider ?"       │
│    ↓                                                  │
│  SI pattern répétitif détecté → proposer @evolve      │
│    - "Vous avez exécuté des tâches similaires 5 fois, │
│      voulez-vous créer un workflow ?"                  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Nouveaux hooks dans le frontmatter

```yaml
---
name: code-review
# ...
hooks:
  on-complete:
    - record-run           # Enregistrer en mémoire
    - update-utility       # Mettre à jour Q-value
  on-failure:
    - reflect              # Réflexion automatique
    - notify-human         # Notification
  on-validated:
    - promote-to-capital   # Ajouter au capital
    - index-semantic       # Indexer pour recherche
---
```

---

## Proposition 7 — Workflow Discovery & Matching

### Le problème
L'agent a un capital de 50 workflows mais ne sait pas lequel utiliser.

### La solution : moteur de matching sémantique

```bash
# L'utilisateur décrit une tâche
chainskills suggest "je veux review le code du module auth"

# ChainSkills cherche dans le capital
> Workflows correspondants :
>   1. code-review (Q=0.87, 94% succès) — RECOMMANDÉ
>   2. security-scan (Q=0.72, 88% succès) — Partiel
>   3. tdd-cycle (Q=0.65, 91% succès) — Alternatif
```

### Implémentation

```typescript
interface WorkflowMatcher {
  suggest(task: string, topK?: number): Promise<ScoredWorkflow[]>;
  rank(workflows: Workflow[], task: string): Promise<ScoredWorkflow[]>;
}

interface ScoredWorkflow {
  workflow: Workflow;
  relevanceScore: number;    // Similarité sémantique
  utilityScore: number;      // Q-value (MemRL)
  successRate: number;       // Historique
  combinedScore: number;     // Weighted blend
}
```

---

## Proposition 8 — Multi-Agent Orchestration Améliorée

### Le problème
`@agent` et `@handoff` sont limités à des appels simples.
Les recherches montrent que le multi-agent avec rôles spécialisés
donne des résultats 80x meilleurs que le single-agent.

### La solution : patterns multi-agent enrichis

Inspiré de [MyAntFarm.ai (Nov 2025)](https://arxiv.org/abs/2511.15755) — 100% actionable
rate avec multi-agent vs 1.7% en single-agent.

### Nouvelles directives

```markdown
# Définir un ensemble d'agents avec rôles
@team review-team:
  critic: { role: "Trouver les bugs", model: "claude-sonnet" }
  defender: { role: "Défendre le code", model: "claude-haiku" }
  judge: { role: "Arbitrer", model: "claude-opus" }

# Débat multi-agent (Multi-Agent Reflexion)
@debate $code_snippet using $review-team rounds:3 → $consensus

# Vote majoritaire (self-consistency)
@vote count:5: "Est-ce que ce code est sécurisé ? $code" → $verdict

# Pipeline de validation en chaîne
@chain:
  @agent writer: "Écris le code" → $code
  @agent reviewer: "Review $code" → $review
  @agent fixer: "Corrige $code selon $review" → $final_code
```

---

## Résumé des propositions

| # | Proposition | Fondement SOTA | Priorité | Complexité |
|---|---|---|---|---|
| 1 | Mémoire Agentique | A-Mem, MemRL | **P0** | Haute |
| 2 | Reflexion & Auto-correction | Meta-Policy Reflexion, SAGE | **P0** | Moyenne |
| 3 | Auto-génération de Workflows | EvoAgentX | P1 | Haute |
| 4 | Context Engineering Layer | Anthropic, Manus | P1 | Moyenne |
| 5 | Guardrails & Validation | Neurosymbolic, GraphBit | **P0** | Moyenne |
| 6 | Hooks d'Apprentissage | MemRL feedback loop | P1 | Basse |
| 7 | Workflow Discovery | Semantic search + MemRL | P2 | Moyenne |
| 8 | Multi-Agent Orchestration | MyAntFarm.ai, MAR | P2 | Haute |

---

## Sources

### Papers
- [A-Mem: Agentic Memory for LLM Agents (NeurIPS 2025)](https://arxiv.org/abs/2502.12110)
- [MemRL: Self-Evolving Agents via Runtime RL (Jan 2026)](https://arxiv.org/abs/2601.03192)
- [Meta-Policy Reflexion (Sep 2025)](https://arxiv.org/abs/2509.03990)
- [SAGE: Self-evolving Agents (Neurocomputing 2025)](https://arxiv.org/abs/2409.00872)
- [EvoAgentX (EMNLP 2025)](https://aclanthology.org/2025.emnlp-demos.47/)
- [Multi-Agent LLM Orchestration for Deterministic Decision Support (Nov 2025)](https://arxiv.org/abs/2511.15755)
- [Memory in the Age of AI Agents: A Survey (Dec 2025)](https://github.com/Shichun-Liu/Agent-Memory-Paper-List)
- [Self-Evolving AI Agents Survey (Aug 2025)](https://github.com/EvoAgentX/Awesome-Self-Evolving-Agents)

### Industry & Engineering
- [Anthropic: Effective Context Engineering for AI Agents (Sep 2025)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Manus: Context Engineering Lessons (2025)](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)
- [LangChain: Context Engineering for Agents](https://blog.langchain.com/context-engineering-for-agents/)
- [Kubiya: Deterministic AI Architecture (2025)](https://www.kubiya.ai/blog/deterministic-ai-architecture)
- [2026 Playbook for Reliable Agentic Workflows](https://promptengineering.org/agents-at-work-the-2026-playbook-for-building-reliable-agentic-workflows/)
- [AI Agents in Production: What Works in 2026](https://47billion.com/blog/ai-agents-in-production-frameworks-protocols-and-what-actually-works-in-2026/)
- [GraphBit: Deterministic Tools + LLM Orchestration (Dec 2025)](https://www.marktechpost.com/2025/12/27/how-to-build-production-grade-agentic-workflows-with-graphbit-using-deterministic-tools-validated-execution-graphs-and-optional-llm-orchestration/)
- [AI Agent Guardrails That LLMs Cannot Bypass (AWS)](https://dev.to/aws/ai-agent-guardrails-rules-that-llms-cannot-bypass-596d)
- [The 2026 Guide to AI Agent Workflows (Vellum)](https://www.vellum.ai/blog/agentic-workflows-emerging-architectures-and-design-patterns)
- [Practical Architecture for AI Agents 2026](https://andriifurmanets.com/blogs/ai-agents-2026-practical-architecture-tools-memory-evals-guardrails)
