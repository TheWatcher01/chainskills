# Testing Guide — chainskills VS Code Extension

## Prerequisites

✅ **Completed**:
- chainskills CLI built and linked globally (`npm link`)
- Extension compiled successfully (dist/extension.js - 23 KB)
- Test workflow created (test-workflow.workflow.md)

## Quick Test (5 minutes)

### 1. Launch Extension Development Host

```bash
cd /home/TheWatcher01/projects/chainskills-vscode
code .
```

In VS Code:
1. Press **F5** (or Run > Start Debugging)
2. A new "Extension Development Host" window will open
3. The extension is now active in this window

### 2. Verify Installation

In the Extension Development Host window:

**Check 1: Syntax Highlighting**
- Open `test-workflow.workflow.md`
- Verify directives are colored (`@env`, `@if`, `@else`, `@output`)
- Verify variables are colored (`$target`, `$result`, `$TARGET`)

**Check 2: TreeView**
- Open Explorer (Ctrl+Shift+E)
- Look for "CHAINSKILLS WORKFLOWS" view at the bottom
- Should show: test-workflow (v1.0.0)
- Click to open the file

**Check 3: Commands (Command Palette - Ctrl+Shift+P)**
- Type "chainskills"
- Should see 10 commands:
  - chainskills: Run Workflow
  - chainskills: Run Workflow (Dry Run)
  - chainskills: Validate Workflow
  - chainskills: Inspect Workflow DAG
  - chainskills: Pause Execution
  - chainskills: Resume Execution
  - chainskills: Stop Execution
  - chainskills: Step Through Execution
  - chainskills: Browse Workflow Templates
  - chainskills: Refresh Workflows

**Check 4: Editor Toolbar**
- Open `test-workflow.workflow.md`
- Look at the editor toolbar (top right)
- Should see 3 icons:
  - ▶️ Run Workflow
  - ✓ Validate Workflow
  - 📊 Inspect Workflow DAG

### 3. Test Core Features

#### Test Validation

1. Open `test-workflow.workflow.md`
2. Click the ✓ icon in editor toolbar (or Ctrl+Shift+P > "chainskills: Validate Workflow")
3. Check the **Problems** panel (View > Problems)
4. Should show: "Workflow validated successfully" (or errors if any)

#### Test DAG Inspection

1. With `test-workflow.workflow.md` open
2. Click the 📊 icon (or run "Inspect Workflow DAG")
3. Check the **Output** panel (View > Output, select "chainskills DAG")
4. Should show ASCII DAG:
   ```
   ┌─────────────────────┐
   │ test-workflow       │
   └─────────────────────┘
           │
           ▼
   ┌─────────────────────┐
   │ Step 1: Initialize  │
   └─────────────────────┘
           │
           ▼
   ┌─────────────────────┐
   │ Step 2: Execute Test│
   └─────────────────────┘
           │
           ▼
   ┌─────────────────────┐
   │ Step 3: Output      │
   └─────────────────────┘
   ```

#### Test Execution (Dry Run)

1. With `test-workflow.workflow.md` open
2. Run command: "chainskills: Run Workflow (Dry Run)"
3. Check **Output** panel (select "chainskills")
4. Should show:
   ```
   Running workflow: test-workflow.workflow.md
   [DRY RUN] Workflow executed successfully
   ```

#### Test Execution (Real)

1. With `test-workflow.workflow.md` open
2. Click ▶️ icon (or run "chainskills: Run Workflow")
3. Enter input: `target=example.com`
4. Check **Output** panel
5. Should show:
   - Step execution logs
   - Variable substitutions
   - Final output

### 4. Test TreeView Interactions

1. In Explorer, find "CHAINSKILLS WORKFLOWS"
2. Right-click on test-workflow
3. Context menu should show:
   - Run Workflow
   - Run Workflow (Dry Run)
   - Validate Workflow
   - Inspect Workflow DAG

### 5. Test Configuration

1. Open Settings (Ctrl+,)
2. Search "chainskills"
3. Should see 5 settings:
   - **CLI Path**: chainskills (default)
   - **Executor**: mastra (dropdown: simple | mastra)
   - **Auto Validate**: true (checkbox)
   - **Show DAG on Inspect**: true (checkbox)
   - **Templates Path**: (empty string)

## Full Test Suite (15 minutes)

### Test 1: Auto-Validation on Save

