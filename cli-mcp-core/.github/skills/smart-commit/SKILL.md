---
name: smart-commit
description: Commits Git groupés par feature avec audit d'architecture
metadata:
  version: "1.0.0"
  author: chainskills
  agent_support: [copilot, claude, cursor]
---

# Smart Commit — chainskills

Analyser les changements Git et créer des commits groupés par feature, en vérifiant la conformité architecturale.

## Workflow

1. `git status --porcelain` pour lister les changements
2. Grouper par couche architecturale (core / adapters / cli / config / tests / docs)
3. Vérifier la conformité avant chaque commit
4. Committer avec messages conventionnels

## Convention de commits

```
type(scope): description courte

- Détail 1
- Détail 2
```

### Types

| Type | Quand |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `test` | Tests |
| `refactor` | Restructuration sans changement fonctionnel |
| `chore` | Maintenance |
| `config` | Configuration (.github/, tsconfig, build) |

### Scopes

| Scope | Dossier |
|---|---|
| `core` | `src/core/` (entities, use-cases, services, ports) |
| `parser` | `src/adapters/parser/` |
| `executor` | `src/adapters/executor/` |
| `mcp` | `src/adapters/tools/` |
| `skills` | `src/adapters/skills/` |
| `state` | `src/adapters/state/` |
| `registry` | `src/adapters/registry/` |
| `cli` | `src/cli/` |
| `config` | `src/config/` |
| `templates` | `templates/` |
| `infra` | `src/infrastructure/` |

## Audit pré-commit

Avant chaque commit, vérifier :

- [ ] Aucun import externe dans `src/core/`
- [ ] Pas de secret hardcodé
- [ ] `.env.example` mis à jour si nouvelles variables
- [ ] Tests passent pour les fichiers modifiés

## Nettoyage

Supprimer avant commit :
- Fichiers temporaires (`*.tmp`, `*.bak`)
- Scripts de debug
- Logs de test
- Fichiers `.DS_Store`, `Thumbs.db`
