---
name: architecture-doc
domain: writing
difficulty: medium
description: Generate architecture decision record
version: "1.0"
outputs:
  - name: adr
    type: string
---

# Architecture Decision Record

## Step 1 — Generate

@agent writer
Write an Architecture Decision Record (ADR) for choosing between REST and GraphQL for a new microservices API.
Context: 5 microservices, mobile + web clients, real-time needs, team of 8 developers.
Follow the MADR format:
- Title, Status, Date
- Context and Problem Statement
- Decision Drivers
- Considered Options (REST, GraphQL, gRPC)
- Decision Outcome with pros/cons
- Consequences

@output adr = $AGENT_RESULT
