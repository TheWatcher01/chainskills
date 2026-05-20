---
name: discovery-audit
description: Questions de découverte pour un audit technique
version: 1.0.0
inputs:
  - name: intent_analysis
    description: Résultat de la classification d'intention
    required: true
outputs:
  - name: discovery_context
    description: Contexte structuré de l'audit
tags: [rd-orchestra, discovery, audit]
---

# Discovery — Audit Technique

## Step 1: Audit Scoping

@agent discovery-agent
Contexte : $intent_analysis.summary

Pose ces questions pour cadrer l'audit :

1. **Périmètre** : Quel est le périmètre exact ? (codebase complet, module spécifique, API, infrastructure)
2. **Type d'audit** : RGPD, sécurité applicative, qualité de code, AI Act, NIS2, ou mixte ?
3. **Criticité** : Y a-t-il des données sensibles ou des fonctions critiques traitées ?
4. **Livrables attendus** : Rapport d'audit ? Checklist ? Plan de remédiation ?
5. **Deadline** : Y a-t-il une deadline réglementaire ou contractuelle ?
6. **Contexte précédent** : Y a-t-il déjà eu un audit ? Des non-conformités connues ?

→ $audit_answers

## Step 2: Preliminary Analysis

@parallel

@agent security-analyzer
@if $intent_analysis.requires_legal_context
Analyse les référentiels applicables basés sur $audit_answers :
- OWASP Top 10 (2025) si audit sécurité
- RGPD / CNIL si données personnelles
- AI Act si système d'IA
- NIS2 si infrastructure critique
→ $regulatory_context
@end

@agent scope-analyzer
Définis le scope technique précis basé sur $audit_answers :
- Fichiers/modules à auditer en priorité
- Outils d'analyse statique recommandés (Semgrep, CodeQL, etc.)
- Métriques de qualité à mesurer
→ $scope_analysis

@end

## Step 3: Consolidate

@agent discovery-consolidator
Consolide les réponses et analyses en un contexte d'audit structuré.
Entrées : $audit_answers + $regulatory_context + $scope_analysis
→ $discovery_context

@output discovery_context $discovery_context
