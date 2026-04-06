---
name: workflow-composition
version: 1.0.0
domain: tool-use
difficulty: hard
description: "Compose multiple sub-workflows"
---

# Step 1 — Gather context
@call shell.exec(echo "Project: chainskills\nLanguage: TypeScript\nFramework: Vitest") → $context

# Step 2 — Generate test plan
@agent copilot Given this project context, create a test plan with 3 test categories (unit, integration, e2e). For each, list 2 specific test cases with expected outcomes: $context → $plan

# Step 3 — Generate test code for first case
@agent copilot Write a single Vitest unit test based on the first test case from this plan. Include imports, describe block, and at least 2 it blocks: $plan → $test_code

# Step 4 — Validate the test
@agent reviewer Review this test code for: completeness, assertion quality, edge cases covered, and naming conventions. Score 1-10 and suggest improvements: $test_code → $review

# Step 5 — Output
@output plan = $plan
@output test_code = $test_code
@output review = $review
