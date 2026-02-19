# chainskills VS Code Extension

VS Code extension for [chainskills](https://github.com/chainskills/chainskills) - AI workflow orchestration in Markdown.

## Features

- **Syntax Highlighting**: Rich syntax coloring for `.workflow.md` files with directive detection (`@use`, `@call`, `@if`, etc.)
- **Workflow Explorer**: Tree view showing all workflows in your workspace with metadata
- **Validation**: Real-time validation with Problems panel integration
- **Execution**: Run workflows directly from VS Code with output streaming
- **DAG Visualization**: Inspect workflow structure with ASCII DAG diagrams
- **Debugging**: Pause/resume/cancel execution, step-through debugging support
- **Templates**: Quick access to pre-built workflow templates
- **Problem Matcher**: Automatic error detection and jump-to-error from Problems panel

## Commands

| Command                                  | Description                             | Shortcut |
| ---------------------------------------- | --------------------------------------- | -------- |
| `chainskills: Run Workflow`              | Execute workflow with chainskills CLI   | -        |
| `chainskills: Run Workflow (Dry Run)`    | Simulate execution without side effects | -        |
| `chainskills: Validate Workflow`         | Check workflow syntax and structure     | -        |
| `chainskills: Inspect Workflow DAG`      | Show workflow DAG visualization         | -        |
| `chainskills: Pause Execution`           | Pause running workflow                  | -        |
| `chainskills: Resume Execution`          | Resume paused workflow                  | -        |
| `chainskills: Stop Execution`            | Cancel running workflow                 | -        |
| `chainskills: Step Through Execution`    | Execute next step in debug mode         | -        |
| `chainskills: Browse Workflow Templates` | Open template selection menu            | -        |
| `chainskills: Refresh Workflows`         | Reload workflow tree view               | -        |

## Configuration

```json
{
  "chainskills.cliPath": "chainskills",
  "chainskills.executor": "mastra",
  "chainskills.autoValidate": true,
  "chainskills.showDagOnInspect": true,
  "chainskills.templatesPath": ""
}
```

## Requirements

- **chainskills CLI**: Install globally with `npm install -g chainskills` or link local development version
- **Node.js**: ≥ 20.0.0
- **VS Code**: ≥ 1.90.0

## Installation

### From VSIX (Local Development)

```bash
# Build extension
cd vscode           # ou chainskills/vscode depuis la racine
npm install
npm run package

# Install in VS Code
code --install-extension chainskills-vscode-0.4.0.vsix
```

### From Marketplace (Coming Soon)

Search "chainskills" in VS Code Extensions marketplace.

## Usage

1. **Open a workspace** containing `.workflow.md` files
2. **View workflows** in the Explorer sidebar (chainskills icon)
3. **Open a workflow** by clicking it in the tree view
4. **Run** by clicking the ▶️ icon in the editor toolbar or right-clicking in the tree view
5. **Validate** with the ✓ icon or on save (if `autoValidate` is enabled)
6. **Inspect DAG** with the graph icon to visualize workflow structure

## Syntax Highlighting

The extension provides rich syntax highlighting for workflow directives:

```markdown
---
name: my-workflow
version: 1.0.0
---

# Step 1

@use pdf-processing
@call pdf.extract($input) → $text

@if $text != "":
Process extracted text...
@else:
Handle empty result...
```

### Highlighted Elements

- **Directives**: `@use`, `@call`, `@if`, `@for`, `@parallel`, `@try`, etc.
- **Variables**: `$input`, `$output`, `$myVar`
- **Tool calls**: `tool.method(...)` with tool and method differentiation
- **Block directives**: `:::if`, `:::for`, `:::parallel` with folding support
- **Frontmatter**: YAML frontmatter with full syntax highlighting

## Problem Matcher Integration

Create a `.vscode/tasks.json` to run chainskills workflows as VS Code tasks:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run Workflow",
      "type": "shell",
      "command": "chainskills",
      "args": ["run", "${file}", "--format=vscode"],
      "problemMatcher": "$chainskills",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    }
  ]
}
```

Errors will appear in the Problems panel with clickable links to the source line.

## Development

```bash
# Clone repos
git clone https://github.com/chainskills/chainskills.git

# Install dependencies
cd chainskills/cli-mcp-core && pnpm install && pnpm run build
cd ../vscode-extension && npm install

# Link chainskills CLI (optional for development)
cd ../cli-mcp-core && npm link
cd ../vscode-extension

# Run extension in development mode
npm run watch       # Terminal 1: compile on change
code .              # Terminal 2: open in VS Code
# Press F5 to launch Extension Development Host
```

## Roadmap

**Phase 1** (v0.4.0) - Core Integration ✅

- ✅ ExecutionController API (pause/resume/cancel)
- ✅ StateStore serialization
- ✅ @breakpoint directive
- ✅ --format=vscode CLI flag

**Phase 2** (v0.5.0) - IDE Language Features 🔄 _In Progress_

- ✅ package.json manifest with core commands
- ✅ TreeView provider for workflows
- ✅ Command handlers (run, validate, inspect)
- ✅ TextMate grammar for syntax highlighting
- ⏳ CodeLens / Diagnostics / Completion / Hover (in progress)
- ⏳ Webview panels (DAG visualizer, execution monitor)

**Phase 3** (v0.6.0) - Advanced Features 📋 _Planned_

- Copilot Chat participant (`@chainskills`)
- Inline completion provider for directives
- Workflow snippets and scaffolding
- Language Server Protocol (LSP) for hover/completion
- Workflow versioning and dependency management

## License

MIT © chainskills

## Links

- [chainskills CLI](https://github.com/chainskills/chainskills)
- [Documentation](https://chainskills.dev)
- [Issue Tracker](https://github.com/chainskills/chainskills/issues)
