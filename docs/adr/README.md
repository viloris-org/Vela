# Architecture Decision Records

ADRs capture decisions that are expensive to reverse. Format: short Markdown
with Status, Context, Decisions, Consequences.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-composition-hit-material.md) | Composition tree, hit testing, and material layers | Accepted |
| 0002 | IPC / typed RPC and privilege boundaries | Planned — draft vocabulary in [tauri-comparison.md](../tauri-comparison.md) |
| 0003 | Plugin ABI and signing | Planned — draft vocabulary in [tauri-comparison.md](../tauri-comparison.md) |

## Template

```markdown
# ADR NNNN: Title

- **Status**: Proposed | Accepted | Superseded | Deprecated
- **Date**: YYYY-MM-DD
- **Deciders**: …

## Context
## Decisions
## Consequences
## References
```

## Writing rules

- One decision cluster per ADR (or tightly coupled clusters).
- Prefer binding types in `@vela/api` over prose-only rules.
- Link follow-ups instead of growing unbounded “Future work” sections.
- When superseding, leave the old ADR in place and mark Status.
