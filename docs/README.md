# New_Vela documentation

Architecture and domain guides for the **Vela** Bun-centered, WebView-first GUI
framework (this repository: `New_Vela`).

> Status: contracts + architecture. Hosts are not shipped yet.
> Start here, then [Architecture](architecture.md).

## Reading order

1. [Architecture](architecture.md) — split, principles, security spine  
2. [Composition and layers](composition-and-layers.md) — layer tree  
3. [Input and hit testing](input-and-hit-testing.md) — two-level input  
4. [Materials](materials.md) — system materials  
5. [Capabilities and plugins](capabilities-and-plugins.md) — permissions  
6. [API contracts](api-contracts.md) — `@vela/api` map  
7. [Qt composition notes](qt-composition-notes.md) — Qt-class mapping (reference)  
8. [Tauri comparison](tauri-comparison.md) — process / IPC / security reference  
9. [Roadmap](roadmap.md) — phased delivery  

## Index

| Doc | Purpose |
|-----|---------|
| [Architecture](architecture.md) | High-level split, principles, non-goals |
| [Composition and layers](composition-and-layers.md) | Layer kinds, stack, insert/update |
| [Input and hit testing](input-and-hit-testing.md) | `HitPolicy`, `WindowInputMode`, web-shaped |
| [Materials](materials.md) | `MaterialId`, fallback, backdrop sources |
| [Capabilities and plugins](capabilities-and-plugins.md) | Permissions, native components, bridge |
| [API contracts](api-contracts.md) | `@vela/api` module map |
| [Technology stack](technology-stack.md) | Host/runtime choices |
| [Platform support](platform-support.md) | Tiers and feature matrix |
| [Roadmap](roadmap.md) | Phased delivery |
| [Testing and acceptance](testing-and-acceptance.md) | Host smoke gates and composition acceptance |
| [Qt composition notes](qt-composition-notes.md) | Qt Widgets/Quick → Vela concept map |
| [Tauri comparison](tauri-comparison.md) | Tauri 2 process/IPC/security map (not a runtime) |
| [ADR index](adr/README.md) | Decision records |

## ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [0001](adr/0001-composition-hit-material.md) | Composition, hit testing, materials | Accepted |
| 0002 | IPC / typed RPC and privilege boundaries | Planned |
| 0003 | Plugin ABI and signing | Planned |

## Source of truth

| Concern | Location |
|---------|----------|
| Types and pure helpers | `packages/api/` (`@vela/api`) |
| Binding product decisions | `docs/adr/` |
| Qt-class composition philosophy | `docs/qt-composition-notes.md` + ADR 0001 |
| Shell security / IPC vocabulary | `docs/tauri-comparison.md` + capabilities doc + planned ADR 0002 |

## External references (study only)

| Source | Use |
|--------|-----|
| [Tauri 2 docs](https://v2.tauri.app/) | Process model, IPC, capabilities, plugins |
| Qt 6 public docs / optional local `../qt6` | Composition, masks, event transparency |
| Sibling Rust `Vela` (`../Vela`) | Different product (wgpu retained GUI) |

## Related repositories

| Path | Relation |
|------|----------|
| Sibling Rust `Vela` (`../Vela`) | Different product (wgpu retained GUI, no WebView core) |
| Local `../qt6` | Optional Qt super-repo for source study (submodules may be empty) |
| Local `../qt5` | Not required; Qt 5/6 public docs are enough for mapping |

## Contributing to docs

- Prefer binding rules in `@vela/api` types over prose-only constraints.
- When a decision is expensive to reverse, add or update an ADR.
- Keep platform-specific behavior in [Platform support](platform-support.md) and
  host acceptance in [Testing and acceptance](testing-and-acceptance.md).
- Link Qt concepts via [Qt composition notes](qt-composition-notes.md); do not
  re-export Qt APIs into the product surface.
- Link process/IPC/security vocabulary via [Tauri comparison](tauri-comparison.md);
  do not claim Vela embeds or reimplements Tauri.
