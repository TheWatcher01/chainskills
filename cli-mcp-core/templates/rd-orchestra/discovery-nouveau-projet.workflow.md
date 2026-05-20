---
name: discovery-nouveau-projet
description: Questions de découverte pour un nouveau projet (max 7 questions)
version: 1.0.0
inputs:
  - name: intent_analysis
    description: Résultat de la classification d'intention
    required: true
outputs:
  - name: discovery_context
    description: Contexte structuré du projet
tags: [rd-orchestra, discovery, nouveau-projet]
---

# Discovery — Nouveau Projet

## Step 1: Core Questions

@agent discovery-agent
Tu dois comprendre ce nouveau projet en posant les questions les plus importantes.
Contexte initial : $intent_analysis.summary
Contraintes identifiées : $intent_analysis.key_constraints

Pose EXACTEMENT ces questions (adaptées au contexte si besoin) :

1. **Domaine métier** : Quel est le secteur / le problème résolu ? (ex: ESS, compliance, e-commerce)
2. **Utilisateurs cibles** : Qui utilise ce système ? (développeurs, associations, DSI, grand public)
3. **Stack existante** : Y a-t-il une stack technologique déjà définie ou préférée ?
4. **Contraintes légales** : RGPD ? AI Act ? Données sensibles ? Hébergement souverain requis ?
5. **Performance critique** : Y a-t-il des contraintes de latence, throughput, ou de charge ?
6. **Deadline** : Quelle est la deadline pour un premier livrable fonctionnel ?
7. **Ressources** : Solo ou équipe ? Budget serveur/cloud disponible ?

Attends les réponses pour chaque question.
→ $project_answers

## Step 2: SOTA Research

@parallel

@agent stack-researcher
Basé sur les réponses $project_answers, recherche les meilleures pratiques SOTA 2026
pour ce type de projet. Focus sur :
- Architecture recommandée (hexagonal si applicable)
- Stack technologique optimale
- Librairies et frameworks SOTA
- Patterns de sécurité adaptés au domaine
→ $stack_research

@agent compliance-researcher
@if $intent_analysis.requires_legal_context
Analyse les obligations légales pour ce projet :
- RGPD : données personnelles, CNIL obligations, DPO requis ?
- AI Act : risque level du système (prohibited/high/limited/minimal) ?
- NIS2 : criticité de l'infrastructure ?
- Autres réglementations sectorielles ?
→ $compliance_research
@end

@end

## Step 3: Consolidate Discovery

@agent discovery-consolidator
Consolide les réponses en un contexte structuré utilisable par les agents suivants.

Entrées :
- Réponses projet : $project_answers
- Recherche stack : $stack_research
- Analyse compliance : $compliance_research

Produis un objet JSON structuré avec tous les éléments découverts.
→ $discovery_context

@output discovery_context $discovery_context
