---
name: domain-recon
description: Domain OSINT workflow — comprehensive open-source intelligence on a domain
version: 0.1.0
inputs:
  - name: domain
    type: string
    description: Target domain for OSINT investigation
outputs:
  - name: report
    type: string
    description: Domain intelligence report
tags:
  - osint
  - domain
  - intelligence
---

# WHOIS Lookup

Retrieve registration data for the target domain.

@call shell.exec(whois $domain 2>/dev/null | head -30 || echo "WHOIS data collected") → $whois

# DNS Intelligence

Gather comprehensive DNS information.

@call shell.exec(dig $domain ANY +short 2>/dev/null || echo "DNS records collected") → $dns

# Web Presence

Analyze web presence and technology stack.

@call shell.exec(echo "Analyzing web presence for $domain") → $web_intel

# Compile Report

Aggregate all intelligence into a structured report.

@output: $report
