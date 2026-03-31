---
name: project-bootstrap
description: "Factory logicielle : interrogatoire interactif → architecture → scaffolding TWB complet. 0 token de generation, 100% blocks prefabriques."
model: opus
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# Project Bootstrap — Software Factory

Scaffolde un projet complet en injectant des blocks TWB prefabriques.
Zero generation LLM pour le boilerplate. Opus orchestre, TWB construit.

## Phase 1 — Interrogatoire interactif

Poser ces questions une par une avec AskUserQuestion. Adapter les questions suivantes
en fonction des reponses precedentes.

### Questions obligatoires

1. **Nom du projet** (kebab-case)
2. **Description courte** (1 ligne)
3. **Type de projet** :
   - `api` — Backend API (Hono/Express/Fastify)
   - `fullstack` — Frontend + Backend (Next.js)
   - `cli` — Outil ligne de commande (citty/commander)
   - `mcp-server` — Serveur MCP pour Claude Code
   - `library` — Librairie TypeScript
   - `monorepo` — Multi-packages (turborepo/pnpm workspaces)
   - `data-pipeline` — ETL/crawling/import
   - `extension` — Extension VS Code

4. **Architecture** (proposer la recommandee selon le type) :
   - `hexagonal` — Ports & Adapters (recommande pour api, data-pipeline, mcp-server)
   - `clean` — Clean Architecture (recommande pour fullstack)
   - `modular` — Feature-based modules (recommande pour monorepo)
   - `flat` — Structure plate (recommande pour cli, library)

5. **Stack technique** (proposer les defaults selon le type) :
   - Runtime : Node.js / Bun / Deno
   - Framework : Hono / Next.js / Express / Fastify / Citty
   - ORM : Prisma / Drizzle / aucun
   - Base de donnees : PostgreSQL / SQLite / aucune
   - Validation : Zod (toujours)
   - Tests : Vitest (toujours)
   - UI (si fullstack) : React + Tailwind + shadcn/ui / autre

### Questions conditionnelles

6. **Si data-pipeline** : Quelles sources ? (sirene, rna, ademe, custom API...)
7. **Si api** : Endpoints principaux ? (ex: /users, /products, /search)
8. **Si fullstack** : Pages principales ? (ex: dashboard, auth, settings)
9. **Si mcp-server** : Tools a exposer ? (ex: run, validate, search)
10. **Port souhaite** (verifier PORTS-REGISTRY.md)
11. **Deploiement** : Docker / VPS / Vercel / local seulement
12. **Claude Code assets** : skills, agents, hooks, rules ? (defaut: oui, full stack agentic)

## Phase 2 — Plan d'architecture

Generer un plan base sur les reponses. Format :

```markdown
## Plan de construction — {nom_projet}

### Architecture : {architecture}
### Stack : {runtime} + {framework} + {orm} + {db}

### Blocks TWB a injecter :
1. config/tsconfig-strict
2. config/vitest
3. adapter/hexagonal-port × N
4. ...

### Structure cible :
src/
├── core/
│   ├── entities/
│   ├── ports/
│   └── services/
├── adapters/
├── config/
└── cli/ (ou app/, server/, etc.)

### Estimation : N fichiers, 0 token de generation
```

Presenter le plan et demander validation avant de continuer.

## Phase 3 — Scaffolding TWB

Executer les commandes TWB dans l'ordre :

```bash
# 1. Init projet
mkdir -p {nom_projet} && cd {nom_projet}
pnpm init
twb init

# 2. Configs de base
twb add config tsconfig-strict
twb add config vitest

# 3. Architecture (selon le preset)
# Pour hexagonal :
twb add schema data-provenance
twb add adapter hexagonal-port --var NAME=... --var DESCRIPTION=...
# Pour chaque endpoint/source/feature identifie

# 4. Docker (si deploiement Docker)
twb add config dockerfile --var NAME={nom} --var PORT={port}
twb add config docker-compose --var NAME={nom} --var PORT={port}

# 5. Claude Code assets
twb add skill research
twb add skill smart-commit
twb add agent agent-definition --var NAME=reviewer --var DESCRIPTION="Code review"
```

## Phase 4 — Personnalisation

Apres le scaffolding TWB, adapter UNIQUEMENT les 5-10% de logique metier
qui sont specifiques au projet. C'est la seule partie qui necessite des tokens Opus.

## Phase 5 — Verification

```bash
pnpm install
pnpm typecheck    # doit passer
pnpm test         # doit passer (tests vides mais valides)
twb list          # afficher les blocks utilises
```

## Regles

- JAMAIS generer du code qui existe dans TWB
- Toujours verifier `twb search <keyword>` avant d'ecrire
- Verifier PORTS-REGISTRY.md avant d'attribuer un port
- Verifier api-registry/REGISTRY.md avant d'ajouter une API
- Deleguer le boilerplate a Haiku quand possible
- Le plan doit etre valide par l'utilisateur avant execution
