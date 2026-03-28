# Hexagonal Architecture — Dependency Rule

## Core Domain (`cli-mcp-core/src/core/`)

- ZERO external npm imports. Only TypeScript builtins.
- Entities are immutable (readonly properties).
- Ports contain ONLY interfaces — no implementations, no logic.
- Services are pure domain logic with no I/O.
- Use cases return `Result<T, E>` — never throw for business logic.
- Never import from `#adapters/*`, `#cli/*`, `#config/*`, or `#infra/*`.

## Adapters (`cli-mcp-core/src/adapters/`)

- Each adapter implements exactly one port (interface from core).
- No domain logic — translation layer only.
- Can import npm packages and core types (interfaces).
- Wrap external errors into domain error types via `Result`.
- Never instantiate directly — registered via DI container.

## CLI (`cli-mcp-core/src/cli/`)

- One file per command (Citty conventions).
- All dependencies injected via `createContainer()`.
- Never import adapters directly.

## Violation Detection

A file in `src/core/` importing from `adapters/` is a P0 bug.
Fix: create an output port (interface) in `core/ports/` and inject the adapter via DI.
