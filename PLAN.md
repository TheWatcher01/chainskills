# Plan : chainskills Factory — Autoresearch + LLMs Locaux + Workflow Factory

> Derniere mise a jour : 2026-03-31
> Statut : Phase 0 DONE, Phases 1-8 planifiees

## Contexte

**Vision** : chainskills = usine a workflows agentiques complexes. Detecter des patterns
reutilisables, enregistrer des executions pour replay par Haiku/open-source, construire
une bibliotheque d'assets agentiques (workflows, skills, agents, hooks, handoffs).

**Hardware** : MSI Cyborg i7 / 16GB DDR5 / RTX 5060 8GB + VPS Hostinger 4vCPU/16GB
**Ollama deja installe** : Qwen3.5-9B, BGE-M3, Qwen3-Reranker, Qwen2.5-VL
**Budget** : $0 (Kaggle gratuit 30h/sem P100, RTX 5060 local, Ollama)
**Contrainte tokens** : RSA, Max 5x = 1/4 revenus → chaque token Opus compte

---

## Recherche SOTA completee

### Vague 1 (2026-03-30) — Autoresearch & Fine-tuning

- Karpathy autoresearch (mars 2026, MIT, 42K stars, 630 lignes Python)
- Qwen3.5-9B-Claude-Opus-Reasoning-Distilled (HF, mars 2026, par Jackrong)
- GRPO training-free (arXiv oct 2025) : $8 vs $800, surpasse 32B fine-tune
- ToolRL/ToolRM (arXiv 2509.11963) : +17% vs SFT pour tool-use
- Execution Tuning E.T. (arXiv 2503.05703) : traces d'execution comme donnees
- WorkflowLLM (arXiv 2411.05451) : orchestration via LLM fine-tune
- InstructLab (Red Hat/IBM) : taxonomie -> seed -> synthetic data
- LIMA study : 1000 exemples de qualite > 10000 de mauvaise qualite

### Vague 2 (2026-03-31) — Orchestration agentic, Recording/Replay, Asset Libraries

**Orchestration multi-agent (frameworks SOTA) :**

| Framework | Pattern | Stars/Usage | Force principale |
|-----------|---------|-------------|-----------------|
| LangGraph | DAG StateGraph | 27K searches/mois | State management, checkpointing |
| CrewAI | Role-based Flows | 12M+ exec/jour | Prototypage rapide (40% faster) |
| AutoGen (AG2) | Event-driven GroupChat | 1445% surge inquiries | Multi-modal, human-in-the-loop |
| OpenAI Agents SDK | Handoff + swarm | Production mars 2025 | Guardrails, handoff declares |
| Mastra | DAG state machines | 22.3K stars, 300K npm/sem | TypeScript-natif, Y Combinator |
| Microsoft Agent Framework | AutoGen + Semantic Kernel | v1.0 GA Q1 2026 | Enterprise telemetry |

**Decouverte critique** : Markdown = DSL standard valide par GitHub Agentic Workflows (fev 2026).
chainskills est parfaitement aligne avec la direction de l'industrie.

**Recording/Replay :**
- AgentRR (arXiv 2505.17716) : Record -> Summarize -> Replay, reduit drastiquement les appels LLM
- In-Context Distillation (arXiv 2512.02543) : 2.5x moins cher sans fine-tuning, few-shot depuis traces
- Agentic Plan Caching (arXiv 2506.14852) : -50.31% cout, -27.28% latence
- CASTER (arXiv 2601.19793) : routing multi-modele = -72.4% cout inference
- MasRouter (ACL 2025) : routing LLM dans systemes multi-agents sous contraintes economiques

**Constrained Decoding :**
- XGrammar (CMU/MLC) : 100x speedup, ~50us/token, default vLLM
- llguidance : 50us/token, negligible startup, CFG arbitraire
- MCP 2025-06-18 : tools avec output schema + structuredContent

