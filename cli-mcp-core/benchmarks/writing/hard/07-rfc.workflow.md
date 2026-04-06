---
name: rfc
domain: writing
difficulty: hard
description: Write a technical RFC for a distributed cache
version: "1.0"
outputs:
  - name: rfc
    type: string
---

# Technical RFC

## Step 1 — Write

@agent writer
Write a technical RFC for implementing a distributed cache layer:
- Problem: 500ms average API latency, 10K req/s, repeated expensive DB queries
- Proposed: Redis cluster with read-through/write-behind pattern
- Include: Motivation, Goals/Non-Goals, Design (cache invalidation strategy, TTL policy, consistency model), Alternatives (Memcached, embedded cache, CDN), Migration Plan, Metrics, Risks, Timeline
Follow Google's RFC template style. Be specific with numbers and trade-offs.

@output rfc = $AGENT_RESULT
