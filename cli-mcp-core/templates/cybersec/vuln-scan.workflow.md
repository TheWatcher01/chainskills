---
name: vuln-scan
description: Vulnerability scanning workflow — iterates over targets with conditional severity handling
version: 0.2.0
inputs:
  - name: targets
    type: string
    description: Comma-separated list of hosts or IPs to scan
  - name: severity
    type: string
    description: Minimum severity to report (low, medium, high, critical)
outputs:
  - name: report
    type: string
    description: Vulnerability scan report
tags:
  - cybersec
  - vuln
  - scanning
---

# Enumerate Targets

Parse the target list and prepare scan configuration.

@call shell.exec(echo "$targets" | tr ',' '\n') → $target_list

# Scan

Iterate over each target and run vulnerability checks.

@for $host in $target_list:

@call shell.exec(echo "Scanning $host for vulnerabilities...") → $scan_result

@if $scan_result:

@call shell.exec(echo "Findings on $host at severity >= $severity: $scan_result") → $finding

# Aggregate

Combine all findings into a consolidated report.

@call shell.exec(echo "Aggregated findings for $targets") → $report

@try:

@call shell.exec(echo "Validating report format...") → $validation

@on-error: log and continue

# Report

@output: $report
