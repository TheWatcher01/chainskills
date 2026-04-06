---
name: refactor-strategy
domain: reasoning
difficulty: medium
description: Analyze code smells and propose refactoring
version: "1.0"
outputs:
  - name: smells
    type: string
  - name: refactored
    type: string
---

# Refactoring Strategy

## Step 1 — Analyze

@agent reviewer
Identify all code smells in this TypeScript code:
```typescript
function processOrder(order: any) {
  let total = 0;
  let discount = 0;
  if (order.type === 'premium') {
    for (const item of order.items) {
      total += item.price * item.quantity;
    }
    if (total > 100) discount = total * 0.1;
    else if (total > 50) discount = total * 0.05;
    total -= discount;
    if (order.coupon === 'SAVE20') total *= 0.8;
    if (order.member) total -= 5;
  } else if (order.type === 'standard') {
    for (const item of order.items) {
      total += item.price * item.quantity;
    }
    if (total > 200) discount = total * 0.05;
    total -= discount;
    if (order.coupon === 'SAVE20') total *= 0.8;
  } else {
    for (const item of order.items) {
      total += item.price * item.quantity;
    }
  }
  return { total, discount, tax: total * 0.2 };
}
```

@output smells = $AGENT_RESULT

## Step 2 — Refactor

@agent copilot
Refactor based on this analysis using Strategy pattern and proper types:
$smells

@output refactored = $AGENT_RESULT
