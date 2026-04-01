---
name: search-research-plan
description: Recherche multi-source exhaustive (memoire, web, codebase, docs, assets) puis plan d'execution structure. Workflow generique pour tout sujet.
version: 0.1.0
inputs:
  - name: subject
    type: string
    required: true
    description: Sujet ou tache a rechercher puis planifier (ex. "deployer les hooks de session", "ajouter le whitelabel")
  - name: depth
    type: string
    required: false
    default: standard
    description: "Profondeur : shallow (memoire+codebase) | standard (+web+docs) | deep (+issues+changelogs+CVEs)"
  - name: project_path
    type: string
    required: false
    default: "."
    description: Chemin du projet cible
outputs:
  - name: research_brief
    type: object
    description: Brief de recherche structure (existant, SOTA, memoire, gaps, approche)
  - name: execution_plan
    type: object
    description: Plan d'execution avec fichiers, ordre, risques, tests
  - name: reusable_assets
    type: array
    description: Assets TWB/skills/workflows reutilisables trouves
env:
  - CHAINSKILLS_EXECUTOR
tags: [meta, research, planning, multi-agent, orchestration]
metadata:
  author: TheWatcher01
  license: MIT
  requires: []
---

## 1. Validate & Initialize

@assert $subject != "" "subject is required — usage: chainskills run srp.workflow.md --input subject='mon sujet'"
@call shell.exec("date -I") -> $research_date
@call shell.exec("echo '=== SRP: $subject === depth: $depth === $(date)'")

## 2. Check Memory (CRAG + KG)

@parallel:

### CRAG Vectoriel + KV

@agent copilot: "Interroger CRAG pour '$subject'. Actions :
1. memory_query avec le sujet comme query
2. kv_list pour trouver les cles liees au projet
3. session_recent pour le contexte des sessions passees
Retourner les findings structures avec dates et pertinence." -> $crag_findings

### Knowledge Graph

@agent copilot: "Explorer le knowledge graph pour '$subject'. Actions :
1. search_nodes pour les entites liees
2. read_graph pour les relations
Retourner entites, relations, observations." -> $kg_findings

## 3. Scan Codebase

@parallel:

### Code existant

@agent copilot: "Explorer le codebase dans '$project_path' pour '$subject'. Chercher :
1. Fichiers directement lies (Glob patterns)
2. Patterns et conventions en place (Grep)
3. Tests existants couvrant le sujet
4. Dependances et imports concernes
Retourner fichiers:lignes, patterns, gaps." -> $codebase_scan

### Assets reutilisables (TWB, skills, workflows)

@agent copilot: "Verifier les assets reutilisables pour '$subject'. Chercher :
1. twb search <keywords du sujet>
2. Skills dans ~/.claude/skills/ liees au sujet
3. Workflows chainskills dans templates/
4. OPTIMIZATIONS.md si pertinent
Retourner assets avec chemins et reutilisabilite." -> $reusable_assets

## 4. Research Externally

@if $depth != "shallow":

@parallel:

### Web SOTA

@agent copilot: "Recherche web pour '$subject'. 3+ requetes variees. Prioriser docs officielles > GitHub > blogs. Filtrer sources < 6 mois. Retourner findings avec URLs et confiance." -> $web_findings

### Documentation libs

@agent copilot: "Chercher la documentation a jour des libs/frameworks lies a '$subject'. Utiliser Context7 resolve-library-id puis query-docs. Retourner extraits pertinents avec versions." -> $docs_findings

@if $depth == "deep":

### GitHub Issues + Changelogs

@agent copilot: "Deep dive GitHub pour '$subject'. Chercher issues ouvertes/fermees, changelogs, breaking changes, CVEs. Retourner avec URLs et dates." -> $deep_findings

## 5. Validate Freshness

@agent copilot: "Valider la fraicheur de tous les findings. Pour chaque claim :
- FRESH (< 90j)
- AGING (90j-1an)
- STALE (1-2ans)
- EXPIRED (> 2ans)
- UNVERIFIED (pas de date)
Retourner table avec source, claim, date, status." -> $freshness_report

## 6. Synthesize Brief

@agent copilot: "Synthetiser un brief de recherche structure pour '$subject' date $research_date :

### Ce qui existe deja
[assets, code, patterns du codebase et TWB depuis $codebase_scan et $reusable_assets]

### SOTA et meilleures pratiques
[findings web + docs depuis $web_findings et $docs_findings]

### Memoire et contexte
[decisions passees depuis $crag_findings et $kg_findings]

### Gaps et risques
[manques, contradictions, points d'attention]

### Approche recommandee
[synthese actionable en 5-10 lignes]

Etre concis (20 lignes max). Inclure URLs sources." -> $research_brief

## 7. Generate Execution Plan

@agent copilot: "A partir du brief de recherche, generer un plan d'execution pour '$subject' :

1. Fichiers a creer/modifier (chemins absolus)
2. Ordre d'execution (dependances)
3. Pour chaque etape : action, fichier, complexite (S/M/L)
4. Risques et mitigations
5. Tests a ecrire
6. Assets TWB/skills a reutiliser (depuis $reusable_assets)
7. Estimation effort (nombre d'etapes)

Format : table Markdown avec colonnes #, Action, Fichier, Complexite, Dependance" -> $execution_plan

## 8. Output

@output: $research_brief, $execution_plan, $reusable_assets

@call shell.exec("echo '=== SRP COMPLETE === Brief + Plan ready for execution ==='")