**Asset Libraries & Standards :**
- Agent Skills (Anthropic, dec 2025) : standard ouvert, 30+ outils adoptes (OpenAI, Microsoft, GitHub, VS Code)
- SkillsMP : 351K+ skills, decouverte semantique
- Skills.sh : 83K+ skills, 8M+ installs, 18 agents supportes
- JFrog Agent Skills Registry : auto-discover depuis npm packages
- MCP v1.27 (2026) : roadmap inclut Skills primitive + Extensions ecosystem

**Hooks/Middleware :**
- LangChain middleware (nov 2025) : before_agent, before_model, wrap_model_call, wrap_tool_call, after_model
- Pattern deterministe : hooks comme intercepteurs systeme hors du raisonnement LLM
- Gartner : 1445% surge multi-agent inquiries, echecs = orchestration/contexte, pas capacite modele

**Observabilite :**
- OpenTelemetry GenAI Semantic Conventions : standard pour prompts, responses, tokens, tool calls
- Langfuse : open-source LLM engineering platform, OTel backend
- OpenLLMetry (Traceloop) : tracing non-intrusif via OTel

---

## Etat actuel chainskills (v0.6.0) — Audite 2026-03-31

| Capability | Statut | Details |
|-----------|--------|---------|
| 17 Directives | 100% | Toutes implementees, @breakpoint pause TODO |
| Agent System | 95% | OpenAI-compatible, pas d'adapter Anthropic |
| Skills | 30% | Local ./path uniquement, registry v0.8 |
| **Hooks** | **0%** | **Non implemente** |
| MCP Server+Client | 95% | 5 tools, 2 prompts, dynamic resources |
| **Trace Recording** | **10%** | **TraceStore port existe, AUCUN adapter** |
| **Pattern Detection** | **0%** | **Non implemente** |
| Templates | 90% | 15+ templates, pas de registry |
| DAG Execution | 100% | Simple + Mastra executors |
| State Management | 85% | In-memory, SQL planifie v1.0 |
| Testing | 100% | 197/197 tests |
| CLI | 100% | 6 commandes |
| Architecture | 100% | Hexagonal clean, DI wire |

---

## Workflows datalake deja crees

Chemin : `cli-mcp-core/templates/datalake/`

| Workflow | Steps | Valide |
|----------|-------|--------|
| add-crawler.workflow.md | 8 | OK (14 warnings runtime) |
| add-api-route.workflow.md | 8 | OK (12 warnings) |
| add-data-import.workflow.md | 6 | OK (14 warnings) |
| fix-type-errors.workflow.md | 5 | OK (13 warnings) |
| cross-ref-source.workflow.md | 6 | OK (10 warnings) |

---

## Phase 0 : Registry Perso "TheWatcher Blocks" — DONE

> Complete le 2026-03-31. CLI `twb` fonctionnel, 35 blocks, lien global.

### Resultats

| Metrique | Objectif | Resultat |
|----------|----------|---------|
| CLI fonctionnel | add, list, search, init, info, create | 6 commandes |
| Blocks disponibles | 10+ | **35 blocks** |
| Regle CLAUDE.md | "check block before generate" | Installe globalement |
| Presets architecture | 2+ | **4** (hexagonal-ts, nextjs-fullstack, cli-tool, mcp-server) |
| Skill bootstrap | Interrogatoire interactif | `/project-bootstrap` cree |

### Blocks crees (35 total)

- **Workflows (9)** : add-crawler, add-api-route, add-data-import, cross-ref-source, fix-type-errors, verify-data, tdd-cycle, code-review, research-domain
- **Adapters (11)** : crawler, api-route, hexagonal-port, import-script, cli-command, adapter-factory, vscode-provider, prisma-model, vitest-test, zod-schema, nextjs-route
- **Schemas (1)** : data-provenance
- **Skills (4)** : research, smart-commit, skill-definition, project-bootstrap
- **Agents (1)** : agent-definition
- **Configs (4)** : vitest, tsconfig-strict, dockerfile, docker-compose
- **Frontend (1)** : confidence-badge
- **Presets (4)** : hexagonal-ts, nextjs-fullstack, cli-tool, mcp-server

