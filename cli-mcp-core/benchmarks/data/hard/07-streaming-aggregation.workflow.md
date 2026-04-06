---
name: streaming-aggregation
domain: data
difficulty: hard
description: Implement streaming window aggregation
version: "1.0"
outputs:
  - name: solution
    type: string
---

# Streaming Aggregation

## Step 1 — Implement

@agent copilot
Implement a TypeScript streaming aggregation engine:
- Sliding window of configurable duration
- Supports: count, sum, avg, min, max, percentile(p)
- Watermark-based event-time processing
- Late event handling with configurable allowed lateness
- Memory-efficient (don't store all events)

@output solution = $AGENT_RESULT
