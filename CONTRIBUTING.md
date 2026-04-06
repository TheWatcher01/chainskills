# Contributing to chainskills

Thanks for your interest! chainskills is open source under the MIT license.

## Quick Setup

```bash
git clone https://github.com/TheWatcher01/chainskills.git
cd chainskills
pnpm install
cd cli-mcp-core && pnpm test && pnpm typecheck && pnpm build
```

## Architecture (3 lines)

- **Core** (`src/core/`) — pure domain logic, zero external deps, `Result<T,E>` everywhere
- **Adapters** (`src/adapters/`) — implement ports, one adapter per port, no domain logic
- **CLI** (`src/cli/`) — one file per command, deps via DI container

## Making Changes

1. Fork and create a branch: `git checkout -b feat/my-feature`
2. Write code following existing patterns (TypeScript strict, ESM, kebab-case files)
3. Add tests (unit in `tests/unit/`, integration in `tests/runtime/`)
4. Run `pnpm test && pnpm typecheck`
5. Open a PR with a conventional commit title: `feat(scope): description`

## Adding a Benchmark Workflow

1. Create `benchmarks/<domain>/<difficulty>/name.workflow.md`
2. Include frontmatter: `name`, `domain`, `difficulty`, `description`, `version`
3. Optionally add a `name.golden.json` for output validation
4. Run `chainskills bench-suite --models noop --dry-run` to verify discovery

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(bench): add new security benchmark`
- `fix(parser): handle nested @parallel directives`
- `test(arena): add Elo rating edge case tests`

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/TheWatcher01/chainskills/labels/good%20first%20issue).

## Questions?

Open a [Discussion](https://github.com/TheWatcher01/chainskills/discussions) or file an [Issue](https://github.com/TheWatcher01/chainskills/issues).
