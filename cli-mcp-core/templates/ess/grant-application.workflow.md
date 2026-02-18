---
name: grant-application
description: Subvention workflow — assemble and validate a grant application dossier with parallel gathering and error handling
version: 0.2.0
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

@try:

@call shell.exec(echo "Checking eligibility of $organization for $program") → $eligibility

@on-error: log and continue

@if $eligibility:

# Gather Documents

Collect budget and supporting documents in parallel.

@parallel:

@call shell.exec(echo "Assembling budget: $budget for $organization") → $budget_doc

@call shell.exec(echo "Collecting documents for $program application") → $documents

@call shell.exec(echo "Retrieving legal status for $organization") → $legal_status

# Validation

Cross-check all sections for completeness and consistency.

@assert $budget_doc

@assert $documents

# Compile Dossier

Assemble the final application dossier.

@call shell.exec(echo "Compiling dossier: budget=$budget_doc docs=$documents legal=$legal_status") → $dossier

@output: $dossier
