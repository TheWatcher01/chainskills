---
name: tdd-cycle
description: Test-Driven Development cycle — red/green/refactor loop with automatic validation
version: 0.2.0
inputs:
  - name: module
    type: string
    description: Module or feature to implement
  - name: test_cmd
    type: string
    description: Command to run the test suite
  - name: max_iterations
    type: number
    description: Maximum TDD iterations before stopping
outputs:
  - name: result
    type: string
    description: Final TDD cycle result (pass/fail summary)
tags:
  - dev
  - tdd
  - testing
---

# Write Test

Write a failing test for the target module.

@call shell.exec(echo "Writing test for $module...") → $test_file

# TDD Loop

Iterate red-green-refactor until tests pass or max iterations reached.

@repeat max:5 until $test_status == pass:

@call shell.exec($test_cmd 2>&1 || echo "FAIL") → $test_output

@if $test_output == FAIL:

@call shell.exec(echo "RED — implementing fix for $module iteration") → $fix

@call shell.exec($test_cmd 2>&1 || echo "FAIL") → $test_status

# Refactor

Clean up the implementation once tests are green.

@if $test_status == pass:

@call shell.exec(echo "GREEN — refactoring $module") → $refactor

# Result

@output: $result
