---
description: Instructions for chainskills VS Code extension providers — implement VS Code Provider interfaces, use WorkflowDocument cache, register in extension.ts
applyTo: "vscode-extension/src/providers/**"
---

# Provider Instructions — chainskills VS Code Extension

## Provider Architecture

All providers in `vscode-extension/src/providers/` follow this pattern:

```typescript
import type * as vscode from "vscode";
import { parseWorkflowDocument } from "./workflow-document.js";

export class MyProvider implements vscode.MyProviderInterface {
  provideX(
    document: vscode.TextDocument,
    // ...other params
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.X[]> {
    const parsed = parseWorkflowDocument(document);
    if (!parsed) return [];

    // Use parsed.steps, parsed.directives, parsed.variables, parsed.frontmatter
    return buildResult(parsed);
  }
}
```

## WorkflowDocument Cache — Mandatory

**Always** use `parseWorkflowDocument()` from `workflow-document.ts`.
Never parse the document directly or duplicate parsing logic.

```typescript
import {
  parseWorkflowDocument,
  type ParsedWorkflow,
} from "./workflow-document.js";

// ParsedWorkflow shape:
interface ParsedWorkflow {
  steps: Array<{ name: string; line: number; endLine: number }>;
  directives: Array<{ type: string; raw: string; line: number; args: string }>;
  variables: Array<{ name: string; line: number }>;
  frontmatter: Record<string, unknown>;
}
```

## Registration Pattern

Every new provider must be registered in `extension.ts`:

```typescript
// extension.ts — in activate()
import { MyProvider } from "./providers/my.provider.js";

context.subscriptions.push(
  vscode.languages.registerMyProvider(WORKFLOW_SELECTOR, new MyProvider()),
);
```

## Provider File Naming

```
{purpose}.provider.ts

code-lens.provider.ts       → CodeLensProvider
completion.provider.ts      → CompletionItemProvider
diagnostics.provider.ts     → DiagnosticCollection (not a "provider" per se, but same dir)
document-link.provider.ts   → DocumentLinkProvider
file-decoration.provider.ts → FileDecorationProvider
folding.provider.ts         → FoldingRangeProvider
hover.provider.ts           → HoverProvider
symbols.provider.ts         → DocumentSymbolProvider
```

## Existing Providers Reference

| File                          | VS Code API              | Returns                                         |
| ----------------------------- | ------------------------ | ----------------------------------------------- |
| `code-lens.provider.ts`       | `CodeLensProvider`       | Run/Validate/DAG buttons above steps            |
| `completion.provider.ts`      | `CompletionItemProvider` | `@directive`, `$variable`, `@call` autocomplete |
| `diagnostics.provider.ts`     | `DiagnosticCollection`   | Red squiggles for validation errors             |
| `document-link.provider.ts`   | `DocumentLinkProvider`   | Clickable `@use`/`@workflow` paths              |
| `file-decoration.provider.ts` | `FileDecorationProvider` | ✓/✗/⚡ badges in Explorer                       |
| `folding.provider.ts`         | `FoldingRangeProvider`   | Collapse `:::parallel`, `:::if` blocks          |
| `hover.provider.ts`           | `HoverProvider`          | Docs for directives + variable values           |
| `symbols.provider.ts`         | `DocumentSymbolProvider` | Outline: Workflow → Steps → Directives          |

## CancellationToken Convention

Always accept `_token: vscode.CancellationToken` as last parameter (prefix with `_` if unused):

```typescript
provideHover(doc: vscode.TextDocument, pos: vscode.Position, _token: vscode.CancellationToken) {
  // ...
}
```

## Anti-patterns

- ❌ Parsing `.workflow.md` directly (use `parseWorkflowDocument()`)
- ❌ Storing document state in provider instance (use the shared cache)
- ❌ Missing registration in `extension.ts`
- ❌ Using wrong document selector (must be `{ scheme: 'file', language: 'workflow-markdown' }`)
- ❌ Synchronous heavy computation in `provide*()` — use `async` if needed
