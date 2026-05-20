---
name: session-init
description: RD-Orchestra — Capture d'intention et initialisation de session
version: 1.0.0
inputs:
  - name: raw_intent
    description: Description brute de ce que l'utilisateur veut faire
    required: true
outputs:
  - name: session_context
    description: SESSION_CONTEXT.yaml structuré
  - name: next_workflow
    description: Workflow à enchaîner selon le type de session
tags: [rd-orchestra, session, meta]
---

# Session Init — RD-Orchestra

## Step 1: Classify Intent

@agent intent-classifier
Analyse cette intention : "$raw_intent"

Classifie en UN des types suivants :
- nouveau_projet : création d'un nouveau projet from scratch
- nouvelle_feature : ajout d'une feature à un projet existant
- audit : audit technique (RGPD, sécurité, code quality, AI Act)
- debug : investigation et résolution de bugs
- optimisation : amélioration de performance, refactoring
- recherche : veille technologique, évaluation d'algorithmes/outils

Réponds UNIQUEMENT en JSON strict :
{
  "session_type": "<type>",
  "confidence": 0.0,
  "summary": "<résumé en 1 phrase>",
  "key_constraints": [],
  "requires_stack_context": true,
  "requires_legal_context": false
}

@schema {
  "type": "object",
  "required": ["session_type", "confidence", "summary"],
  "properties": {
    "session_type": { "type": "string", "enum": ["nouveau_projet","nouvelle_feature","audit","debug","optimisation","recherche"] },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "summary": { "type": "string" },
    "key_constraints": { "type": "array", "items": { "type": "string" } },
    "requires_stack_context": { "type": "boolean" },
    "requires_legal_context": { "type": "boolean" }
  }
}

→ $intent_analysis

## Step 2: Discovery Questions

@if $intent_analysis.session_type == "nouveau_projet"
@workflow rd-orchestra/discovery-nouveau-projet.workflow.md --input intent_analysis="$intent_analysis"
@end

@if $intent_analysis.session_type == "nouvelle_feature"
@workflow rd-orchestra/discovery-feature.workflow.md --input intent_analysis="$intent_analysis"
@end

@if $intent_analysis.session_type == "audit"
@workflow rd-orchestra/discovery-audit.workflow.md --input intent_analysis="$intent_analysis"
@end

@if $intent_analysis.session_type == "debug"
@workflow rd-orchestra/discovery-debug.workflow.md --input intent_analysis="$intent_analysis"
@end

@if $intent_analysis.session_type == "optimisation"
@workflow rd-orchestra/discovery-optimisation.workflow.md --input intent_analysis="$intent_analysis"
@end

@if $intent_analysis.session_type == "recherche"
@workflow rd-orchestra/discovery-recherche.workflow.md --input intent_analysis="$intent_analysis"
@end

→ $discovery_context

## Step 3: Generate Session Context

@agent context-consolidator
Sur la base de :
- Intention classifiée : $intent_analysis
- Contexte découverte : $discovery_context

Génère un SESSION_CONTEXT.yaml complet :

```yaml
session:
  type: <session_type>
  summary: <summary>
  timestamp: <ISO 8601>
  confidence: <confidence>

scope:
  primary_goal: <objectif principal en 1 phrase>
  success_criteria:
    - <critère mesurable 1>
    - <critère mesurable 2>
  out_of_scope:
    - <ce qui n'est pas dans le scope>

constraints:
  technical: []
  legal: []
  budget: null
  deadline: null

context:
  stack_existing: []
  architecture: null
  team_size: null

next_workflow: <rd-orchestra/strategy-layer.workflow.md>
```

→ $session_context

## Step 4: Gate

@gate "SESSION_CONTEXT.yaml généré. Type : $intent_analysis.session_type | Objectif : $intent_analysis.summary\n\nValider pour continuer vers la couche stratégie ?"

@output session_context $session_context
@output next_workflow $session_context.next_workflow
