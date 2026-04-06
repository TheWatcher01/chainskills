---
name: translate-doc
version: 1.0.0
domain: writing
difficulty: easy
description: "Translate technical documentation"
---

# Step 1 — English text
@call shell.exec(echo "## Getting Started\n\nInstall the CLI globally:\n\n```bash\nnpm install -g chainskills\n```\n\nCreate your first workflow:\n\n```bash\nchainskills init my-workflow\n```") → $english

# Step 2 — Translate
@agent writer Translate this technical documentation to French. Keep code blocks, command names, and technical terms unchanged: $english → $french

# Step 3 — Output
@output french = $french
