# Analyse des douleurs dev & angles morts des éditeurs IA

> Recherche mars 2026 — Sources : Stack Overflow Survey 2025, LangChain State of Agents,
> VentureBeat, Composio AI Agent Report, MIT CSAIL, DeepMind, Anthropic, 30+ articles

---

## La carte des douleurs

```
                    DOULEUR MAXIMALE
                         ▲
                         │
   ┌─────────────────────┼─────────────────────────┐
   │                     │                          │
   │  🔴 AMNÉSIE         │  🔴 ERREURS COMPOSÉES    │
   │  L'agent oublie     │  85%/step = 20% sur     │
   │  tout entre les     │  10 steps. Le dev       │
   │  sessions           │  babysitte l'agent      │
   │                     │                          │
   │  🔴 "ALMOST RIGHT"  │  🔴 IMPOSSIBLE À         │
   │  66% des devs :     │  DÉBUGUER                │
   │  code presque bon   │  Pas de trace, pas de   │
   │  mais pas tout à    │  replay, pas de repro   │
   │  fait               │                          │
   │                     │                          │
   ├─────────────────────┼─────────────────────────┤
   │                     │                          │
   │  🟠 COÛTS OPAQUES   │  🟠 CONTEXT WINDOW       │
   │  $150-200/mois en   │  OVERFLOW                │
   │  Opus, chaque       │  L'agent "devient bête" │
   │  hallucination =    │  après trop de turns     │
   │  argent brûlé       │                          │
   │                     │                          │
   │  🟠 PAS DE MÉMOIRE  │  🟠 PROMPT DECAY          │
   │  D'ÉQUIPE           │  Le system prompt perd   │
   │  Chaque dev         │  son efficacité avec     │
   │  réexplique         │  le temps                │
   │  le même contexte   │                          │
   │                     │                          │
   ├─────────────────────┼─────────────────────────┤
   │                     │                          │
   │  🟡 FRAGMENTATION   │  🟡 GOUVERNANCE           │
   │  2.3 outils/dev     │  Qui review le code IA ? │
   │  en moyenne         │  Qu'est-ce qui           │
   │                     │  s'auto-merge ?          │
   │  🟡 DÉPENDANCE      │                          │
   │  Le dev ne sait     │  🟡 SÉCURITÉ              │
   │  plus coder sans    │  Deps hallucinées,       │
   │  IA                 │  DROP TABLE en prod      │
   │                     │                          │
   └─────────────────────┼─────────────────────────┘
                         │
                    DOULEUR MODÉRÉE
```

---

## Les 7 douleurs que PERSONNE ne résout

### Douleur 1 — L'amnésie inter-sessions (🔴 critique)

