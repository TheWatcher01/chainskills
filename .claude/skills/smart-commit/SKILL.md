---
name: smart-commit
description: "Commits Git groupes par feature avec audit d'architecture — use when committing staged changes with conventional commit messages"
model: haiku
allowed-tools: Bash(git :*), Bash(pnpm :*), Read, Grep
---

# Smart Commit — chainskills

Analyser les changements Git et creer des commits groupes par feature, en verifiant la conformite architecturale.

## Workflow

1. `git status --porcelain` pour lister les changements
2. Grouper par couche architecturale (core / adapters / cli / config / tests / docs)
3. Verifier la conformite avant chaque commit
4. Committer avec messages conventionnels

## Convention de commits

```
type(scope): description courte

- Detail 1
- Detail 2
```

### Types

| Type | Quand |
|---|---|
| `feat` | Nouvelle fonctionnalite |
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

## Audit pre-commit

Avant chaque commit, verifier :

- [ ] Aucun import externe dans `src/core/`
- [ ] Pas de secret hardcode
- [ ] `.env.example` mis a jour si nouvelles variables
- [ ] Tests passent pour les fichiers modifies

## Nettoyage

Supprimer avant commit :
- Fichiers temporaires (`*.tmp`, `*.bak`)
- Scripts de debug
- Logs de test
- Fichiers `.DS_Store`, `Thumbs.db`
