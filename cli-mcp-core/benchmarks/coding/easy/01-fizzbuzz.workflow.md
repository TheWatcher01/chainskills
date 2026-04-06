---
name: fizzbuzz
domain: coding
difficulty: easy
description: Generate FizzBuzz solution for N=20
version: "1.0"
inputs:
  - name: n
    type: string
    default: "20"
outputs:
  - name: solution
    type: string
---

# FizzBuzz

## Step 1 — Generate

@agent copilot
Write a FizzBuzz function in JavaScript that prints numbers from 1 to $n.
For multiples of 3 print "Fizz", for multiples of 5 print "Buzz",
for multiples of both print "FizzBuzz".

@output solution = $AGENT_RESULT
