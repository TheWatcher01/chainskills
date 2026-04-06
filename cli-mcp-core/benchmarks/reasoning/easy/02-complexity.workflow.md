---
name: complexity-analysis
domain: reasoning
difficulty: easy
description: Analyze time and space complexity
version: "1.0"
outputs:
  - name: analysis
    type: string
---

# Complexity Analysis

## Step 1 — Analyze

@agent reviewer
Analyze the time and space complexity of each function:
```python
def func1(n):
    for i in range(n):
        for j in range(n):
            print(i, j)

def func2(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = func2(arr[:mid])
    right = func2(arr[mid:])
    return merge(left, right)

def func3(n, memo={}):
    if n in memo: return memo[n]
    if n <= 1: return n
    memo[n] = func3(n-1) + func3(n-2)
    return memo[n]
```
For each: Big-O time, Big-O space, best/worst case.

@output analysis = $AGENT_RESULT
