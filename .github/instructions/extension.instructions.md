---
description: Instructions for the chainskills VS Code extension — activation, commands, providers, webpack, package.json manifest
applyTo: "vscode-extension/**"
---

# VS Code Extension Instructions — chainskills

## Architecture Overview

```
vscode-extension/src/
├── extension.ts              ← Entry point: activate() + deactivate()
├── commands.ts               ← All command handlers
├── execution-controller.ts   ← Process lifecycle (pause/resume/cancel)
├── tree-provider.ts          ← WorkflowTreeProvider
├── providers/                ← Language feature providers
└── views/                    ← StatusBar and other UI elements
```

## Core Rules

### 1. Disposable Pattern — Mandatory

Every provider, listener, watcher, and disposable object MUST be registered:

```typescript
// ✅ Correct
context.subscriptions.push(
  vscode.languages.registerCodeLensProvider(WORKFLOW_SELECTOR, provider),
);

// ❌ Wrong — leaks on deactivation
vscode.languages.registerCodeLensProvider(WORKFLOW_SELECTOR, provider);
```

### 2. Document Selector

All providers targeting `.workflow.md` files must use:

```typescript
const WORKFLOW_SELECTOR = { scheme: "file", language: "workflow-markdown" };
```

### 3. Async APIs Only

```typescript
// ✅ Correct
const doc = await vscode.workspace.openTextDocument(uri);

// ❌ Wrong
const doc = vscode.workspace.textDocuments.find(...); // sync lookup is OK, but prefer async
```

### 4. WorkflowDocument Cache

All providers MUST use the shared cache:

```typescript
import {
  parseWorkflowDocument,
  invalidateCache,
} from "./providers/workflow-document.js";

// Parse (cached)
const parsed = parseWorkflowDocument(document);

// Invalidate when document changes
invalidateCache(document.uri);
```

### 5. Engine Version Awareness

Before using APIs requiring newer VS Code versions, check:

```typescript
// For APIs requiring ^1.99.0 (lm.registerTool, etc.)
// Ensure package.json engines.vscode is ≥ required version
```

## Registration Pattern (extension.ts)

```typescript
export function activate(context: vscode.ExtensionContext): void {
  // 1. Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("chainskills.run", handlers.run),
  );

  // 2. Language providers
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      WORKFLOW_SELECTOR,
      new CodeLensProvider(),
    ),
  );

  // 3. File watchers
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.workflow.md");
  watcher.onDidChange((uri) => invalidateCache(uri));
  context.subscriptions.push(watcher);
}
```

## Package.json Manifest Rules

1. **Commands**: Every command in `commands.ts` must be in `contributes.commands`
2. **Activation events**: Add `onLanguage:workflow-markdown` + specific `onCommand:` entries
3. **Engine bump**: When using APIs with newer requirements, bump `engines.vscode`
4. **New API types**: `contributes.chatParticipants`, `contributes.languageModelTools`

## Build

```bash
cd vscode-extension
npm run compile    # webpack production build → dist/extension.js
```

Bundle size target: < 200KB (currently 77KB at v0.5.0)

## Anti-patterns

- ❌ Missing `context.subscriptions.push()` for any disposable
- ❌ Direct `require()` instead of `import`
- ❌ Synchronous file I/O (`fs.readFileSync` — use `vscode.workspace.fs`)
- ❌ Bundling `cli-mcp-core` into the extension (import from the built package)
- ❌ Accessing `vscode.lm.*` without verifying engine version requirement
