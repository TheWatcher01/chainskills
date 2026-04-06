---
name: error-recovery-chain
version: 1.0.0
domain: tool-use
difficulty: hard
description: "Handle errors and recover gracefully"
---

# Step 1 — Try a command that might fail
@try
@call shell.exec(cat /nonexistent/file.txt) → $content
@on-error
@call shell.exec(echo "File not found, using fallback") → $content

# Step 2 — Continue with fallback
@agent copilot The previous step resulted in: $content. Was it a fallback? If so, suggest what the original operation might have been trying to do and recommend a fix: $content → $analysis

# Step 3 — Try another with retry logic
@try
@call shell.exec(echo "Success on attempt") → $result
@on-error
@call shell.exec(echo "Retry exhausted") → $result

# Step 4 — Output
@output content = $content
@output analysis = $analysis
@output result = $result