### Impact tokens

| Avant (sans TWB) | Apres (avec TWB) |
|-------------------|------------------|
| Opus genere 200-500 lignes/scaffold | `twb add` → 0 token |
| 2-3 features/session 5h | 8-12 features (estime) |
| Haiku genere boilerplate from scratch | Haiku execute `twb add` + adapte 5 lignes → 50 tokens |

---

## Phase 1 : Trace Infrastructure + Hooks (P0) — A FAIRE

> Fondation pour TOUT le reste : replay, distillation, pattern detection, evaluation.

### 1.1 JSONL Trace Store Adapter

**Fichiers a creer :**
- `cli-mcp-core/src/adapters/trace/jsonl-trace-store.ts` — Adapter TraceStore -> JSONL
- `cli-mcp-core/src/cli/commands/replay.ts` — Commande replay
- `cli-mcp-core/src/cli/commands/traces.ts` — Commande traces list/export

**Fichiers a modifier :**
- `cli-mcp-core/src/adapters/executor/simple-executor.ts` — Instrumenter chaque step
- `cli-mcp-core/src/adapters/executor/mastra-executor.ts` — Idem
- `cli-mcp-core/src/cli/commands/run.ts` — Flag `--capture-traces`
- `cli-mcp-core/src/config/container.ts` — Enregistrer JSONL adapter

**Port existant** : `cli-mcp-core/src/core/ports/trace-store.port.ts`

```typescript
// ExecutionTrace deja defini dans le port (22 champs)
// Enrichir avec champs OTel GenAI-compatibles :
interface StepTrace {
  step_id: string;
  directive: string;             // "@call", "@agent", "@if"
  tool_name?: string;
  input: unknown;
  output: unknown;
  success: boolean;
  duration_ms: number;
  tokens?: { input: number; output: number };
  model_id?: string;             // "claude-opus-4-6", "qwen3-8b"
  error?: string;
  cost_estimate_usd?: number;
}
```

**Stockage** : `~/.chainskills/traces/{workflow}-{run-id}.trace.jsonl`

**CLI** :
```bash
chainskills run workflow.md --capture-traces    # Enregistrer
chainskills replay <trace-id>                   # Rejouer
chainskills traces list                         # Lister
chainskills traces export --format otel         # Export OTel
```

**Source SOTA** : AgentRR (arXiv 2505.17716), OTel GenAI Semantic Conventions

### 1.2 Hook/Middleware System

**Fichiers a creer :**
- `cli-mcp-core/src/core/ports/execution-hook.port.ts` — Interface Hook
- `cli-mcp-core/src/adapters/hooks/trace-hook.ts` — Hook qui capture les traces
- `cli-mcp-core/src/adapters/hooks/cost-tracker-hook.ts` — Suivi couts par modele
- `cli-mcp-core/src/adapters/hooks/guardrail-hook.ts` — Validation pre/post step

**Fichiers a modifier :**
- `cli-mcp-core/src/adapters/executor/simple-executor.ts` — Integrer pipeline de hooks
- `cli-mcp-core/src/adapters/executor/mastra-executor.ts` — Idem
- `cli-mcp-core/src/config/container.ts` — Registry des hooks

**Interface :**
```typescript
interface ExecutionHook {
  readonly name: string;
  readonly priority: number;
  beforeStep?(step: Step, context: ExecutionContext): Promise<HookResult>;
  afterStep?(step: Step, result: StepResult, context: ExecutionContext): Promise<HookResult>;
  beforeWorkflow?(workflow: Workflow, context: ExecutionContext): Promise<HookResult>;
  afterWorkflow?(workflow: Workflow, result: WorkflowResult, context: ExecutionContext): Promise<HookResult>;
  onError?(step: Step, error: Error, context: ExecutionContext): Promise<HookResult>;
}

type HookResult = { action: 'continue' } | { action: 'skip' } | { action: 'abort'; reason: string };
```

