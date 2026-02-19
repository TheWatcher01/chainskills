---
name: research
description: Structured multi-source research protocol with data freshness validation. Use when gathering factual data from the web, GitHub, npm, or docs. Produces sourced, timestamped, cross-referenced findings ready to hand off to a planning or implementation step.
metadata:
  version: "1.0.0"
  author: TheWatcher01
  agent_support: [copilot, claude, cursor]
---

# Research Skill — chainskills

## Protocol

### Step 1 — Clarify scope
Define the research questions before searching. Map each question to a decision it informs.

### Step 2 — Memory check
Query conversation history for prior research on overlapping topics. Reuse 🟢 FRESH findings (< 90 days). Skip Step 4 for already-verified facts.

### Step 3 — Workspace scan
Read: `package.json` deps, ROADMAP, AGENTS.md, relevant source files, existing templates. Note current state before looking externally.

### Step 4 — External research (parallel where possible)
For each question, query ≥2 independent sources from the authority hierarchy:
1. Official registry (npm, crates.io, PyPI)
2. Official docs / spec / RFC
3. Official GitHub repo (README, releases, CHANGELOG)
4. Verified community resource (MDN, caniuse, awesome-*)
5. Tech blog / article
6. Forum / StackOverflow
→ AI memory alone is never sufficient — always fetch from sources 1–4.

### Step 5 — Cross-reference
For critical facts (versions, breaking changes, security), verify with ≥2 independent sources.
Flag discrepancies: `⚡ ÉCART: source A says X, source B says Y`.

### Step 6 — Freshness stamp
Assign a status to every external claim:
- 🟢 FRESH — retrieved < 90 days ago
- 🟡 AGING — 90 days–1 year
- 🟠 STALE — 1–2 years
- 🔴 EXPIRED — > 2 years
- ⚪ UNVERIFIED — not fetched, AI memory only

### Step 7 — Structured output
Produce a report with:
- Source table (claim / source / URL / date / freshness / confidence H|M|L)
- Dependency audit table (package / pinned / latest / gap / advisory)
- Workspace vs external delta (what the codebase assumes vs what is actually true)
- Stale/unverified warnings
- Recommended next steps

## Anti-patterns
- ❌ Citing a URL without accessing it — always fetch
- ❌ Treating AI training data as a source — always verify
- ❌ Single-source conclusions for critical decisions
- ❌ Omitting retrieval dates
- ❌ Starting external research before checking workspace state

## Output template

```markdown
### Research Report — {topic} — {YYYY-MM-DD}

#### Workspace Findings
{What the codebase already knows/does about this topic}

#### External Findings
| Claim | Source | URL | Date | Freshness | Confidence |
|-------|--------|-----|------|-----------|------------|

#### Dependency Audit
| Package | Pinned | Latest | Gap | Advisory |

#### ⚠️ Stale / Unverified
{Items to re-verify before acting}

#### Recommended Next Steps
{Handoff-ready actions}
```

