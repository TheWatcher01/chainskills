---
name: clean-csv
version: 1.0.0
domain: data
difficulty: easy
description: "Clean and validate CSV data"
---

# Step 1 — Raw CSV
@call shell.exec(echo "name,age,email\nAlice,30,alice@test.com\nBob,,bob@\nCharlie,25,charlie@test.com\n,40,unknown@test.com") → $csv

# Step 2 — Clean
@agent copilot Clean this CSV: remove rows with missing required fields (name, age), fix invalid emails (must contain @ and domain). Return the cleaned CSV: $csv → $cleaned

# Step 3 — Output
@output cleaned = $cleaned
