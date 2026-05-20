---
name: strategy-layer
description: RD-Orchestra — 4 agents spécialistes en parallèle → TECH_SPEC.md validé
version: 1.0.0
inputs:
  - name: session_context
    description: SESSION_CONTEXT.yaml de la session init
    required: true
  - name: discovery_context
    description: Contexte de découverte
    required: true
outputs:
  - name: tech_spec
    description: TECH_SPEC.md validé et approuvé
tags: [rd-orchestra, strategy, architecture]
---

# Strategy Layer — Agents Spécialistes

## Step 1: Parallel Expert Analysis

@parallel

@agent architect-agent
Tu es un expert en architecture logicielle SOTA 2026.
Contexte : $session_context | $discovery_context

Recommande :
- Pattern architectural optimal (hexagonal/DDD/CQRS/event-driven...)
- Découpage en modules/domaines
- Ports et adapters principaux
- Stratégie de persistance (DB, cache, queue)
- Points d'extension futurs

Justifie chaque choix avec des trade-offs explicites.
→ $arch_recommendation

@agent algo-agent
Tu es un expert en algorithmes et structures de données SOTA 2026.
Contexte : $session_context | $discovery_context

Recommande :
- Algorithmes optimaux pour les cas d'usage identifiés
- Complexités O() et trade-offs mémoire/CPU
- SOTA papers/implémentations récents si pertinents
- Structures de données adaptées aux volumes de données
→ $algo_recommendation

@agent stack-agent
Tu es un expert en sélection de stack technologique SOTA 2026.
Contexte : $session_context | $discovery_context

Recommande :
- Runtime / langage principal + justification
- Frameworks et librairies (avec versions et maturité)
- Infrastructure (conteneurs, cloud, hébergement souverain si requis)
- Outils DevSecOps (CI/CD, SAST, monitoring)
- Compatibilité licences open-source
→ $stack_recommendation

@agent security-agent
Tu es un expert OWASP / RGPD / AI Act / NIS2 2026.
Contexte : $session_context | $discovery_context

Recommande :
- Threat model pour ce type de projet
- Contrôles de sécurité OWASP Top 10 applicables
- Architecture RGPD by design (minimisation, pseudonymisation, DPO)
- Conformité AI Act si système d'IA (risk level + obligations)
- Checklist DevSecOps obligatoire
→ $security_recommendation

@end

## Step 2: Consolidate into TECH_SPEC

@schema {
  "type": "object",
  "required": ["project", "architecture", "algorithms", "stack", "security", "implementation_plan"],
  "properties": {
    "project": { "type": "object" },
    "architecture": { "type": "object" },
    "algorithms": { "type": "array" },
    "stack": { "type": "object" },
    "security": { "type": "object" },
    "implementation_plan": { "type": "array" }
  }
}

@agent tech-spec-consolidator
Consolide les recommandations des 4 experts en un TECH_SPEC.md structuré et cohérent.

Entrées :
- Architecture : $arch_recommendation
- Algorithmes : $algo_recommendation
- Stack : $stack_recommendation
- Sécurité : $security_recommendation

Format de sortie : document Markdown avec sections :
1. Résumé exécutif (3 bullets)
2. Architecture (diagramme ASCII + description)
3. Stack technique (tableau avec justifications)
4. Algorithmes clés (avec complexités)
5. Sécurité & Conformité (checklist)
6. Plan d'implémentation (sprints)
7. Risques & mitigations

Identifie et signale tout conflit entre les recommandations.
→ $tech_spec

## Step 3: Human Validation Gate

@gate "TECH_SPEC.md généré par 4 agents spécialistes.\n\nValidez pour continuer vers l'exécution ?"

@output tech_spec $tech_spec
