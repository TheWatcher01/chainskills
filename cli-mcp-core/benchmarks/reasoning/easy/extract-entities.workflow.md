---
name: extract-entities
version: 1.0.0
domain: reasoning
difficulty: easy
description: "Extract named entities from text"
---

# Step 1 — Text
@call shell.exec(echo "Alice Smith from Anthropic presented at the NeurIPS 2025 conference in Vancouver. She discussed their new Claude model and its performance on the MMLU benchmark. The paper was co-authored with Bob Jones from Stanford University.") → $text

# Step 2 — Extract
@agent copilot Extract all named entities from this text. Categorize as: Person, Organization, Event, Location, Model, Benchmark. Return as JSON: $text → $entities

# Step 3 — Output
@output entities = $entities
