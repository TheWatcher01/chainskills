---
name: discovery-debug
description: Questions de découverte pour investigation et résolution de bug
version: 1.0.0
inputs:
  - name: intent_analysis
    description: Résultat de la classification d'intention
    required: true
outputs:
  - name: discovery_context
    description: Contexte structuré du bug
tags: [rd-orchestra, discovery, debug]
---

# Discovery — Debug

## Step 1: Bug Description

@agent discovery-agent
Contexte : $intent_analysis.summary

Pose ces questions pour cerner le bug :

1. **Symptômes** : Quel est le comportement observé vs attendu ? Message d'erreur exact ?
2. **Reproductibilité** : Le bug est-il reproductible ? Systématiquement ou de façon intermittente ?
3. **Stack trace** : Y a-t-il une stack trace ou des logs disponibles ?
4. **Régression** : Est-ce une régression ? Quand a-t-il commencé à apparaître ?
5. **Environnement** : Prod / staging / local ? Système d'exploitation / version Node ?
6. **Périmètre** : Quel module / fichier est probablement impliqué ?

→ $bug_answers

## Step 2: Hypothesis Generation

@agent bug-analyzer
Basé sur $bug_answers, génère :
- 3 hypothèses de cause racine (par probabilité décroissante)
- Pour chaque hypothèse : test de validation rapide
- Fichiers à inspecter en priorité
- Commandes de diagnostic recommandées
→ $hypotheses

## Step 3: Consolidate

@agent discovery-consolidator
Consolide la description du bug et les hypothèses.
Entrées : $bug_answers + $hypotheses
→ $discovery_context

@output discovery_context $discovery_context