**Source SOTA** : LangChain middleware (nov 2025), Dotzlaw deterministic agent engineering

### 1.3 Tests Phase 1

- [ ] Un workflow simple produit un fichier trace JSONL
- [ ] Les traces contiennent tous les champs obligatoires
- [ ] Les erreurs (@try/@on-error) sont tracees correctement
- [ ] Les @parallel tracent les branches independamment
- [ ] Hooks before/after fires dans l'ordre de priorite
- [ ] Hook abort stoppe l'execution
- [ ] Hook skip passe le step
- [ ] Cost tracker accumule les tokens

**Estimation** : +18 tests, 2-3 semaines

---

## Phase 2 : Model Routing & Replay (P1) — A FAIRE

> Economie 60-85% : cascade Opus->Sonnet->Haiku->local selon complexite.

### 2.1 Model Router

**Fichiers a creer :**
- `cli-mcp-core/src/core/ports/model-router.port.ts` — Interface routing
- `cli-mcp-core/src/adapters/agents/model-router.ts` — Router multi-modele

**Fichiers a modifier :**
- `cli-mcp-core/src/adapters/agents/openai-agent.ts` — Support multi-modele par step
- `cli-mcp-core/src/cli/commands/run.ts` — Flag `--model auto|local|cloud`

**Strategie :**
```typescript
interface ModelRouter {
  route(step: Step, context: RoutingContext): Promise<ModelSelection>;
}

interface RoutingContext {
  complexity: 'simple' | 'moderate' | 'complex';
  directive_type: string;
  has_prior_trace: boolean;
  budget_remaining: number;
}
```

**Regles de routing par defaut :**

| Directive | Modele | Fallback |
|-----------|--------|----------|
| @call (shell, outil) | Aucun LLM | — |
| @if, @for, @repeat | Haiku | Sonnet |
| @agent (generation) | Sonnet | Opus |
| @agent (raisonnement complexe) | Opus | — |
| Replay depuis trace | Haiku/local | Sonnet |

### 2.2 Replay Mode

- Charger trace existante
- Injecter outputs caches comme few-shot (In-Context Distillation)
- Modele leger execute avec exemples en contexte
- Valider output vs trace originale (schema Zod)

**Sources SOTA** : CASTER (arXiv 2601.19793), MasRouter (ACL 2025), ICD (arXiv 2512.02543)

**Estimation** : +10 tests, 2 semaines

---

## Phase 3 : Pattern Detection & Asset Library (P1) — A FAIRE

> Auto-detection de patterns reutilisables depuis les traces d'execution.

### 3.1 Algorithme de detection

**Fichiers a creer :**
- `cli-mcp-core/src/core/use-cases/detect-patterns.ts`
- `cli-mcp-core/src/core/entities/workflow-pattern.ts`
- `cli-mcp-core/src/cli/commands/patterns.ts`

**Algorithme :**
1. Collecter N traces d'execution (Phase 1)
2. Extraire sequences de directives recurrentes (n-grams sur directive chains)
3. Identifier sub-workflows communs (>= 3 occurrences)
4. Scorer par frequence + taux de succes
5. Proposer comme template TWB ou workflow reutilisable

```typescript
interface WorkflowPattern {
  pattern_id: string;
  name: string;
  directives: DirectiveSequence[];
  frequency: number;
  success_rate: number;
  avg_duration_ms: number;
  suggested_as: 'workflow' | 'skill' | 'hook';
  variables: string[];
}
```

**CLI :**
```bash
chainskills patterns analyze                  # Analyser toutes les traces
chainskills patterns suggest                  # Proposer des extractions
chainskills patterns extract <pattern-id>     # Extraire en .workflow.md
chainskills patterns export-twb <pattern-id>  # Exporter comme block TWB
```

**Source SOTA** : Agentic Process Mining (SimplAI), OpenLineage

**Estimation** : +8 tests, 2 semaines

---

## Phase 4 : Skill Registry & Evaluation (P1-P2) — A FAIRE

