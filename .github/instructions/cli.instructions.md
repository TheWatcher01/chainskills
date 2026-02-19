---
description: Instructions for chainskills CLI commands — Citty conventions, one-file-per-command, DI
applyTo: "cli-mcp-core/src/cli/**"
---

# CLI Instructions — chainskills

## Framework: Citty

Toutes les commandes CLI utilisent [Citty](https://github.com/unjs/citty) (UnJS ecosystem).

## Conventions

1. **Un fichier = une commande** — `run.ts`, `validate.ts`, `init.ts`, etc.
2. **Export `defineCommand()`** — Chaque commande exporte un objet Citty.
3. **Prompts interactifs** — Utiliser `@clack/prompts` pour les interactions.
4. **Couleurs** — Utiliser `picocolors` pour le formatage console.
5. **Erreurs** — Afficher des messages clairs avec `pc.red()`, exit code 1 pour les erreurs.
6. **Dry run** — Supporter `--dry-run` quand applicable (affiche le plan sans exécuter).

## Structure d'une commande

```typescript
import { defineCommand } from "citty";
import pc from "picocolors";

export default defineCommand({
  meta: {
    name: "run",
    description: "Execute a .workflow.md file",
  },
  args: {
    workflow: {
      type: "positional",
      description: "Path to the .workflow.md file",
      required: true,
    },
    input: {
      type: "string",
      description: "Input parameters (key=value)",
      alias: "i",
    },
    dryRun: {
      type: "boolean",
      description: "Show execution plan without running",
      default: false,
    },
  },
  async run({ args }) {
    // Use DI container to get executor
    // Call use case
    // Display results
  },
});
```

## DI Integration

Les commandes CLI utilisent le DI container (`src/config/container.ts`) pour obtenir les implémentations concrètes des ports.
Le CLI ne doit JAMAIS instancier directement un adapter.
