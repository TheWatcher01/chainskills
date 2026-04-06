---
name: csv-parse
domain: data
difficulty: easy
description: Parse CSV string into structured records
version: "1.0"
outputs:
  - name: solution
    type: string
---

# CSV Parser

## Step 1 — Parse

@agent copilot
Write a Python function that parses this CSV string into a list of dictionaries:
```
name,age,city
Alice,30,Paris
Bob,25,Lyon
Charlie,35,Marseille
```
Handle quoted fields and escaped commas.

@output solution = $AGENT_RESULT