> Decouverte, partage, versioning de skills + framework d'evaluation.

### 4.1 Skill Registry (prevu v0.8.0)

**Fichiers a creer :**
- `cli-mcp-core/src/core/ports/skill-registry.port.ts`
- `cli-mcp-core/src/adapters/skills/git-registry.ts` — Resolution `@use owner/repo@skill`
- `cli-mcp-core/src/cli/commands/skills.ts` — search, install, publish

**Format compatible Agent Skills standard (Anthropic dec 2025) :**
```yaml
---
name: add-crawler
description: Ajouter un crawler au datalake avec provenance ISO 8000-8
allowed-tools: [Bash, Edit, Write, Read, Grep, Glob]
model: sonnet
tags: [datalake, crawler, data-ingestion]
version: 1.0.0
---
```

### 4.2 Evaluation Framework

**Fichiers a creer :**
- `cli-mcp-core/src/core/use-cases/evaluate-workflow.ts`
- `cli-mcp-core/src/cli/commands/eval.ts`

**CLI :**
```bash
chainskills eval <workflow.md> --dataset fixtures/eval.jsonl
chainskills eval --compare opus haiku --workflow add-crawler
```

**Source SOTA** : Mastra Datasets/Experiments (fev 2026), Spring AI Skills (jan 2026)

**Estimation** : +6 tests, 2 semaines

---

## Phase 5 : Dataset synthetique (2 semaines) — A FAIRE

### 5.1 Generer des variations de workflows

Pour chaque workflow existant, generer 5-10 variations avec des inputs differents :

```bash
chainskills run add-crawler.workflow.md --input source_name=opco-atlas --capture-traces
chainskills run add-crawler.workflow.md --input source_name=pole-emploi --capture-traces
chainskills run add-crawler.workflow.md --input source_name=caf-allocations --capture-traces
```

**Objectif** : 500-1000 traces de qualite (LIMA study : qualite > quantite).

### 5.2 Methode InstructLab (taxonomie -> seed -> generation)

```
chainskills/training/
├── taxonomy/
│   ├── tool-calling/           # @call shell.exec, git.diff, etc.
│   ├── control-flow/           # @if, @for, @repeat, @parallel
│   ├── error-handling/         # @try, @on-error, @assert
│   └── agent-delegation/      # @agent, @handoff, @workflow
├── seeds/                      # 5-10 exemples par categorie
├── generated/                  # Dataset synthetique
└── scripts/
    ├── generate-variations.ts
    ├── trace-to-sft.ts         # Traces -> format SFT
    └── trace-to-dpo.ts         # Traces -> paires DPO
```

### 5.3 Formats de sortie

**SFT (ShareGPT/Alpaca)** :
```json
{
  "instruction": "Execute ce workflow step: @call shell.exec('pnpm type-check')",
  "input": "{ \"previous_outputs\": { \"$repo_path\": \"/home/user/datalake\" } }",
  "output": "{ \"directive\": \"@call\", \"tool\": \"shell.exec\", \"success\": true }"
}
```

**DPO (paires preference)** :
```json
{
  "prompt": "Execute @call pour verifier les types TypeScript",
  "chosen": "@call shell.exec(\"cd $repo_path && pnpm type-check\") -> $result",
  "rejected": "@call shell.exec(\"tsc\") -> $result"
}
```

---

## Phase 6 : Fine-tuning SFT (1 semaine) — A FAIRE

### 6.1 Modele de base

**Option A (recommandee)** : `Qwen2.5-Coder-7B-Instruct` — 5GB Q4_K_M, 50 tok/s
**Option B (si dispo)** : `Qwen3.5-9B-Claude-Opus-Reasoning-Distilled`
**Option C** : `Qwen3-8B-Agent` — native tool invocation, multi-step reasoning (HF blog 2025)

### 6.2 Setup

**Framework** : Unsloth + LLaMA-Factory (QLoRA, fp16)

