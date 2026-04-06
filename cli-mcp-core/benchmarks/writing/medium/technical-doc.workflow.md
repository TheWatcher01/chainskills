---
name: technical-doc
version: 1.0.0
domain: writing
difficulty: medium
description: "Generate API documentation"
---

# Step 1 — Code
@call shell.exec(echo "export async function createUser(name: string, email: string, role?: \"admin\" | \"user\"): Promise<{ id: string; name: string; email: string; role: string; createdAt: Date }> { ... }") → $code

# Step 2 — Document
@agent writer Generate comprehensive API documentation for this function. Include: description, parameters (with types and defaults), return type, examples, error cases, and usage notes. Format as markdown: $code → $docs

# Step 3 — Output
@output docs = $docs
