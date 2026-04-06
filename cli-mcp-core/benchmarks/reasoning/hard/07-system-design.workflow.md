---
name: system-design
domain: reasoning
difficulty: hard
description: Design a URL shortener at scale
version: "1.0"
outputs:
  - name: design
    type: string
---

# System Design

## Step 1 — Design

@agent copilot
Design a URL shortener service that handles:
- 100M URLs created per month
- 10:1 read/write ratio (1B redirects/month)
- 99.99% uptime SLA
- Short URLs expire after configurable TTL
Cover:
1. API design (REST endpoints)
2. Database schema (which DB? sharding strategy?)
3. Short URL generation algorithm (collision-free)
4. Caching layer (what to cache, eviction)
5. Rate limiting strategy
6. Analytics (click tracking, geolocation)
7. Scaling: horizontal scaling, CDN, read replicas
Include capacity estimates (storage, bandwidth, QPS).

@output design = $AGENT_RESULT