```yaml
model_name_or_path: Qwen/Qwen2.5-Coder-7B-Instruct
stage: sft
finetuning_type: lora
lora_rank: 16
lora_alpha: 32
dataset: chainskills-sft-v1
per_device_train_batch_size: 2
gradient_accumulation_steps: 4
num_train_epochs: 3
learning_rate: 2e-4
fp16: true
```

### 6.3 Export Ollama

```bash
python merge_lora.py --base Qwen2.5-Coder-7B --adapter output/sft/ --output merged/
python convert_hf_to_gguf.py merged/ --outtype q4_k_m --outfile chainskills-coder-7b-q4.gguf
ollama create chainskills-coder:7b -f Modelfile
```

### 6.4 Metriques attendues

| Metrique | Baseline (0-shot) | Apres SFT |
|----------|-------------------|-----------|
| Accuracy workflow steps | ~40% | 55-60% |
| Syntax validite (@call) | ~60% | 90%+ |
| Tool routing correct | ~50% | 75%+ |

---

## Phase 7 : DPO + GRPO (2 semaines) — A FAIRE

### 7.1 DPO

```yaml
model_name_or_path: ./output/qwen2.5-coder-7b-chainskills-sft
stage: dpo
dataset: chainskills-dpo-v1
dpo_beta: 0.1
num_train_epochs: 2
```

### 7.2 GRPO (optionnel)

Pattern DeepSeek : generer N candidats, ranker, garder le meilleur.
Alternative : Training-free GRPO (arXiv oct 2025) — $8 vs $800.

### 7.3 Metriques attendues

| Metrique | Apres SFT | Apres DPO | Apres GRPO |
|----------|-----------|-----------|------------|
| Accuracy steps | 55-60% | 65-70% | 75-80% |
| Tool routing | 75% | 85% | 90%+ |
| Error recovery | 30% | 50% | 65% |

---

## Phase 8 : Boucle Autoresearch + Integration (4 semaines) — A FAIRE

### 8.1 Pattern Karpathy adapte

```
autoresearch-chainskills/
├── program.md          # Strategie mutable
├── workflow-under-test/ # Workflows a optimiser
├── eval.ts             # Evaluation fixe (immutable)
└── loop.ts             # Boucle autoresearch
```

**Boucle** : evaluate -> propose improvement -> apply -> re-evaluate -> keep/discard (git).
~30 experiences/nuit (2 min chacune).

### 8.2 Integration CLI

```bash
chainskills run workflow.md --model local    # Ollama
chainskills run workflow.md --model cloud    # Claude/OpenAI
chainskills run workflow.md                  # Auto-route (local si dispo)
```

### 8.3 Fallback automatique

```typescript
const result = await executeWithModel("chainskills-coder:7b", workflow);
if (!result.success && result.confidence < 0.5) {
  return executeWithModel("claude-opus-4", workflow);
}
```

---

## Features Bonus (post-v1.0)

| Feature | Description | Source SOTA |
|---------|------------|------------|
| Structured Handoff Schema | Schema Zod pour @handoff (objectives, constraints, evidence) | OpenAI Agents SDK |
| Constrained Output | XGrammar/JSON schema pour output structure petits modeles | XGrammar (CMU/MLC) |
| Plan Caching | Cache plans d'execution, adaptation legere | APC (arXiv 2506.14852) |
| In-Context Distillation | Few-shot depuis traces reussies | ICD (arXiv 2512.02543) |
| @supervisor directive | Agent superviseur qui orchestre d'autres agents | Microsoft Agent Framework |
| OTel export natif | Emission directe vers Langfuse/Datadog | OTel GenAI conventions |
| Workflow diff | Comparer deux traces (A/B testing) | Temporal patterns |
| DSPy integration | Compilation declarative de pipelines LM | DSPy (dspy.ai) |

---

## Strategie de delegation Opus -> Haiku

### Principe

