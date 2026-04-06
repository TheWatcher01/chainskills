---
name: lru-cache
domain: coding
difficulty: hard
description: Implement LRU cache with O(1) operations
version: "1.0"
outputs:
  - name: solution
    type: string
  - name: review
    type: string
---

# LRU Cache

## Step 1 — Implement

@agent copilot
Implement an LRU cache in TypeScript with O(1) get and put operations.
Use a doubly-linked list + Map. Include:
- get(key): return value or -1
- put(key, value): insert/update, evict LRU if over capacity
- Generic types: LRUCache<K, V>
- Full type safety

@output solution = $AGENT_RESULT

## Step 2 — Review

@agent reviewer
Review this LRU cache for correctness, performance, and edge cases:
$solution

@output review = $AGENT_RESULT
