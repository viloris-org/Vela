# Architecture decision records

> **Type**: Landing  
> **Status**: Current  
> **Audience**: Maintainers  
> **SoT**: [Writing guidelines](../writing-guidelines.md) for style; each ADR for decisions

ADRs capture decisions that are expensive to reverse. Format: short Markdown with Status, Context, Decisions, Consequences.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-composition-hit-material.md) | Composition tree, hit testing, and material layers | Accepted |
| [0002](0002-ipc-privilege.md) | IPC / typed RPC and privilege boundaries | Proposed |
| 0003 | Plugin ABI and signing | Planned - draft vocabulary in [tauri-comparison.md](../research/tauri-comparison.md) |
| [0004](0004-cross-platform-abstraction.md) | Cross-platform Shell abstraction | Accepted |
| [0005](0005-zig-interop-layer.md) | Zig as Bun↔native interop layer | Accepted |
| [0006](0006-ts-first-capabilities.md) | TypeScript-first capabilities with optional native bridges | Accepted |
| [0007](0007-typescript-full-stack-host.md) | TypeScript-first full stack and pluggable privileged host | Accepted |
| [0008](0008-zig-systems-surface.md) | Zig as the default unified systems surface for capabilities | Accepted |

## Template

```markdown
# ADR NNNN: Title in sentence case after the id

- **Status**: Proposed | Accepted | Superseded | Deprecated
- **Date**: YYYY-MM-DD
- **Deciders**: …

## Context
## Decisions
## Consequences
## References
```

## Writing rules

- Follow [Writing guidelines](../writing-guidelines.md).
- One decision cluster per ADR (or tightly coupled clusters).
- Prefer binding types in `@vela/api` over prose-only rules.
- Link follow-ups instead of growing unbounded Future work sections.
- When superseding, leave the old ADR in place and mark Status.
