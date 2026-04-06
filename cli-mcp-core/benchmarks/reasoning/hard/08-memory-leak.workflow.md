---
name: memory-leak
domain: reasoning
difficulty: hard
description: Diagnose and fix a Node.js memory leak
version: "1.0"
outputs:
  - name: diagnosis
    type: string
  - name: fixed
    type: string
---

# Memory Leak Diagnosis

## Step 1 — Diagnose

@agent reviewer
Identify ALL memory leaks in this Express.js server:
```typescript
const cache = new Map();
const listeners: Function[] = [];

app.get('/data/:key', async (req, res) => {
  const key = req.params.key;
  if (!cache.has(key)) {
    const data = await fetchFromDB(key);
    cache.set(key, data);
  }
  const callback = () => console.log(`Accessed: ${key}`);
  listeners.push(callback);
  process.on('SIGUSR2', callback);
  const timer = setInterval(() => {
    console.log(`Heartbeat for ${key}`);
  }, 1000);
  res.json(cache.get(key));
});

app.post('/upload', (req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    globalThis.__lastUpload = body;
    res.json({ size: body.length });
  });
});
```

@output diagnosis = $AGENT_RESULT

## Step 2 — Fix

@agent copilot
Fix all memory leaks identified:
$diagnosis

@output fixed = $AGENT_RESULT
