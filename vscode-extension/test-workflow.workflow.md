---
name: test-workflow
description: Simple test workflow for extension validation
version: 1.0.0
inputs:
  - name: target
    description: Test target
    required: true
outputs:
  - name: result
    description: Test result
---

# Step 1: Initialize

@env TARGET

Test workflow for chainskills VS Code extension.

## Variables

- Target: $target
- Environment: $TARGET

# Step 2: Execute Test

@if $target != "":
Execute test on target...
@else:
No target specified.

# Step 3: Output

@output: $result

Done!
