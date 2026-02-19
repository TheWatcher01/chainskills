---
name: smart
description: Auto-apprentissage à partir des échecs et corrections
metadata:
  version: "1.0.0"
  author: chainskills
  agent_support: [copilot, claude, cursor]
---

# Smart Learning — chainskills

Quand une erreur survient pendant le développement du projet chainskills, suis ce processus d'auto-apprentissage.

## Workflow d'apprentissage

1. **Identifier** l'erreur (type, message, stack trace)
2. **Diagnostiquer** la cause racine (pas le symptôme)
3. **Corriger** en appliquant les principes d'architecture
4. **Mémoriser** le pattern pour éviter la récurrence

## Patterns fréquents — chainskills

### Architecture violations

| Erreur | Cause | Fix |
|---|---|---|
| Import externe dans `src/core/` | Dependency Rule violation | Créer un port + adapter |
| Adapter instancié dans le CLI | Couplage direct | Utiliser le DI container |
| `throw` dans un use case | Wrong error pattern | Retourner `Result<T, E>` |
| `any` dans une signature | Typage faible | Utiliser generics ou `unknown` |

### Parser errors

| Erreur | Cause | Fix |
|---|---|---|
| Directive non reconnue | Plugin remark manquant | Vérifier `remark-directive` config |
| Frontmatter invalide | Schema YAML incorrect | Valider avec Zod schema |
| Variable `$name` non résolue | Template engine miss | Vérifier le contexte d'exécution |

### Runtime errors

| Erreur | Cause | Fix |
|---|---|---|
| Step timeout | Pas de timeout configuré | Ajouter timeout dans la config |
| MCP connection failed | Serveur non démarré | Vérifier `chainskills serve` |
| State lost between steps | Mauvais state backend | Vérifier `CHAINSKILLS_STATE_BACKEND` |

## Anti-patterns à éviter

- ❌ Importer un package npm dans `src/core/`
- ❌ Hardcoder des valeurs (URLs, seuils, secrets)
- ❌ Utiliser `console.log` au lieu du logger structuré
- ❌ Catch global qui avale les erreurs
- ❌ Tests qui dépendent de l'infra (DB, réseau, filesystem)
