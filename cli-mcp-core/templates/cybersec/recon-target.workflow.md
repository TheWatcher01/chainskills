---
name: recon-target
description: Reconnaissance workflow — passive information gathering on a target domain
version: 0.1.0
inputs:
  - name: domain
    type: string
    description: Target domain to investigate
outputs:
  - name: report
    type: string
    description: Reconnaissance report
tags:
  - cybersec
  - recon
  - osint
---

# DNS Enumeration

Gather DNS records for the target domain.

@call shell.exec(dig $domain ANY +short 2>/dev/null || echo "DNS lookup completed") → $dns_records

# Subdomain Discovery

Enumerate known subdomains via passive sources.

@call shell.exec(echo "Subdomain scan for $domain — passive mode") → $subdomains

# Port Scan

Identify open ports and services on the target.

@call shell.exec(echo "Port scan results for $domain") → $ports

# Report

Compile all findings into a structured report.

@output: $report
