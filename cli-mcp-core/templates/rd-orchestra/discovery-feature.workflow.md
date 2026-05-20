---
name: discovery-feature
description: Questions de découverte pour une nouvelle feature
version: 1.0.0
inputs:
  - name: intent_analysis
    description: Résultat de la classification d'intention
    required: true
outputs:
  - name: discovery_context
    description: Contexte structuré de la feature
tags: [rd-orchestra, discovery, feature]
---

# Discovery — Nouvelle Feature

## Step 1: Feature Questions

@agent discovery-agent
Contexte : $intent_analysis.summary

Pose ces questions pour comprendre la feature :

1. **Système cible** : Sur quel projet/module cette feature s'ajoute-t-elle ?
2. **Comportement attendu** : Décris le comportement de la feature en 2-3 phrases.
3. **Rétrocompatibilité** : Y a-t-il des contraintes de rétrocompatibilité (API publique, migrations DB) ?
4. **Tests existants** : Y a-t-il des tests à maintenir ou étendre ?
5. **Dépendances** : La feature dépend-elle d'autres features en cours de développement ?
6. **Critères d'acceptation** : Comment valider que la feature est "done" ?

→ $feature_answers

## Step 2: Impact Analysis

@agent impact-analyzer
Analyse l'impact de la feature sur le codebase existant basé sur $feature_answers :
- Ports et adapters impactés
- Tests à modifier ou créer
- Migrations de données nécessaires
- Risques de régression identifiés
→ $impact_analysis

## Step 3: Consolidate

@agent discovery-consolidator
Consolide les réponses et l'analyse d'impact.
Entrées : $feature_answers + $impact_analysis
→ $discovery_context

@output discovery_context $discovery_context
