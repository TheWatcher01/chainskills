---
name: race-condition
domain: reasoning
difficulty: medium
description: Identify and fix race conditions
version: "1.0"
outputs:
  - name: analysis
    type: string
  - name: fixed
    type: string
---

# Race Condition

## Step 1 — Identify

@agent reviewer
Identify all race conditions and concurrency bugs:
```typescript
let balance = 100;

async function withdraw(amount: number): Promise<boolean> {
  if (balance >= amount) {
    await simulateNetworkDelay();
    balance -= amount;
    return true;
  }
  return false;
}

async function transfer(from: Account, to: Account, amount: number) {
  const success = await from.withdraw(amount);
  if (success) {
    await to.deposit(amount);
  }
}

// Called concurrently
Promise.all([withdraw(80), withdraw(80)]);
```

@output analysis = $AGENT_RESULT

## Step 2 — Fix

@agent copilot
Fix all race conditions using mutex/semaphore pattern in TypeScript:
$analysis

@output fixed = $AGENT_RESULT