1. Open `test-workflow.workflow.md`
2. Make sure "Auto Validate" is enabled in settings
3. Add a syntax error: `@invalid_directive`
4. Save (Ctrl+S)
5. **Expected**: Problems panel shows error immediately

### Test 2: File Watcher

1. Create a new file: `new-workflow.workflow.md`
2. Add minimal frontmatter:
   ```yaml
   ---
   name: new-workflow
   version: 1.0.0
   ---
   
   # Step 1
   
   Test
   ```
3. Save
4. **Expected**: TreeView refreshes, shows new-workflow

### Test 3: Execution Control (requires long-running workflow)

Create `long-workflow.workflow.md`:
```markdown
---
name: long-workflow
version: 1.0.0
---

# Step 1

@repeat max:10 until false:
  Long running step...
```

1. Run the workflow
2. While running, click **Pause** button in status bar
3. **Expected**: Process paused (SIGSTOP)
4. Click **Resume**
5. **Expected**: Execution continues
6. Click **Stop**
7. **Expected**: Process terminated (SIGTERM)

### Test 4: Template Browser

1. Set `chainskills.templatesPath` to `/home/TheWatcher01/projects/chainskills/templates`
2. Run "chainskills: Browse Workflow Templates"
3. Should show 5 templates:
   - Code Review
   - TDD Cycle
   - Domain Reconnaissance
   - Vulnerability Scan
   - Grant Application
4. Select one
5. **Expected**: Opens the template file

### Test 5: Problem Matcher Integration

1. Create `.vscode/tasks.json` in the Extension Development Host workspace:
   ```json
   {
     "version": "2.0.0",
     "tasks": [
       {
         "label": "Run Workflow",
         "type": "shell",
         "command": "chainskills",
         "args": ["run", "${file}", "--format=vscode"],
         "problemMatcher": "$chainskills"
       }
     ]
   }
   ```
2. Open a workflow with errors
3. Run task: Terminal > Run Task > "Run Workflow"
4. **Expected**: Errors in Problems panel with clickable links

## Debug Extension Code

To debug the extension TypeScript code:

1. Set breakpoints in `src/extension.ts`, `src/commands.ts`, etc.
2. Press F5 to launch Extension Development Host
3. Trigger the code path (e.g., run a command)
4. Debugger will pause at breakpoints
5. Inspect variables, step through code

## Package Extension for Distribution

```bash
cd /home/TheWatcher01/projects/chainskills-vscode
npm run package
```

This creates: `chainskills-vscode-0.4.0.vsix`

Install manually:
```bash
code --install-extension chainskills-vscode-0.4.0.vsix
```

## Troubleshooting

### Extension not activating

**Check**: Output panel > "Extension Host"
**Look for**: "chainskills extension is now active"

### Commands not showing

**Check**: `package.json` > `activationEvents`
**Ensure**: `onLanguage:markdown` or `workspaceContains:**/*.workflow.md`

### TreeView empty

**Check**: Are there `.workflow.md` files in workspace?
**Debug**: Set breakpoint in `WorkflowTreeProvider.getChildren()`

### CLI not found

**Check**: Settings > chainskills.cliPath
**Verify**: Run `which chainskills` in terminal
**Fix**: Run `npm link` in chainskills repo

### Syntax highlighting not working

**Check**: `syntaxes/workflow.tmLanguage.json` registered in `package.json`
**Verify**: File language is "Workflow Markdown" (bottom right status bar)

## Test Checklist

- [ ] Extension activates without errors
- [ ] TreeView shows workflows in Explorer
- [ ] Syntax highlighting for directives and variables
- [ ] 10 commands appear in Command Palette
- [ ] Validate command shows errors in Problems panel
- [ ] Inspect command shows DAG in Output panel
- [ ] Run command executes workflow
- [ ] Dry run simulates execution
- [ ] Editor toolbar shows 3 icons
- [ ] TreeView context menu works
- [ ] Auto-validate on save triggers
- [ ] File watcher refreshes tree
- [ ] Template browser opens templates
- [ ] Configuration settings persist
- [ ] Problem Matcher parses errors

## Next Steps

After successful testing:

1. **Commit Phase 2**: Git commit the extension skeleton
2. **Update ROADMAP.md**: Mark Phase 2 as completed
3. **Phase 3 Planning**: Webview panels (DAG visualizer, execution monitor)
4. **Phase 4 Planning**: Copilot Chat integration (@chainskills participant)
