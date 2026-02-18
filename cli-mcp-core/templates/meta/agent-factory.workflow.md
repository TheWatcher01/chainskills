---
name: agent-factory
description: Bootstrap an expert AI agent for any domain — research, skills generation, agent assembly, and quality review in a single orchestrated workflow.
version: 0.1.0
inputs:
  - name: domain
    type: string
    required: true
    description: Domain to build an expert agent for (e.g. "rust-async", "kubernetes-operators", "llm-evals")
  - name: depth
    type: string
    required: false
    default: standard
    description: "Research depth: shallow | standard | deep"
  - name: max_skills
    type: number
    required: false
    default: 5
    description: Maximum number of skills to generate
  - name: quality_threshold
    type: number
    required: false
    default: 0.85
    description: Minimum quality score (0–1) before accepting output
  - name: output_path
    type: string
    required: false
    default: .
    description: Base path where agent artifacts are written
outputs:
  - name: agent_definition
    type: object
    description: Path and content of the generated .agent.md
  - name: skills_manifest
    type: array
    description: List of generated skills with paths
  - name: quality_report
    type: object
    description: Review score and issues found
env:
  - CHAINSKILLS_EXECUTOR
tags: [meta, agent-factory, skills, automation]
metadata:
  author: TheWatcher01
  license: MIT
  requires: []
---

## 1. Validate & Initialize

@assert $domain != "" "domain is required"
@assert $max_skills > 0 "max_skills must be positive"
@assert $quality_threshold >= 0 "quality_threshold must be between 0 and 1"

@call shell.exec("date -I") → $build_date
@call shell.exec("mkdir -p '$output_path/agents' '$output_path/skills' '$output_path/prompts'")
@call shell.exec("echo Building expert agent for domain: $domain")

## 2. Check Prior Research

@agent copilot: "Search workspace for any prior research or existing agents related to '$domain'. Check: .github/agents/, .github/skills/, templates/, AGENTS.md. Return: existing (true/false), paths found, summary." → $prior_work

@if $prior_work.existing == true:
@call shell.exec("echo Prior work found — will extend rather than duplicate")

## 3. Research Domain (Parallel)

@workflow research-domain:
domain: $domain
depth: $depth
→ $research_output

@assert $research_output.knowledge_base != null "Research failed — no knowledge base produced"

## 4. Plan Skills (Deduplicate)

@call shell.exec("npx skills find '$domain' 2>/dev/null | head -20 || echo '[]'") → $existing_skills_raw

@agent copilot: "Based on $research_output.knowledge_base and $research_output.recommended_skills, plan exactly up to $max_skills new skills for '$domain'. Exclude anything overlapping with: $existing_skills_raw and the following always-installed skills: data-freshness-check, mcp-builder, mastra-workflows, skill-creator, workflows-creator, remembering-conversations. For each skill return: name (kebab-case), description (one sentence), 5-7 workflow steps, anti-patterns list." → $skills_plan

## 5. Generate Skills (Parallel)

@for $skill_spec in $skills_plan:

@parallel:

    @agent copilot: "Write a complete SKILL.md for the skill '$skill_spec.name'. Use this specification: $skill_spec. Follow the chainskills skill format exactly: outer ````skill fence, inner ```skill fence, YAML frontmatter (name, description, metadata.version='1.0.0', metadata.author='$domain-expert', metadata.agent_support=['copilot','claude','cursor']), then Markdown body with Protocol steps, Anti-patterns, and Output template sections. Body must be under 500 lines." → $skill_content

    @call shell.exec("cat > '$output_path/skills/$skill_spec.name/SKILL.md' << 'SKILLEOF'

$skill_content
SKILLEOF") → $skill_write_result

## 6. Assemble Agent Definition

@agent copilot: "Write a complete .agent.md for an expert '$domain' agent for chainskills. Use the exact .chatagent format: outer ````chatagent fence, inner ```chatagent fence. Frontmatter: name='$domain-expert' (PascalCase), description (one sentence), user-invokable=true, disable-model-invocation=false, handoffs to Plan and Research agents. Body sections: role, capabilities (list the $max_skills skills it uses), project context, workflow (7 steps), guidelines (include NEVER/ALWAYS rules), output format. The agent is a domain expert that leverages the skills in: $output_path/skills/." → $agent_definition_content

@call shell.exec("cat > '$output_path/agents/$domain-expert.agent.md' << 'AGENTEOF'
$agent_definition_content
AGENTEOF") → $agent_write_result

## 7. Generate Agent Prompt

@agent copilot: "Write a reusable .prompt.md for the '$domain' expert agent. The prompt should: (1) set the role briefly, (2) list the key skills available, (3) provide a task template with placeholders. Keep under 50 lines." → $agent_prompt_content

@call shell.exec("cat > '$output_path/prompts/$domain-expert.prompt.md' << 'PROMPTEOF'
$agent_prompt_content
PROMPTEOF")

## 8. Quality Review

@repeat max:2 until $quality_score >= $quality_threshold:

@agent copilot: "Review the generated artifacts for '$domain' expert agent:

1. Agent file: '$output_path/agents/$domain-expert.agent.md' — check .chatagent format, handoffs, role clarity
2. Skills (up to $max_skills): '$output_path/skills/' — check SKILL.md format, body length <500 lines, no extraneous files
3. Prompt: '$output_path/prompts/$domain-expert.prompt.md' — check conciseness

Score each section 0–1. Return: overall_score (average), issues (array of {file, severity, message}), suggestions." → $review_result

@call shell.exec("echo Quality score: $review_result.overall_score / threshold: $quality_threshold")

@if $review_result.overall_score < $quality_threshold:
@call shell.exec("echo Applying review suggestions...")
@agent copilot: "Fix the issues identified in $review_result.issues. Regenerate only the affected artifacts. Apply all suggestions from $review_result.suggestions." → $fix_result

@assert $review_result.overall_score >= $quality_threshold "Quality gate not met after 2 attempts — manual review required"

## 9. Register in AGENTS.md

@agent copilot: "Read '.github/agents/' to list all agent files. Then read AGENTS.md. Add the new '$domain-expert' agent to the agents table (name, role, file path). Preserve all existing content. Output the updated AGENTS.md content only." → $updated_agents_md

@call shell.exec("cat > 'AGENTS.md' << 'AGENTSEOF'
$updated_agents_md
AGENTSEOF")

## 10. Output Summary

@output: $agent_definition_content, $skills_plan, $review_result

@call shell.exec("echo === Agent Factory Complete === && echo Domain: $domain && echo Skills generated: $(ls $output_path/skills/ | wc -l) && echo Agent: $output_path/agents/$domain-expert.agent.md && echo Quality score: $review_result.overall_score")
