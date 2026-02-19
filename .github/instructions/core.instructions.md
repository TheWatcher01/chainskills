---
description: Instructions for chainskills core domain — zero deps, Result pattern, immutability
applyTo: "cli-mcp-core/src/core/**"
---

# Core Domain Instructions — chainskills

## Architecture: Domaine Pur

Le dossier `src/core/` contient le domaine pur du framework chainskills.
**Aucune dépendance externe n'est autorisée** dans ce dossier.

## Règles strictes

1. **ZERO import externe** — Pas de `remark`, `mastra`, `zod`, `gray-matter`, ni aucun package npm.
   Seuls les imports depuis `src/core/` sont autorisés.
2. **Immutabilité** — Les entités et value objects doivent être immutables (`readonly` properties).
3. **Types purs** — Utiliser des interfaces TypeScript et des types génériques.
   Pas de `any`, préférer `unknown` quand nécessaire.
4. **Result pattern** — Les use cases retournent `Result<T, E>`, jamais de `throw` pour la logique métier.
5. **Ports = interfaces** — Les fichiers dans `ports/` ne contiennent QUE des interfaces abstraites.
   Jamais d'implémentation, jamais de logique.

## Structure des entités

```typescript
// Exemple — entité Workflow
export interface Workflow {
  readonly name: string; // kebab-case, 1-64 chars
  readonly description: string;
  readonly version: string; // semver
  readonly steps: readonly Step[];
  readonly inputs: readonly InputDef[];
  readonly outputs: readonly OutputDef[];
  readonly env: readonly string[];
  readonly tags: readonly string[];
  readonly metadata: WorkflowMetadata;
}
```

## Structure des ports

```typescript
// Exemple — port executor
export interface WorkflowExecutor {
  execute(
    workflow: WorkflowIR,
    inputs: Record<string, unknown>,
  ): Promise<Result<ExecutionResult, ExecutionError>>;
}
```

## Tests

Les tests du core doivent compiler et passer **sans mock d'infrastructure**.
Ils testent uniquement la logique domaine pure.
