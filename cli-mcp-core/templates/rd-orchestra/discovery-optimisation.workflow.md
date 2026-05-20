---
name: discovery-optimisation
description: Questions de découverte pour une optimisation ou refactoring
version: 1.0.0
inputs:
  - name: intent_analysis
    description: Résultat de la classification d'intention
    required: true
outputs:
  - name: discovery_context
    description: Contexte structuré de l'optimisation
tags: [rd-orchestra, discovery, optimisation]
---

# Discovery — Optimisation

## Step 1: Performance Baseline

@agent discovery-agent
Contexte : $intent_analysis.summary

Pose ces questions pour cadrer l'optimisation :

1. **Métriques actuelles** : Quelles sont les métriques de performance actuelles (latence, throughput, mémoire) ?
2. **Cibles** : Quelles sont les cibles à atteindre ? (ex: P99 < 200ms, memory < 512MB)
3. **Profiling** : A-t-on déjà des données de profiling ou des flamegraphs ?
4. **Périmètre** : Quel module/fonction est le principal goulot d'étranglement ?
5. **Contraintes** : Y a-t-il des contraintes sur l'approche ? (pas de breaking change, budget limité)
6. **Refactoring** : Y a-t-il aussi un besoin de refactoring (dette technique) en même temps ?

→ $optim_answers

## Step 2: SOTA Optimization Research

@agent optimization-researcher
Basé sur $optim_answers, recherche les patterns d'optimisation SOTA applicables :
- Algorithmes plus efficaces (O() inférieur)
- Patterns de caching appropriés
- Opportunités de parallélisation
- Outils de profiling recommandés pour cette stack
→ $optimization_research

## Step 3: Consolidate

@agent discovery-consolidator
Consolide les réponses et la recherche d'optimisation.
Entrées : $optim_answers + $optimization_research
→ $discovery_context

@output discovery_context $discovery_context
