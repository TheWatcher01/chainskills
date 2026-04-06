---
name: scan-dependencies
version: 1.0.0
domain: security
difficulty: easy
description: "Scan dependencies for known vulnerabilities"
---

# Step 1 — Dependencies
@call shell.exec(echo "express@4.17.1\nlodash@4.17.20\naxios@0.21.0\nminimist@1.2.5\nnode-fetch@2.6.0") → $deps

# Step 2 — Scan
@agent copilot Check these npm dependencies for known security vulnerabilities (CVEs). For each vulnerable package, list: CVE ID if known, severity, affected versions, and recommended upgrade version: $deps → $report

# Step 3 — Output
@output report = $report