```
┌─────────────────────────────────────────────────────┐
│  OPUS (orchestrateur)                               │
│  - Analyse le besoin (50-100 tokens)                │
│  - Choisit le block registry (10 tokens)            │
│  - Delegue a Haiku sub-agent (1 tool call)          │
│  - Review le resultat Haiku (50 tokens)             │
│  Total Opus : ~200 tokens                           │
└──────────────────┬──────────────────────────────────┘
                   │ @handoff
┌──────────────────▼──────────────────────────────────┐
│  HAIKU low-thinking (executant)                     │
│  - Execute `twb add <block> --var ...` (shell)      │
│  - Adapte les 5-10 lignes metier specifiques (Edit) │
│  - Lance les tests (shell)                          │
│  Total Haiku : ~300 tokens (pas de quota Opus)      │
└─────────────────────────────────────────────────────┘
```

### Matrice de delegation

| Tache | Agent | Tokens | Justification |
|-------|-------|--------|---------------|
| Nouveau crawler | Haiku + twb | 50-100 | Block existe |
| Nouvelle route API | Haiku + twb | 50-100 | Block existe |
| Nouveau workflow | Haiku + twb | 100-200 | Template + adaptation |
| Fix type errors | Haiku | 200-500 | Deterministe |
| Logique metier complexe | Opus | 500-2000 | Raisonnement profond |
| Architecture/design | Opus | 300-1000 | Decisions strategiques |
| Debug non-trivial | Opus | 500-1500 | Analyse multi-fichiers |

---

## Positionnement strategique (valide SOTA 2026-03-31)

| Aspect | chainskills | LangGraph | CrewAI | Mastra |
|--------|------------|-----------|--------|--------|
| Langage | TypeScript | Python | Python | TypeScript |
| Format workflow | **Markdown** | Code Python | Code Python | Code TS |
| Accessibilite | **Humain-lisible** | Dev-only | Dev-only | Dev-only |
| MCP | **Natif** (server+client) | Plugin | Non | Natif |
| Directives | 17 | Illimite (code) | Roles | Methods |
| TWB integration | **Natif** | Non | Non | Non |
| Hooks | A FAIRE | Middleware | Non | Non |
| Trace recording | A FAIRE | Checkpointing | Non | Non |

**Avantage unique** : Seul framework TypeScript workflow-as-markdown avec MCP natif.
GitHub a valide Markdown comme DSL standard (Agentic Workflows, fev 2026).

---

## Use cases par priorite

### Priorite 1 — Data Engineering
- add-crawler, add-data-import, cross-ref-source
- 20 crawlers existants = 20 exemples Gold
- Feedback binaire (le crawl marche ou pas)

### Priorite 2 — Fullstack Dev
- add-api-route, fix-type-errors
- Patterns repetitifs, type-check = reward signal

### Priorite 3 — DevSecOps
- security-scan, dependency-audit, vuln-fix
- Outils CLI deterministes (trivy, snyk)

### Priorite 4 — RGPD
- data-audit, consent-check, PIA-generation
- Validation humaine obligatoire

---

## Timeline

| Semaine | Phase | Livrable | Statut |
|---------|-------|----------|--------|
| **S0** | **Phase 0 : Registry TWB** | **CLI `twb` + 35 blocks + presets + bootstrap** | **DONE** |
| S1-S3 | Phase 1 : Traces + Hooks | JSONL adapter + --capture-traces + hooks pipeline | A FAIRE |
| S3-S5 | Phase 2 : Model Routing | Router cascade + replay mode | A FAIRE |
| S5-S7 | Phase 3 : Pattern Detection | Auto-detection + extraction + TWB export | A FAIRE |
| S7-S9 | Phase 4 : Registry + Eval | Git skills + eval framework | A FAIRE |
| S9-S11 | Phase 5 : Dataset synthetique | 1000+ traces SFT + 500 paires DPO | A FAIRE |
| S11-S12 | Phase 6 : SFT | Qwen 7B fine-tune, export Ollama | A FAIRE |
| S12-S14 | Phase 7 : DPO/GRPO | 75%+ accuracy sur workflows | A FAIRE |
| S14-S18 | Phase 8 : Autoresearch + Integration | Boucle autonome + --model local | A FAIRE |

