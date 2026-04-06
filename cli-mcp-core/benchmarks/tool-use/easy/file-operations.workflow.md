---
name: file-operations
version: 1.0.0
domain: tool-use
difficulty: easy
description: "Perform basic file operations"
---

# Step 1 — Create a temp file
@call shell.exec(echo "Hello, benchmark!" > /tmp/cs-bench-test.txt && cat /tmp/cs-bench-test.txt) → $content

# Step 2 — Transform
@call shell.exec(echo "$content" | tr "[:lower:]" "[:upper:]") → $upper

# Step 3 — Count
@call shell.exec(echo "$content" | wc -c) → $count

# Step 4 — Output
@output content = $content
@output upper = $upper
@output count = $count
