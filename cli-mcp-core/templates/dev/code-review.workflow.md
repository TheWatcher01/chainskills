---
name: code-review
description: Automated code review workflow — analyzes code quality, conventions, and potential issues in parallel
version: 0.2.0
inputs:
  - name: target
    type: string
    description: File or directory path to review
  - name: focus
    type: string
    description: Review focus area (security, performance, style, all)
outputs:
  - name: report
    type: string
    description: Code review report
tags:
  - dev
  - review
  - quality
---

# Setup

Identify the files to review and establish the review scope.

@call shell.exec(find $target -type f -name "_.ts" -o -name "_.js" | head -20) → $files

# Analyze

Run multiple analysis passes in parallel for faster feedback.

@parallel:

@call shell.exec(echo "Lint check on: $files") → $lint_results

@call shell.exec(echo "Security scan on: $files with focus=$focus") → $security_results

@call shell.exec(echo "Complexity analysis on: $files") → $complexity_results

# Synthesize

Merge parallel results into a single review summary.

@call shell.exec(echo "Lint: $lint_results | Security: $security_results | Complexity: $complexity_results") → $report

# Report

Compile findings into a structured review report.

@output: $report