**Le problème** : Chaque nouvelle session/context window = tabula rasa.
Le dev passe 1h/semaine à ré-expliquer l'architecture, les conventions,
les décisions passées. Sur un mois, c'est un jour de travail perdu.
([Source](https://medium.com/@marvin-lijma/why-your-ai-coding-agent-keeps-forgetting-everything-and-why-prompt-engineering-wont-fix-it-a76bdc0a724f))

**Ce que font les éditeurs** : RIEN de structurel.
- Copilot : aucune mémoire persistante
- Cursor : "Notepad" basique, pas de recherche sémantique
- Claude Code : `CLAUDE.md` + `claude-progress.txt` (mieux, mais manuel)
- Windsurf : "Memories" expérimental

**L'angle mort** : Aucun ne propose de **mémoire procédurale** — l'agent ne
se souvient pas de COMMENT il a résolu un problème similaire, seulement de
faits déclaratifs basiques.

**Ce que ChainSkills peut faire** : Les workflows validés SONT la mémoire
procédurale. Un workflow qui a marché 47 fois = savoir-faire encodé.

---

### Douleur 2 — Erreurs composées (🔴 critique)

**Le problème** : 85% de précision par step × 10 steps = 20% de succès total.
Comme l'a dit Demis Hassabis (DeepMind) : "1% d'erreur sur 5000 steps =
résultat aléatoire."
([Source](https://www.computerweekly.com/news/366620886/Deepmind-founder-warns-of-compounding-AI-agent-errors))

**Ce que font les éditeurs** : Rien de systématique.
- Tous : aucun checkpoint automatique entre les steps
- Tous : aucune validation intermédiaire
- Tous : si ça échoue au step 8, on recommence du step 1

**L'angle mort** : Aucun outil ne propose de **checkpoints automatiques
avec rollback** dans un workflow multi-step, ni de **validation intermédiaire**
pour couper la propagation d'erreurs.

**Ce que ChainSkills peut faire** : `@assert` après chaque step critique,
`@snapshot` pour checkpoints, `@try/@on-error` avec rollback au dernier
état valide. **Le workflow validé est un circuit breaker naturel**.

---

### Douleur 3 — Impossible à débuguer (🔴 critique)

**Le problème** : Les devs passent 4h à parser du JSON pour trouver
pourquoi l'agent a fait une boucle infinie. Pas de trace structurée,
pas de replay, pas de reproduction de l'erreur.
([Source](https://venturebeat.com/ai/why-ai-coding-agents-arent-production-ready-brittle-context-windows-broken))

**Ce que font les éditeurs** :
- Copilot : logs basiques, pas de replay
- Cursor : "Rules" pour guider, pas de trace exploitable
- Claude Code : meilleur (events structurés), mais pas de replay
- Aucun : replay déterministe d'une session

**L'angle mort** : **Aucun outil ne permet de rejouer une exécution
passée step-by-step** pour comprendre où ça a dérapé.

**Ce que ChainSkills peut faire** : Le workflow EST la trace. Chaque run
produit un log structuré avec inputs/outputs par step. `chainskills replay`
peut re-exécuter un run passé et comparer les résultats. `@breakpoint`
existe déjà.

---

### Douleur 4 — Code "Almost Right" (🔴 majeur)

**Le problème** : 66% des devs disent que le code IA est "presque bon
mais pas tout à fait" (Stack Overflow 2025). L'agent génère du code
plausible mais incorrect, et le dev passe plus de temps à débuguer
qu'il n'en aurait mis à écrire lui-même.

**Ce que font les éditeurs** :
- Tous : aucune validation automatique du code généré
- Tous : le dev doit vérifier manuellement CHAQUE sortie
- Aucun : test automatique de la sortie avant de la proposer

**L'angle mort** : **Aucun outil ne valide automatiquement la sortie
d'un agent** contre un schéma attendu ou des assertions prédéfinies.

**Ce que ChainSkills peut faire** : `@validate $output against schema:X`,
`@assert $result.tests_pass == true`, output assertions dans le frontmatter.
Le workflow refuse une sortie qui ne matche pas le contrat.

---

### Douleur 5 — Pas de mémoire d'équipe (🟠 important)

**Le problème** : Les agents IA sont des "bloc-notes individuels qui
prétendent être de l'intelligence collective". Chaque dev re-enseigne
les mêmes conventions, patterns, et décisions architecturales.
([Source](https://dev.to/deiu/the-three-things-wrong-with-ai-agents-in-2026-492m))

**Ce que font les éditeurs** :
- Copilot : `copilot-instructions.md` par repo (statique)
- Cursor : `.cursorrules` par projet (statique)
- Claude Code : `CLAUDE.md` par projet (mieux, mais un seul fichier)
- Aucun : partage dynamique de connaissances entre devs

**L'angle mort** : **Aucun outil ne permet de partager des workflows
validés entre membres d'une équipe** avec un registre commun.

**Ce que ChainSkills peut faire** : Registry de workflows validés (v0.8.0),
workflows taggés par domaine/équipe, score de fiabilité visible par tous.
Un dev valide un workflow → toute l'équipe en bénéficie.

---

### Douleur 6 — Context window overflow (🟠 important)

**Le problème** : L'agent "devient bête" après trop de turns. Le context
window se remplit, les anciens tokens tombent, et l'agent oublie les
instructions critiques. Karpathy : "context flooding = hallucinations
avec haute confiance."
([Source](https://blog.logrocket.com/fixing-ai-context-problem/))

**Ce que font les éditeurs** :
- Claude Code : auto-compaction (bon mais perd de l'info)
- Goose : compaction à 80% du window
- Cursor : pas de gestion explicite
- Aucun : injection sélective de contexte par step

**L'angle mort** : **Aucun outil n'isole le contexte par sous-tâche**.
Tout est injecté dans un seul window, même les infos non pertinentes.

**Ce que ChainSkills peut faire** : Chaque step du workflow a son propre
scope de variables. `@parallel` isole les branches. Le DAG sait exactement
quelles variables sont nécessaires pour chaque step → injection minimale.

---

### Douleur 7 — Prompt decay (🟠 important)

**Le problème** : Un agent qui fonctionne bien le lundi "dérive"
progressivement. Le system prompt perd son efficacité après des
centaines d'interactions. Un Security Agent arrête de flagger les
issues critiques après 500 reviews.
([Source](https://vocal.media/futurism/8-ai-code-generation-mistakes-devs-must-fix-to-win-2026))

**Ce que font les éditeurs** : Personne n'adresse ce problème.

**L'angle mort** : **Aucun outil ne détecte ni ne corrige la dérive
comportementale** d'un agent au fil du temps.

**Ce que ChainSkills peut faire** : Comparer les résultats de runs
successifs du même workflow. Si le success rate baisse → alerte.
Si les outputs dévient du schéma attendu → re-validation requise.
Les `@assert` sont des invariants qui ne peuvent PAS dériver.

---

## Matrice : ce que chaque éditeur fait vs. les douleurs

| Douleur | Copilot | Cursor | Claude Code | Windsurf | **ChainSkills** |
|---|---|---|---|---|---|
| Amnésie inter-sessions | ❌ | 🟡 Notepad | 🟡 CLAUDE.md | 🟡 Memories | **✅ Workflows validés = mémoire procédurale** |
| Erreurs composées | ❌ | ❌ | ❌ | ❌ | **✅ @assert + @snapshot + @try** |
| Débug/replay | ❌ | ❌ | 🟡 Events | ❌ | **✅ Run logs + replay + @breakpoint** |
| Code "almost right" | ❌ | ❌ | ❌ | ❌ | **✅ @validate + output schema** |
| Mémoire d'équipe | 🟡 Static | 🟡 Static | 🟡 Static | ❌ | **✅ Registry + partage** |
| Context overflow | ❌ | ❌ | 🟡 Compaction | ❌ | **✅ DAG + scope isolation** |
| Prompt decay | ❌ | ❌ | ❌ | ❌ | **✅ Success rate monitoring** |

---

## Les "shooters" — où ChainSkills tire dans l'angle mort

### Angle mort #1 : Les éditeurs n'ont PAS de mémoire procédurale

Tous les éditeurs stockent des FAITS (instructions, rules, notes).
**Aucun ne stocke des PROCÉDURES VALIDÉES** (séquences d'actions prouvées).

→ ChainSkills = seul outil qui transforme une séquence d'actions réussie
en artefact réutilisable et partageable.

### Angle mort #2 : Aucun ne casse la chaîne d'erreurs composées

85%^10 = 20%. Tout le monde connaît le problème. Personne ne le résout.

→ ChainSkills = checkpoints + assertions + validation intermédiaire.
Chaque step validé remet le compteur de fiabilité à 100%.

### Angle mort #3 : Zéro reproductibilité

Même prompt, même modèle, résultats différents. Impossible de débuguer.

→ ChainSkills = workflow déterministe avec trace structurée + replay.
Si un workflow validé échoue, on sait EXACTEMENT où et pourquoi.

### Angle mort #4 : L'agent n'apprend jamais de ses erreurs

Copilot fait la même erreur le lundi et le vendredi.
Pas de boucle de feedback, pas de réflexion, pas d'amélioration.

→ ChainSkills = `@reflect` + Meta-Policy Memory + Q-values.
L'agent accumule des règles correctives et ne refait jamais la même erreur.

### Angle mort #5 : Pas de gouvernance du code IA

Qui décide si le code IA est bon ? Le dev qui a la flemme de relire ?

→ ChainSkills = le workflow validé EST la politique de qualité.
`@validate`, `@guardrail`, output schemas = contrats de comportement.

---

## Propositions révisées — par ordre de "douleur résolue"

| # | Feature | Douleur résolue | Impact | Personne ne le fait ? |
|---|---|---|---|---|
| **1** | **Run History + Replay** | Debug impossible | 🔴🔴🔴 | ✅ Personne |
| **2** | **@assert + @validate en sortie** | Code "almost right" + erreurs composées | 🔴🔴🔴 | ✅ Personne |
| **3** | **@snapshot + rollback** | Erreurs composées | 🔴🔴 | ✅ Personne |
| **4** | **Workflow status: validated** | Amnésie + reproductibilité | 🔴🔴 | ✅ Personne |
| **5** | **@reflect + Meta-Policy Memory** | Agent n'apprend pas | 🔴🔴 | ✅ Personne |
| **6** | **Success rate monitoring** | Prompt decay | 🟠🟠 | ✅ Personne |
| **7** | **Registry de workflows validés** | Mémoire d'équipe | 🟠🟠 | ✅ Personne (pour workflows) |
| **8** | **Selective context injection** | Context overflow | 🟠 | 🟡 Partiel (Claude compaction) |
| **9** | **chainskills suggest** | Fragmentation | 🟡 | ✅ Personne |
| **10** | **@team + @debate** | Code "almost right" | 🟡 | 🟡 Partiel (multi-agent) |

---

## Le pitch en une phrase

> **"Les AI agents oublient tout, font des erreurs composées, et sont
> impossibles à débuguer. ChainSkills leur donne une mémoire procédurale,
> des checkpoints, et de la reproductibilité — ce qu'aucun éditeur ne fait."**

---

## Sources principales

### Données & études
- [Stack Overflow Developer Survey 2025](https://stackoverflow.blog/) — 66% "almost right" code
- [LangChain State of AI Agents](https://www.langchain.com/state-of-agent-engineering) — 32% quality barrier
- [Composio 2025 AI Agent Report](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap) — Stalled Pilot syndrome
- [DeepMind: Compounding Error Warning](https://www.computerweekly.com/news/366620886/Deepmind-founder-warns-of-compounding-AI-agent-errors)
- [O'Reilly: Hidden Cost of Agentic Failure](https://www.oreilly.com/radar/the-hidden-cost-of-agentic-failure/)

### Comparaisons d'outils
- [Claude Code vs Cursor vs Copilot 2026 Showdown](https://dev.to/alexcloudstar/claude-code-vs-cursor-vs-github-copilot-the-2026-ai-coding-tool-showdown-53n4)
- [Best AI Coding Agents 2026 Reviews](https://www.faros.ai/blog/best-ai-coding-agents-2026)
- [Tested 15 AI Coding Agents, Only 3 Changed How We Ship](https://www.morphllm.com/ai-coding-agent)
- [Built Same App 5 Ways: Agent Showdown](https://dev.to/paulthedev/i-built-the-same-app-5-ways-cursor-vs-claude-code-vs-windsurf-vs-replit-agent-vs-github-copilot-50m2)
- [AI Coding Agents Pricing & Features Compared](https://lushbinary.com/blog/ai-coding-agents-comparison-cursor-windsurf-claude-copilot-kiro-2026/)

### Problèmes spécifiques
- [Why Your AI Agent Keeps Forgetting Everything](https://medium.com/@marvin-lijma/why-your-ai-coding-agent-keeps-forgetting-everything-and-why-prompt-engineering-wont-fix-it-a76bdc0a724f)
- [AI Agents Failing 63% of the Time](https://liorgd.medium.com/ai-agents-are-failing-63-of-the-time-heres-the-simple-fix-no-one-talks-about-bada84805cbe)
- [Why AI Coding Agents Aren't Production-Ready](https://venturebeat.com/ai/why-ai-coding-agents-arent-production-ready-brittle-context-windows-broken)
- [Three Things Wrong with AI Agents in 2026](https://dev.to/deiu/the-three-things-wrong-with-ai-agents-in-2026-492m)
- [8 AI Code Generation Mistakes](https://vocal.media/futurism/8-ai-code-generation-mistakes-devs-must-fix-to-win-2026)
- [Anthropic: Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [AI Context Problem Workarounds](https://blog.logrocket.com/fixing-ai-context-problem/)
- [Are Bugs Inevitable with AI Coding Agents?](https://stackoverflow.blog/2026/01/28/are-bugs-and-incidents-inevitable-with-ai-coding-agents/)
