---
name: changelog
version: 1.0.0
domain: writing
difficulty: medium
description: "Generate a changelog from commit messages"
---

# Step 1 — Commits
@call shell.exec(echo "feat(auth): add OAuth2 support\nfix(api): handle null response from upstream\nchore: update dependencies\nfeat(ui): add dark mode toggle\nfix(auth): token refresh race condition\nrefactor(api): extract validation middleware\ndocs: update API reference") → $commits

# Step 2 — Generate changelog
@agent writer Generate a well-formatted CHANGELOG entry from these commits. Group by type (Features, Bug Fixes, etc.), write user-friendly descriptions, and follow Keep a Changelog format: $commits → $changelog

# Step 3 — Output
@output changelog = $changelog
