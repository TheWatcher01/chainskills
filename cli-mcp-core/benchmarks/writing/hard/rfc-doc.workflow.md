---
name: rfc-doc
version: 1.0.0
domain: writing
difficulty: hard
description: "Draft an RFC document"
---

# Step 1 — Feature
@call shell.exec(echo "Feature: Add streaming support to the agent provider interface. Motivation: Long-running agent tasks need real-time output. Constraint: Must be backwards-compatible with existing sync interface.") → $feature

# Step 2 — RFC
@agent writer Write an RFC document. Include: Title, Status (Draft), Author, Abstract, Motivation, Detailed Design (with code examples), Alternatives Considered, Migration Strategy, Drawbacks, and Unresolved Questions. Follow Rust RFC format: $feature → $rfc

# Step 3 — Output
@output rfc = $rfc
