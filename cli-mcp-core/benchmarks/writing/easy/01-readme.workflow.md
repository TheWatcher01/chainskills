---
name: readme-generator
domain: writing
difficulty: easy
description: Generate a README.md for a CLI tool
version: "1.0"
inputs:
  - name: project_name
    type: string
    default: "mytool"
outputs:
  - name: readme
    type: string
---

# README Generator

## Step 1 — Generate

@agent writer
Write a professional README.md for a CLI tool called "$project_name":
- Include: badges, installation (npm), usage examples, configuration, contributing, license
- Use proper markdown formatting
- Keep it concise but comprehensive

@output readme = $AGENT_RESULT
