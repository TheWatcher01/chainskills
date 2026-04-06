---
name: event-emitter
domain: coding
difficulty: hard
description: Type-safe event emitter with generics
version: "1.0"
outputs:
  - name: solution
    type: string
---

# Type-Safe Event Emitter

## Step 1 — Implement

@agent copilot
Implement a type-safe event emitter in TypeScript:
- on<K>(event: K, listener): unsubscribe function
- emit<K>(event: K, ...args): void
- once<K>(event: K, listener): unsubscribe function
- removeAllListeners(event?): void
The event map should be a generic parameter for full type safety.

@output solution = $AGENT_RESULT
