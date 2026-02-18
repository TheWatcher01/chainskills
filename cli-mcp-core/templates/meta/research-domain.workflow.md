---
name: research-domain
description: Deep multi-source research on any domain — web, GitHub, npm, communities — with data freshness validation. Produces a structured knowledge base ready for skill generation or agent assembly.
version: 0.1.0
inputs:
  - name: domain
    type: string
    required: true
    description: Domain or topic to research (e.g. "kubernetes-operators", "rust-async", "react-server-components")
  - name: depth
    type: string
    required: false
    default: standard
    description: "Research depth: shallow (docs only) | standard (docs + GitHub + community) | deep (+ issues, changelogs, CVEs)"
  - name: max_sources
    type: number
    required: false
    default: 10
    description: Maximum number of external sources to consolidate
outputs:
  - name: knowledge_base
    type: object
    description: Structured knowledge — concepts, tools, patterns, anti-patterns
  - name: dependency_audit
    type: array
    description: Packages with pinned vs latest versions and advisories
  - name: freshness_report
    type: object
    description: Per-claim freshness status table
  - name: recommended_skills
    type: array
    description: Skills to create based on research findings
env:
  - CHAINSKILLS_EXECUTOR
tags: [meta, research, knowledge, agent-factory]
metadata:
  author: TheWatcher01
  license: MIT
  requires: []
---

## 1. Validate & Initialize

@assert $domain != "" "domain input is required"
@call shell.exec("date -I") → $research_date
@call shell.exec("echo Research started for '$domain' at depth '$depth'")

## 2. Check Prior Research (Memory-First)

@agent copilot: "Check conversation history and workspace files for any prior research on '$domain'. Search AGENTS.md, ROADMAP.md, templates/, and any .md files that mention '$domain'. Return: found (true/false), summary of prior findings, and staleness estimate." → $prior_research

@if $prior_research.found == true:
@call shell.exec("echo Prior research found — reusing FRESH data where applicable")

## 3. Scan Workspace

@agent copilot: "Scan the chainskills workspace for existing code, configuration, or templates related to '$domain'. Check: package.json dependencies, src/ for relevant adapters or ports, templates/ for similar workflows, ROADMAP.md for planned features. Return structured findings." → $workspace_scan

## 4. Research Externally (Parallel)

@parallel:

@agent copilot: "Search the web for '$domain': official documentation, getting started guides, best practices, key concepts. Retrieve from official sources only (official site, MDN, spec). Include exact URLs and page titles. Depth: $depth." → $web_knowledge

@agent copilot: "Search GitHub for '$domain': top repositories (stars > 500), awesome-\* lists, official org repos. For each: name, stars, last commit date, key features, license. Include GitHub URLs." → $github_knowledge

@agent copilot: "Search npm for packages related to '$domain'. For each relevant package: current version, weekly downloads, last publish date, known CVEs. Use registry.npmjs.org for authoritative version data." → $npm_knowledge

@agent copilot: "Search community resources for '$domain': StackOverflow top questions, Reddit discussions, Discord/Slack community insights, common gotchas, migration pain points. Summarize recurring themes." → $community_knowledge

## 5. Validate Data Freshness

@agent copilot: "Apply data freshness validation to all research findings. For each factual claim in $web_knowledge, $github_knowledge, $npm_knowledge, $community_knowledge: assign freshness status (🟢 FRESH <90d / 🟡 AGING 90d-1yr / 🟠 STALE 1-2yr / 🔴 EXPIRED >2yr / ⚪ UNVERIFIED). Flag items missing URLs or retrieval dates. Return validated claims table." → $freshness_report

@assert $freshness_report.verified_count > 0 "No verified sources found — cannot proceed"

## 6. Synthesize Knowledge Base

@agent copilot: "Merge all research sources into a structured knowledge base for '$domain'. Organize as: (1) Core Concepts, (2) Key Tools & Libraries with versions, (3) Established Patterns, (4) Anti-patterns & Gotchas, (5) Ecosystem Map, (6) Version landscape. Resolve contradictions between sources — note them as ⚡ ÉCART. Use only 🟢/🟡 FRESH data for recommendations." → $knowledge_base

## 7. Dependency Audit

@agent copilot: "Cross-reference npm packages found in research with the workspace package.json. For each relevant package: pinned version vs latest stable, breaking changes in gap, known CVEs. Flag major version gaps as ⚠️ UPDATE NEEDED." → $dependency_audit

## 8. Plan Skills

@agent copilot: "Based on $knowledge_base, identify up to 5 reusable skills that would be valuable for chainskills workflows in '$domain'. For each skill: name (kebab-case), one-sentence description, core workflow steps. Exclude skills already covered by: data-freshness-check, mcp-builder, mastra-workflows, skill-creator, workflows-creator." → $recommended_skills

## 9. Output Research Report

@output: $knowledge_base, $dependency_audit, $freshness_report, $recommended_skills

@agent copilot: "Produce the final research report in this format:

# Research Report — $domain — $research_date

## Workspace Findings

{$workspace_scan summary}

## External Findings

| Claim | Source | URL | Date | Freshness | Confidence |
| ----- | ------ | --- | ---- | --------- | ---------- |

{table from $freshness_report}

## Dependency Audit

| Package | Pinned | Latest | Gap | Advisory |
| ------- | ------ | ------ | --- | -------- |

{from $dependency_audit}

## Key Concepts

{from $knowledge_base.core_concepts}

## Recommended Skills to Create

{from $recommended_skills}

## ⚠️ Stale / Unverified Data

{items from $freshness_report with 🟠/🔴/⚪ status}

## Recommended Next Steps

{actionable handoff items for Plan or agent-factory}
"
