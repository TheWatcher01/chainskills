---
name: grant-application
description: Subvention workflow — assemble and validate a grant application dossier
version: 0.1.0
inputs:
  - name: organization
    type: string
    description: Name of the applying organization
  - name: program
    type: string
    description: Grant program identifier
  - name: budget
    type: string
    description: Requested budget amount
outputs:
  - name: dossier
    type: string
    description: Complete grant application dossier
tags:
  - ess
  - grants
  - funding
---

# Eligibility Check

Verify the organization meets the program's eligibility criteria.

@call shell.exec(echo "Checking eligibility of $organization for $program") → $eligibility

@if $eligibility:

# Budget Assembly

Compile the budget breakdown and financial projections.

@call shell.exec(echo "Assembling budget: $budget for $organization") → $budget_doc

# Documentation

Gather all required supporting documents.

@call shell.exec(echo "Collecting documents for $program application") → $documents

# Validation

Cross-check all sections for completeness and consistency.

@assert $budget_doc

@output: $dossier
