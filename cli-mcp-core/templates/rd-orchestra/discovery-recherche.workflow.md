---
name: discovery-recherche
description: Questions de découverte pour une veille technologique ou recherche SOTA
version: 1.0.0
inputs:
  - name: intent_analysis
    description: Résultat de la classification d'intention
    required: true
outputs:
  - name: discovery_context
    description: Contexte structuré de la recherche
tags: [rd-orchestra, discovery, recherche, veille]
---

# Discovery — Recherche & Veille

## Step 1: Research Scoping

@agent discovery-agent
Contexte : $intent_analysis.summary

Pose ces questions pour cadrer la recherche :

1. **Domaine** : Quel est le domaine exact de recherche ? (ex: LLM fine-tuning, architecture microservices, RGPD)
2. **Profondeur** : Veille rapide (1h) ou étude approfondie (1 journée+) ?
3. **Angle** : Comparaison de solutions ? Évaluation d'une techno spécifique ? SOTA papers ?
4. **Contexte d'usage** : À quel projet ou décision cette recherche doit-elle contribuer ?
5. **Contraintes** : Solutions open-source uniquement ? Budget ? Contraintes techniques ?
6. **Livrables** : Rapport de synthèse ? Recommandation ? Proof of concept ?

→ $research_answers

## Step 2: Initial SOTA Survey

@parallel

@agent sota-researcher
Basé sur $research_answers, effectue une enquête SOTA initiale :
- 3-5 solutions/approches majeures dans le domaine
- Adoption (stars GitHub, npm downloads, publications)
- Comparatif forces/faiblesses
- Papers arXiv récents (2024-2026) si applicable
→ $sota_survey

@agent constraints-analyzer
Analyse les contraintes et filtres applicables depuis $research_answers :
- Licences compatibles (MIT/Apache/AGPL)
- Compatibilité stack existante
- Souveraineté numérique (EU-hosted, self-hostable)
→ $constraints_filter

@end

## Step 3: Consolidate

@agent discovery-consolidator
Consolide les réponses et l'enquête SOTA initiale.
Entrées : $research_answers + $sota_survey + $constraints_filter
→ $discovery_context

@output discovery_context $discovery_context
