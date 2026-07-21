# Roadmap

> **Type**: Tracking  
> **Status**: Current  
> **Audience**: Maintainers | Contributors  
> **SoT**: Delivery plan; not a product API contract

Staged plan to grow New_Vela from **contracts + ADR** into a cross-platform WebView-first GUI framework with Qt-class composition.

Status legend:

- `[x]` present in this repository
- `[~]` scaffolded / partial
- `[ ]` not started

Acceptance for composition is described in the domain docs and [ADR 0001](adr/0001-composition-hit-material.md).

## Principles

1. Stabilize **contracts** before locking host ABIs.
2. Prove **hit routing + materials** on one Tier 1 platform before broad APIs.
3. Capability default-deny is never postponed to “polish”.
4. Mobile shares contracts early; host code may lag desktop spike.
5. Dogfood with a playground that forces multi-layer + glass + hole hit-test.

## Phase 0 - Project skeleton

- [x] Bun workspace monorepo
- [x] `@vela/api` package (geometry, layers, hit, materials, capabilities, window, bridge)
- [x] Unit tests for pure helpers
- [x] ADR 0001: composition, hit, materials
- [x] Core architecture documentation set

## Phase 1 - macOS composition spike

Design: [macOS spike architecture](macos-spike-architecture.md). Acceptance: [testing-and-acceptance.md](testing-and-acceptance.md) S1 - S7.

- [ ] Native Shell prototype (window + WKWebView) per spike view tree
- [ ] `VelaHitRootView` sole hit policy; WebView sibling of material/native
- [ ] Layer tree: web + native + material
- [ ] Liquid Glass (or system material) toolbar layer
- [ ] Regional hit-through: web-shaped hole to underlay
- [ ] No double event delivery WebView ↔ NSView
- [ ] Preload inject `window.vela` (subset: layers + hit)
- [ ] Debug last `HitTarget` instrumentation

**Exit:** short demo video / app: glass toolbar + map/video underlay + click holes.

## Phase 2 - Bun host + typed RPC

- [ ] Bun process owns app lifecycle
- [ ] Typed RPC / privilege boundary (ADR 0002)
- [ ] Capability checks on `call` and sensitive inserts
- [ ] App manifest profiles
- [ ] Packaging hooks for web assets + custom schemes

## Phase 3 - Capability plugins (desktop)

- [ ] fs (app sandbox), dialog, clipboard, notify
- [ ] `shell:open-external`
- [ ] Material insert permission enforcement
- [ ] Playground exercises each permission path (allow + deny)

## Phase 4 - Windows materials + parity

- [ ] WebView2 host path
- [ ] Mica / Acrylic material layers
- [ ] Hit parity with macOS spike scenarios
- [ ] Degrade diagnostics when WebView2 missing

## Phase 5 - Plugin ABI + signing

- [ ] ADR 0003: plugin ABI and signing
- [ ] Signed native factories for extra surfaces
- [ ] Block unsigned load by default

## Phase 6 - Mobile hosts

- [ ] iOS host: WebView + layer protocol subset
- [ ] Android host: WebView + layer protocol subset
- [ ] Shared dogfood content against both

## Phase 7 - Phase-2 composition

- [ ] Scroll-linked native slots
- [ ] Richer transforms / hitching where safe
- [ ] Optional point-query web-shaped mode at scale

## Near-term checklist (from README)

1. [x] ADR + `@vela/api` contracts
2. [ ] macOS spike: WebView + Liquid Glass toolbar + hole hit-test
3. [ ] Bun host + typed RPC / preload bridge
4. [ ] Capability plugins (fs, dialog, clipboard, notify)
5. [ ] Mobile hosts sharing the same contracts

## Documentation follow-ups

- [x] ADR 0002: IPC / typed RPC and privilege boundaries - [adr/0002-ipc-privilege.md](adr/0002-ipc-privilege.md) (Proposed)
- [ ] Accept ADR 0002 after Phase 1 channel feedback
- [ ] ADR 0003: Plugin ABI and signing (Tauri plugin packaging lessons)
- [x] Testing and acceptance doc (host smoke gates) - [testing-and-acceptance.md](testing-and-acceptance.md)
- [x] Qt composition notes expanded against Qt 6 public API / local `../qt6` layout
- [x] Tauri comparison (process / IPC / security) - [tauri-comparison.md](research/tauri-comparison.md)
- [x] Docs index - [README.md](README.md)
- [x] macOS spike architecture - [macos-spike-architecture.md](macos-spike-architecture.md)
- [x] Design gaps register - [design-gaps.md](design-gaps.md)
- [ ] `@vela/api`: pure `resolveHit` + RPC envelopes (see design gaps P0)
- [ ] CI matrix once hosts exist

## Explicit non-goals for early phases

- Full CSS/DOM reimplementation outside WebView
- Pixel-perfect material parity across OS
- Per-pixel alpha hit testing
- Replacing sibling Rust/wgpu `Vela` product scope
