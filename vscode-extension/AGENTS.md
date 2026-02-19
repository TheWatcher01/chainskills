# AGENTS.md — vscode-extension

> Project-specific context for the VS Code extension package.
> Shared agents (Research, Architect, Review, Orchestrator, Extension) → [../.github/agents/](../.github/agents/)
> Monorepo index → [../AGENTS.md](../AGENTS.md)

## Package

**vscode-extension** is the VS Code extension of chainskills — provides language features, syntax highlighting, Copilot Chat integration, and a DAG visualizer for `.workflow.md` files.

| Key              | Value                                             |
| ---------------- | ------------------------------------------------- |
| **Language**     | TypeScript (strict)                               |
| **Engine**       | VS Code ^1.90.0 (→ ^1.99.0 for v0.6.0)            |
| **Language ID**  | `workflow-markdown`                               |
| **Bundle**       | Webpack 5 — 77KB (v0.5.0)                         |
| **Build**        | `npm run compile`                                 |
| **Architecture** | VS Code Extension (Disposable + Provider pattern) |

---

## Source Structure

```
src/
├── extension.ts              ← Entry point: activate() + deactivate()
├── commands.ts               ← All 10 command handlers
├── execution-controller.ts   ← POSIX process lifecycle (pause/resume/cancel)
├── tree-provider.ts          ← WorkflowTreeProvider (Explorer sidebar)
├── providers/                ← Language feature providers
│   ├── workflow-document.ts  ← Shared AST cache — parseWorkflowDocument()
│   ├── code-lens.provider.ts        ← Run/Validate/DAG buttons above steps
│   ├── completion.provider.ts       ← @directives, $variables autocomplete
│   ├── diagnostics.provider.ts      ← Live validation (red squiggles)
│   ├── document-link.provider.ts    ← @use, @workflow clickable nav
│   ├── file-decoration.provider.ts  ← ✓/✗/⚡ badges in Explorer
│   ├── folding.provider.ts          ← Collapse :::parallel, :::if blocks
│   ├── hover.provider.ts            ← Directive docs + variable values
│   └── symbols.provider.ts          ← Outline: Workflow → Steps → Directives
└── views/
    └── status-bar.ts         ← Execution status (idle/running/success/error)
```

---

## Agent for Extension Work

Use the **Extension** agent (`.github/agents/Extension.agent.md`) for all VS Code extension tasks.
It knows the full API surface, current state, and v0.6.0 planned features.

```
@Extension: implement the Chat Participant for @chainskills
→ Extension agent knows: createChatParticipant, package.json contributes.chatParticipants,
  engine bump to ^1.99.0, streaming response patterns
```

---

## Key Conventions

1. **Disposable pattern** — Every provider/listener/watcher via `context.subscriptions.push()`
2. **Document selector** — `{ scheme: 'file', language: 'workflow-markdown' }`
3. **Shared cache** — All providers use `parseWorkflowDocument()` from `workflow-document.ts`
4. **No sync APIs** — Always use async VS Code equivalents
5. **Engine awareness** — Chat Participant ≥1.93, lm.registerTool ≥1.99

---

## Current Features (v0.5.0)

| Feature                         | Status | File                                    |
| ------------------------------- | ------ | --------------------------------------- |
| 10 commands                     | ✅     | `commands.ts`                           |
| TreeView (Explorer)             | ✅     | `tree-provider.ts`                      |
| CodeLens (Run/Validate/DAG)     | ✅     | `providers/code-lens.provider.ts`       |
| Completion (@directives, $vars) | ✅     | `providers/completion.provider.ts`      |
| Diagnostics (live validation)   | ✅     | `providers/diagnostics.provider.ts`     |
| Document Links                  | ✅     | `providers/document-link.provider.ts`   |
| File Decorations                | ✅     | `providers/file-decoration.provider.ts` |
| Folding Ranges                  | ✅     | `providers/folding.provider.ts`         |
| Hover Documentation             | ✅     | `providers/hover.provider.ts`           |
| Document Symbols                | ✅     | `providers/symbols.provider.ts`         |
| StatusBar                       | ✅     | `views/status-bar.ts`                   |
| TextMate Grammar                | ✅     | `syntaxes/workflow.tmLanguage.json`     |

## Planned Features (v0.6.0+)

| Feature                         | API                                   | Priority |
| ------------------------------- | ------------------------------------- | -------- |
| Chat Participant `@chainskills` | `vscode.chat.createChatParticipant()` | P0       |
| Agent Mode Tools (6 tools)      | `vscode.lm.registerTool()`            | P0       |
| DAG Webview (D3.js + dagre)     | `vscode.window.createWebviewPanel()`  | P1       |
| Debug Adapter (v0.7.0)          | `DebugAdapterDescriptorFactory`       | P2       |
| Test Controller (v0.7.0)        | `vscode.tests.createTestController()` | P2       |

---

## Build

```bash
cd vscode-extension
npm run compile    # webpack → dist/extension.js (77KB)
```

---

## Roadmap

[Roadmap](../ROADMAP.md)

| Phase                                  | Status                 |
| -------------------------------------- | ---------------------- |
| v0.4.0 Extension skeleton              | ✅ Complété            |
| v0.5.0 Language Features (8 providers) | ✅ Complété 2026-02-19 |
| v0.6.0 Copilot Chat + Agent Mode       | 🔄 En cours            |
| v0.7.0 Debug Adapter + Test Controller | ⏳ Planifié            |
