# Vela documentation

> **Type**: Landing  
> **Status**: Current  
> **Audience**: App authors, host implementers, maintainers  
> **SoT**: [Writing guidelines](writing-guidelines.md) for style; `@vela/api` and Accepted ADRs for product behavior

Architecture and domain guides for **Vela**, a Bun-centered, WebView-first GUI framework (repository checkout name: `New_Vela`).

> **Project status**: contracts and architecture. Hosts are not shipped yet. Start with [Architecture](architecture.md). Follow [Writing guidelines](writing-guidelines.md) for every doc change.  
> **Project status**: contracts and architecture. Hosts are not shipped yet. Start with [Architecture](architecture.md). Follow [Writing guidelines](writing-guidelines.md) for every doc change.

## Start here

1. [Writing guidelines](writing-guidelines.md): house style (mandatory for all docs)
2. [Architecture](architecture.md): split, principles, security spine
3. [Composition and layers](composition-and-layers.md): layer tree
4. [Input and hit testing](input-and-hit-testing.md): two-level input
5. [Materials](materials.md): system materials
6. [Capabilities and plugins](capabilities-and-plugins.md): permissions
7. [API contracts](api-contracts.md): `@vela/api` map
8. [macOS spike architecture](macos-spike-architecture.md): Phase 1 Shell and hit plan
9. [Design gaps](design-gaps.md): prioritized contract debt
10. [Roadmap](roadmap.md): phased delivery

## Product docs

| Doc | Type | Purpose |
|-----|------|---------|
| [Architecture](architecture.md) | Conceptual | High-level split, principles, non-goals |
| [Composition and layers](composition-and-layers.md) | Conceptual | Layer kinds, stack, insert/update |
| [Input and hit testing](input-and-hit-testing.md) | Conceptual | `HitPolicy`, `WindowInputMode`, web-shaped |
| [Materials](materials.md) | Conceptual | `MaterialId`, fallback, backdrop sources |
| [Capabilities and plugins](capabilities-and-plugins.md) | Conceptual | Permissions, native components, bridge |
| [API contracts](api-contracts.md) | Reference | `@vela/api` module map |
| [Technology stack](technology-stack.md) | Reference | Host and runtime choices |
| [Platform support](platform-support.md) | Reference | Tiers and feature matrix |
| [macOS spike architecture](macos-spike-architecture.md) | Conceptual | Phase 1 view tree, hit router, dogfood exit |

## Decisions (ADRs)

| ADR | Title | Status |
|-----|-------|--------|
| [0001](adr/0001-composition-hit-material.md) | Composition, hit testing, materials | Accepted |
| [0002](adr/0002-ipc-privilege.md) | IPC / typed RPC and privilege boundaries | Proposed |
| 0003 | Plugin ABI and signing | Planned |

Full index: [ADR README](adr/README.md).

## Research (study only)

These pages map external systems. They are **not** product contracts and must not invent Vela APIs.

| Doc | Purpose |
|-----|---------|
| [Qt composition notes](research/qt-composition-notes.md) | Qt Widgets/Quick to Vela concept map |
| [Tauri comparison](research/tauri-comparison.md) | Tauri 2 process, IPC, security map (not a runtime) |

## Tracking

| Doc | Purpose |
|-----|---------|
| [Roadmap](roadmap.md) | Phased delivery |
| [Design gaps](design-gaps.md) | P0–P2 gaps between docs and implementable contracts |
| [Testing and acceptance](testing-and-acceptance.md) | Host smoke gates and composition acceptance |

## Source of truth

| Concern | Location |
|---------|----------|
| Types and pure helpers | `packages/api/` (`@vela/api`) |
| Binding product decisions | `docs/adr/` |
| Qt-class composition philosophy | `docs/research/qt-composition-notes.md` + ADR 0001 |
| Shell security / IPC vocabulary | `docs/research/tauri-comparison.md` + capabilities doc + [ADR 0002](adr/0002-ipc-privilege.md) |
| Phase 1 macOS plan | [macos-spike-architecture.md](macos-spike-architecture.md) |
| Design debt | [design-gaps.md](design-gaps.md) |
| Documentation style | [writing-guidelines.md](writing-guidelines.md) |

## External references (study only)

| Source | Use |
|--------|-----|
| [Tauri 2 docs](https://v2.tauri.app/) | Process model, IPC, capabilities, plugins |
| Qt 6 public docs / optional local `../qt6` | Composition, masks, event transparency |
| Sibling Rust Vela (`../Vela`) | Different product (wgpu retained GUI) |

## Related repositories

| Path | Relation |
|------|----------|
| Sibling Rust Vela (`../Vela`) | **Different product**: wgpu retained GUI, no WebView core. Doc rigor transfers; runtime does not. |
| Local `../qt6` | Optional Qt super-repo for source study |
| Local `../qt5` | Not required; Qt 5/6 public docs are enough for mapping |

**Naming:** this monorepo is often checked out as `New_Vela`; the product name is **Vela** (WebView-first). Sibling `../Vela` is the Rust/wgpu framework. Keep names disambiguated in issues and packages.

## Contributing to docs

- Follow [Writing guidelines](writing-guidelines.md) (mandatory for new and existing pages).
- Prefer binding rules in `@vela/api` types over prose-only constraints.
- When a decision is expensive to reverse, add or update an ADR.
- Keep platform-specific behavior in [Platform support](platform-support.md) and host acceptance in [Testing and acceptance](testing-and-acceptance.md).
- Link Qt concepts via [Qt composition notes](research/qt-composition-notes.md); do not re-export Qt APIs into the product surface.
- Link process, IPC, and security vocabulary via [Tauri comparison](research/tauri-comparison.md); do not claim Vela embeds or reimplements Tauri.
- Update this index when you add, rename, or move a page.
