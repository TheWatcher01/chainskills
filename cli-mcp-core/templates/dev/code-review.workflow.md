---
name: code-review
description: Automated code review workflow — analyzes code quality, conventions, and potential issues
version: 0.1.0
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

Run static analysis on the target files.

@call shell.exec(echo "Reviewing: $files with focus on $focus") → $analysis

# Report

Compile findings into a structured review report.

@output: $report
