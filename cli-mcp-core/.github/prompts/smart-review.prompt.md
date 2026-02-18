```prompt
---
name: review
description: Smart code review for chainskills — architecture compliance and quality
agent: Review
---

# Smart Review — chainskills

Review recent changes for architecture compliance, code quality, and correctness.

## Workflow

1. Get list of changed files
2. Review each change against the checklist
3. Verify Hexagonal Architecture compliance
4. Check test coverage
5. Produce structured report

## Review Focus Areas

### Hexagonal Architecture

- Core (`src/core/`) must have ZERO external dependencies
- Dependencies: adapters → core, never reverse
- New integrations = port (interface) + adapter (implementation)
- Domain entities are immutable value objects

### Code Standards

- TypeScript strict, no `any`
- ESM only, no CommonJS
- kebab-case files, PascalCase classes, camelCase functions
- JSDoc on public exports
- Result pattern for error handling

### .workflow.md Format

- Valid frontmatter schema
- Directives from controlled vocabulary
- `$variable` substitution correctness

## Commands

```bash
# Changed files
git diff --name-only HEAD~1
git diff --stat HEAD~1

# Build check
pnpm build

# Test check
pnpm test

# Type check
pnpm exec tsc --noEmit

# Lint check
pnpm lint
```

## Output

Structured review with:
- ✅/⚠️/❌ per category
- Specific file:line references
- Actionable suggestions
- Ship / Revise / Block verdict

```