**Cout total** : $0 (Kaggle + RTX 5060 + Ollama)
**ROI Phase 0** : Deja rembourse via economie tokens (35 blocks = ~35000 tokens economies).

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| 8GB VRAM insuffisant QLoRA 9B | Impossible fine-tune local | Kaggle P100 16GB gratuit |
| Qualite traces insuffisante | Modele apprend du bruit | Gold tier : human-verified traces only |
| Overfitting 5 workflows | Pas de generalisation | Diversifier avant Phase 6 |
| Autoresearch degenere | Score stagne | Git reset auto + plateau detection |
| Modele local hallucine tool calls | Execution echoue | Fallback cloud + confidence threshold |

---

## References

### Orchestration & Frameworks
- [LangGraph](https://www.langchain.com/langgraph) — DAG StateGraph, checkpointing
- [CrewAI Flows](https://crewai.com/crewai-flows) — Event-driven orchestration
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/handoffs/) — Handoff patterns
- [Mastra](https://mastra.ai) — TypeScript-native, Y Combinator W25
- [GitHub Agentic Workflows](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/) — Markdown = DSL standard
- [Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/) — Enterprise telemetry

### Recording, Replay & Distillation
- [AgentRR (arXiv 2505.17716)](https://arxiv.org/abs/2505.17716) — Record -> Summarize -> Replay
- [In-Context Distillation (arXiv 2512.02543)](https://arxiv.org/abs/2512.02543) — 2.5x cost reduction
- [Agentic Plan Caching (arXiv 2506.14852)](https://arxiv.org/abs/2506.14852) — -50% cost, -27% latency
- [CASTER (arXiv 2601.19793)](https://arxiv.org/html/2601.19793v1) — -72.4% inference cost
- [MasRouter (ACL 2025)](https://aclanthology.org/2025.acl-long.757.pdf) — Multi-agent routing

### Standards & Ecosystems
- [Agent Skills Standard (agentskills.io)](https://agentskills.io/home) — 30+ vendors
- [MCP Roadmap 2026](https://modelcontextprotocol.io/development/roadmap) — Skills primitive
- [OTel GenAI Conventions](https://opentelemetry.io/blog/2025/ai-agent-observability/) — Trace standard
- [Langfuse](https://langfuse.com/) — Open-source LLM engineering
- [Spring AI Agent Skills](https://spring.io/blog/2026/01/13/spring-ai-generic-agent-skills/) — Modular skills

### Hooks & Middleware
- [LangChain Middleware](https://blog.langchain.com/how-middleware-lets-you-customize-your-agent-harness/) — 5 hook types
- [Dotzlaw: Claude Deterministic Agent Engineering](https://www.dotzlaw.com/insights/claude-deterministic-agent-engineering/) — Hooks as system-level interceptors

### Constrained Decoding
- [XGrammar (CMU/MLC)](https://github.com/mlc-ai/xgrammar) — 100x speedup
- [vLLM Structured Decoding](https://blog.vllm.ai/2025/01/14/struct-decode-intro.html)
- [DSPy](https://dspy.ai/) — Declarative LM programming

### Autoresearch & Fine-tuning
- [karpathy/autoresearch](https://github.com/karpathy/autoresearch) — MIT, 42K stars
- [Unsloth](https://github.com/unslothai/unsloth) — 2-5x faster, 80% less VRAM
- [LLaMA-Factory](https://github.com/hiyouga/LlamaFactory) — 100+ modeles
- [ToolRL/ToolRM (arXiv 2509.11963)](https://arxiv.org/abs/2509.11963) — +17% vs SFT
- [GRPO training-free (arXiv 2510.08191)](https://arxiv.org/abs/2510.08191) — $8 vs $800
- [Qwen3-8B Agent (HuggingFace)](https://huggingface.co/blog/intel-qwen3-agent) — Native tool invocation
