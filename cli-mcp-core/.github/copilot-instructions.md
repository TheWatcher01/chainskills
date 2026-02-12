```instructions
# Copilot Instructions — chainskills

## Project Context

- **Project**: chainskills — Framework de workflows agentiques en langage naturel
- **Langage**: TypeScript (strict) — Node.js ≥ 20, pnpm
- **Architecture**: Hexagonal (Ports & Adapters) — core pur, zéro dépendance
- **Setup**: [AGENTS.md](../AGENTS.md) (agents, skills, architecture)
- **CLI framework**: Citty (UnJS ecosystem)
- **Orchestration**: Mastra (DAG workflows)
- **Parsing**: unified + remark-parse + remark-directive + gray-matter
- **Interop**: MCP SDK (Model Context Protocol)
- **Build**: obuild (Rolldown)
- **Tests**: Vitest

## Key Guidelines

1. **Hexagonal Architecture** — Le domaine (`src/core/`) est strictement indépendant de tout framework/infra. Les dépendances pointent toujours vers l'intérieur. Le core compile et passe ses tests sans DB, serveur, ni framework.
2. **Ports & Adapters** — Chaque intégration externe passe par un port (interface abstraite dans `src/core/ports/`) et un adapter (implémentation concrète dans `src/adapters/`).
3. **Configuration** — Tous les paramètres via variables d'environnement (`.env`). Validation fail-fast au démarrage. Typage fort dès le chargement.
4. **Feature Flags** — Convention hiérarchique (`feature.<domaine>.<nom>.enabled`).
5. **Secrets** — Jamais dans le code ni le git. `.env` = dev local uniquement → `.gitignore`. Production = Secret Manager (Infisical, Doppler, Vault).
6. **Error Handling** — Result/Either pattern pour le flux métier. Exceptions réservées aux pannes techniques.
7. **Logging** — Structuré JSON, corrélation ID, niveaux appropriés. Zéro données sensibles.
8. **Testing** — Unit tests pour le core (Vitest). Integration tests pour les adapters. Coverage ciblée sur les use cases critiques.

## Architecture Rules

### Core (`src/core/`)
- **Entities** : classes pures, value objects immutables (Workflow, Step, Directive, Variable)
- **Use Cases** : orchestrent la logique domaine (parse-workflow, build-dag, validate-workflow, resolve-imports)
- **Services** : logique métier réutilisable (template-engine, condition-parser)
- **Ports** : interfaces abstraites uniquement — jamais d'implémentation

### Adapters (`src/adapters/`)
- **Parser** : remark + plugins custom pour directives `@`
- **Executor** : Mastra (DAG) ou simple-executor (séquentiel fallback)
- **Tools** : MCP client/server, Copilot ACP, shell
- **Skills** : résolution locale, Git, registry
- **State** : memory (dev), SQLite (prod), Redis (scale)

### CLI (`src/cli/`)
- Framework Citty — routing commandes, auto-help
- Prompts interactifs via @clack/prompts
- Couleurs via picocolors

## Format `.workflow.md`

- Frontmatter YAML obligatoire (name, description, version, inputs, outputs, env, tags)
- Directives `@` : `@use`, `@call`, `@if`, `@for`, `@parallel`, `@try`, `@assert`, `@output`, `@agent`, `@handoff`
- Variables : `$name` avec substitution par le template engine
- Sections Markdown = steps du workflow (heading = step boundary)

## Stack Technique

| Couche | Package | Rôle |
|---|---|---|
| CLI | `citty` | Routing commandes |
| Prompts | `@clack/prompts` | Spinners, selects |
| Couleurs | `picocolors` | Console formatting |
| Frontmatter | `gray-matter` | Parse YAML |
| Markdown AST | `unified` + `remark-parse` | Markdown → MDAST |
| Directives | `remark-directive` | Support `@` |
| AST traversal | `unist-util-visit` | Walk/transform |
| Orchestration | `@mastra/core` | DAG workflows |
| MCP | `@modelcontextprotocol/sdk` | Tools interop |
| Schemas | `zod` | Validation typée |
| Build | `obuild` | Bundle TypeScript |
| Tests | `vitest` | Unit + integration |
| Formatting | `prettier` | Code formatting |

## Conventions

- **Naming** : kebab-case pour fichiers et dossiers, PascalCase pour classes/interfaces, camelCase pour fonctions/variables
- **Imports** : ESM only (`import`/`export`), pas de CommonJS
- **Types** : Typage fort partout, generics quand pertinent, `unknown` over `any`
- **Errors** : Types d'erreur domaine avec `Result<T, E>` pattern
- **Tests** : Colocalisés dans `tests/` par domaine (parser, runtime, mcp, cli)
- **Docs** : JSDoc sur chaque export public

```
