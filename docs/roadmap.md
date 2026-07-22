# Roadmap

> **Type**: Tracking  
> **Status**: Current  
> **Audience**: Maintainers | Contributors | Host implementers  
> **SoT**: Delivery plan only; not a product API contract. Behavior binds via `@vela/api` and Accepted ADRs.

Staged plan to grow New_Vela from **contracts + ADRs** into a cross-platform, WebView-first GUI framework with Qt-class composition, system materials, and default-deny capabilities.

This page tracks **what to build in which order** and **how we know a phase is done**. It does not invent APIs. Open design debt lives in [design gaps](design-gaps.md). Host smoke gates live in [testing and acceptance](testing-and-acceptance.md).

## Status legend

| Mark | Meaning |
|------|---------|
| `[x]` | Present in this repository |
| `[~]` | Scaffolded / partial / design-only |
| `[ ]` | Not started |

Phase status line uses the same marks for the phase as a whole.

## Principles (delivery order)

1. **Contracts before host ABIs** — stabilize `@vela/api` and pure helpers before locking Swift/Win/mobile shapes.
2. **One Tier 1 composition proof first** — hit routing + materials on macOS before broad public host APIs.
3. **Capability default-deny is never “polish”** — deny paths ship with the first real `call` / sensitive insert surface.
4. **Mobile shares contracts early; host code may lag** — same Layer / Hit / Capability / bridge types; native hosts can trail desktop spike.
5. **Dogfood forces the hard cases** — playground must exercise multi-layer stack, system material, and regional hole hit-test.
6. **Close P0 gaps before multi-host divergence** — pure `resolveHit` and RPC envelopes before second host copies ad-hoc logic.
7. **Honest status** — design docs and scaffolds are not shipped hosts. Mark `[~]` until acceptance scenarios pass.

## Dependency spine (critical path)

```text
Phase 0 contracts
    │
    ├─► G-P0-1 resolveHit (+ tests)  ──┐
    │                                   │
    ▼                                   ▼
Phase 1 macOS spike  ──channel feedback──► Accept ADR 0002
    │                                   │
    ▼                                   ▼
Phase 2 Bun host + typed RPC ◄──────────┘
    │
    ├─► Phase 3 desktop capability plugins
    │
    ├─► Phase 4 Windows materials + hit parity
    │
    ├─► Phase 5 plugin ABI + signing (ADR 0003)
    │
    ├─► Phase 6 mobile hosts (contract subset)
    │
    └─► Phase 7 phase-2 composition (scroll-linked slots, richer transforms)
```

Parallel work that may start early without blocking Phase 1:

- Design-gap types in `@vela/api` (G-P0-1, G-P0-2, selected P1)
- Playground **web content** (HTML/TS only) that assumes `window.vela`
- Docs / research updates that do not invent APIs

## Phase map

| Phase | Name | Status | Exit (one line) |
|-------|------|--------|-----------------|
| 0 | Project skeleton | `[x]` | Monorepo + `@vela/api` + ADR 0001 + core docs |
| 0.5 | Contract hardening | `[ ]` / partial | Pure hit + RPC envelopes + generation rules testable without Shell |
| 1 | macOS composition spike | `[ ]` | S1–S7 pass; demo: glass toolbar + underlay + holes |
| 2 | Bun host + typed RPC | `[ ]` | Bun owns lifecycle; privilege boundary per ADR 0002 |
| 3 | Capability plugins (desktop) | `[ ]` | fs / dialog / clipboard / notify + allow/deny playground |
| 4 | Windows materials + parity | `[ ]` | WebView2 path; W1–W3; behavioral hit parity with macOS |
| 5 | Plugin ABI + signing | `[ ]` | ADR 0003 Accepted; unsigned load blocked by default |
| 6 | Mobile hosts | `[ ]` | iOS + Android subset; shared dogfood content |
| 7 | Phase-2 composition | `[ ]` | Scroll-linked slots; safer hitching; optional scaled web-shaped |

---

## Phase 0 — Project skeleton

**Status:** `[x]` complete for initial skeleton.

**Goal:** Shared language and monorepo so hosts and apps do not invent parallel types.

### Delivered

- [x] Bun workspace monorepo
- [x] `@vela/api` package (geometry, layers, hit, materials, capabilities, window, bridge)
- [x] Unit tests for pure helpers
- [x] [ADR 0001](adr/0001-composition-hit-material.md): composition, hit, materials (Accepted)
- [x] Core architecture documentation set (see [docs index](README.md))
- [x] [ADR 0002](adr/0002-ipc-privilege.md) Proposed (IPC / privilege)
- [x] [macOS spike architecture](macos-spike-architecture.md) (design)
- [x] [Design gaps](design-gaps.md) register
- [x] [Testing and acceptance](testing-and-acceptance.md) host smoke targets
- [x] Research: [Qt composition notes](research/qt-composition-notes.md), [Tauri comparison](research/tauri-comparison.md)

### Exit criteria

- [x] `bun test` and `bun run typecheck` pass on contracts
- [x] New contributor can read Architecture → domain guides → Roadmap without inventing APIs

### Out of scope

- Any native host binary
- Packaging / installers

---

## Phase 0.5 — Contract hardening (pre-host / concurrent with Phase 1)

**Status:** `[ ]` / partial — docs name the gaps; code not complete.

**Goal:** Close P0 contract debt so Phase 1 Swift and later hosts share one algorithm and one RPC shape.

**Depends on:** Phase 0.  
**Unblocks:** Safe multi-host implementation; Phase 2 envelopes.

### Work items

| Item | Gap / link | Status |
|------|------------|--------|
| Pure `resolveHit(windowMode, layers, opaqueRegionStore, point) → HitTarget` + unit tests | [G-P0-1](design-gaps.md) | `[ ]` |
| RPC envelope + structured error code types in `@vela/api` | [G-P0-2](design-gaps.md), ADR 0002 | `[ ]` |
| web-shaped empty-default vs block-until-report — lock for dogfood | [G-P0-5](design-gaps.md), input + spike docs | `[~]` |
| `generation` stale rules as pure helper + tests | [G-P1-4](design-gaps.md) | `[~]` |
| Coordinate conversion policy (logical y-down; AppKit convert once at boundary) | [G-P1-7](design-gaps.md), spike doc | `[~]` |

### Exit criteria

- [ ] `resolveHit` tests cover opaque / pass-through / web-shaped / window modes enough that Swift can mirror without reinterpretation
- [ ] Envelope types compile and document reject/deny shapes used by ADR 0002
- [ ] Design-gaps G-P0-1 and G-P0-2 marked closed or partial with explicit remaining host work

### Suggested order

1. G-P0-1 `resolveHit` (highest risk of host drift)  
2. G-P0-2 envelopes (before Bun process split)  
3. Generation + web-shaped defaults (dogfood correctness)

---

## Phase 1 — macOS composition spike

**Status:** `[ ]` not started (architecture design `[x]`).

**Goal:** Prove Qt-class composition on one Tier 1 platform: multi-kind layers, regional hit-through, system material, single event delivery.

**Design:** [macOS spike architecture](macos-spike-architecture.md).  
**Acceptance:** [Testing and acceptance](testing-and-acceptance.md) scenarios **S1–S7**.  
**Decisions:** ADR 0001 (Accepted). Bun split optional stub per ADR 0002.

### Work items

- [ ] Native Shell prototype (window + WKWebView) per spike view tree
- [ ] `VelaHitRootView` sole hit policy; WebView **sibling** of material/native (not starved parent)
- [ ] Layer tree: web + native + material (+ optional chrome)
- [ ] Liquid Glass (or system material) toolbar layer with degrade path
- [ ] Regional hit-through: web-shaped hole to underlay
- [ ] No double event delivery WebView ↔ NSView
- [ ] Preload inject `window.vela` subset: `layers` + `hit` (`call` / `events` stub OK)
- [ ] Debug instrumentation: last `HitTarget` per pointer down
- [ ] Dogfood content: glass toolbar + map/video (or color) underlay + click holes
- [ ] Prefer pure `resolveHit` from Phase 0.5 when available; if spike lands first, port Swift logic back into `@vela/api` before Phase 2

### Exit criteria

| Gate | Pass when |
|------|-----------|
| S1–S7 | All [macOS spike scenarios](testing-and-acceptance.md) pass manually or automated |
| Demo | Short video or runnable app: glass toolbar + underlay + holes; not OS desktop clicks for in-window holes |
| Docs | Spike doc updated with “what we learned” deltas that affect ADR 0002 acceptance |
| Gaps | G-P0-3 remains closed; G-P0-5 and G-P1-7 updated from spike reality |

### Explicit non-goals (Phase 1)

- Bun host process split (single Shell process is the default spike shape)
- Full capability engine / plugin ABI
- Scroll-linked native slots, per-pixel alpha hit, CSS-transform hitching
- Windows / Linux / mobile hosts
- Pixel-identical glass across OS versions
- Production `app://` packaging (local / temp scheme OK)

### Exit artifact

Short demo video or app binary notes in PR / issue: glass toolbar + underlay + hole hit-test + single `HitTarget` proof.

---

## Phase 2 — Bun host + typed RPC

**Status:** `[ ]` not started.

**Goal:** Bun process owns app lifecycle, plugins catalog, and capability checks; Shell owns window/WebView/layers/hit; communication is typed message-pass RPC with privilege boundaries.

**Depends on:** Phase 1 channel feedback; [ADR 0002](adr/0002-ipc-privilege.md) path to **Accepted**.  
**Design debt:** G-P0-2, G-P0-4, G-P1-5, G-P1-6.

### Work items

- [ ] Bun process owns app lifecycle (launch, quit, multi-window policy as designed)
- [ ] Typed RPC / privilege boundary (ADR 0002 decisions implemented)
- [ ] Capability checks on `call` and sensitive layer inserts (**both** Bun and Shell — defense in depth)
- [ ] App manifest profiles (on-disk schema — [G-P1-6](design-gaps.md))
- [ ] Packaging hooks for web assets + custom schemes (`app://` / `asset://` intent)
- [ ] `LayerTreeSnapshot` or equivalent Shell↔Bun sync type ([G-P1-5](design-gaps.md))
- [ ] Preload full surface: `call` / `layers` / `hit` / `events` (whitelist only)
- [ ] Accept ADR 0002 after Phase 1 channel reality check

### Exit criteria

- [ ] Page JS cannot reach Node / FFI / secrets; only `window.vela`
- [ ] Missing capability → structured deny, never silent success
- [ ] Production-shaped content load does not require open localhost as default
- [ ] ADR 0002 status → Accepted (or superseding ADR recorded)

### Out of scope

- Full plugin marketplace / third-party signed ABI (Phase 5)
- Mobile Bun-in-process runtime (never the model — see architecture)

---

## Phase 3 — Capability plugins (desktop)

**Status:** `[ ]` not started.

**Goal:** First-party desktop permissions that match the security spine and force allow/deny dogfood.

**Depends on:** Phase 2 RPC + capability checks.

### Work items

- [ ] `fs` (app sandbox scope), `dialog`, `clipboard`, `notify`
- [ ] `shell:open-external`
- [ ] Material insert permission enforcement (`window:material` or successor)
- [ ] Camera / native-sensitive insert permission paths (even if camera is stub)
- [ ] Playground exercises **each** permission path (allow **and** deny)
- [ ] Event / diagnostics catalog start: material degraded, deny reasons ([G-P1-3](design-gaps.md))

### Exit criteria

- [ ] Capability acceptance checklist in [testing-and-acceptance.md](testing-and-acceptance.md) checked for shipped plugins
- [ ] Deny is structured and testable; no Node escape from preload
- [ ] Manifest grants are the only production grant path for these plugins

### Out of scope

- Arbitrary unsigned native factories (Phase 5)
- Full OS permission UX localization polish

---

## Phase 4 — Windows materials + parity

**Status:** `[ ]` not started.

**Goal:** Second Tier 1 desktop host with behavioral hit/material parity (not pixel parity).

**Depends on:** Phase 1 algorithms (`resolveHit` preferred shared); Phase 2 packaging/RPC patterns reusable where possible.

### Work items

- [ ] WebView2 host path
- [ ] Mica / Acrylic material layers + degrade diagnostics
- [ ] Hit parity with macOS spike scenarios (S2–S6 class behavior)
- [ ] Loud diagnostic when WebView2 runtime missing (no silent blank window)
- [ ] Acceptance **W1–W3** in [testing-and-acceptance.md](testing-and-acceptance.md)

### Exit criteria

- [ ] W1–W3 pass
- [ ] Same dogfood content package runs with platform material fallbacks documented
- [ ] Platform matrix updated in [platform-support.md](platform-support.md)

### Out of scope

- Linux host (tracked under P2 / later)
- Pixel-perfect Mica vs Liquid Glass matching

---

## Phase 5 — Plugin ABI + signing

**Status:** `[ ]` not started.

**Goal:** Safe extension of native surface area without `dlopen` from page JS.

**Depends on:** Real need for external native modules; Phase 2–3 load path exists.

### Work items

- [ ] **ADR 0003**: plugin ABI and signing (lessons from Tauri packaging research, not a Tauri reimplementation)
- [ ] Signed native factories for extra surfaces
- [ ] Block unsigned load by default (`native:load-unsigned` off)
- [ ] Host verification of signature / trust store policy documented

### Exit criteria

- [ ] ADR 0003 Accepted
- [ ] Unsigned load blocked in production profile
- [ ] At least one signed sample factory loads; unsigned sample fails closed

### Out of scope

- Public third-party store
- Cross-OS universal binary policy beyond documented host rules

---

## Phase 6 — Mobile hosts

**Status:** `[ ]` not started.

**Goal:** iOS and Android hosts implement the **same contracts** for a documented subset (WebView + layer protocol + capabilities subset).

**Depends on:** Stable contracts from Phase 0.5–2; desktop dogfood content reusable.

### Work items

- [ ] iOS host: WebView + layer protocol subset
- [ ] Android host: WebView + layer protocol subset ([G-P2-4](design-gaps.md) packaging pattern)
- [ ] Shared dogfood content against both
- [ ] Document which Layer kinds / materials / capabilities are Tier 1 vs degrade
- [ ] Bun remains **build/CI** tooling — not in-process mobile JS host

### Exit criteria

- [ ] Same `@vela/api` types drive mobile bridge without forked public packages
- [ ] Subset acceptance scenarios defined and run (document mobile S-matrix in testing doc when started)
- [ ] [platform-support.md](platform-support.md) mobile rows accurate

### Out of scope

- Full desktop material parity on mobile
- Complete plugin set from Phase 3 on day one

---

## Phase 7 — Phase-2 composition

**Status:** `[ ]` not started.

**Goal:** Composition features that are unsafe or unnecessary for the first spike.

**Depends on:** Solid Phase 1–4 hit ownership and generation rules.

### Work items

- [ ] Scroll-linked native slots
- [ ] Richer transforms / hitching **where safe**
- [ ] Optional point-query web-shaped mode at scale
- [ ] `HitPolicy.callback` payload types if still required ([G-P1-1](design-gaps.md))
- [ ] Stronger `MaterialLayer.content` / multi-child semantics ([G-P1-2](design-gaps.md))

### Exit criteria

- [ ] Features documented as supported or experimental per platform
- [ ] No regression on S1–S7 / W1–W3 class scenarios
- [ ] Opacity still does not silently change hit policy

### Out of scope (still)

- Full CSS/DOM reimplementation outside WebView
- Per-pixel alpha hit testing as default
- Replacing sibling Rust/wgpu `Vela` product scope

---

## Near-term checklist (maintainer focus)

Use this as the default work queue until Phase 2 exit.

1. [x] ADR + `@vela/api` contracts (Phase 0)
2. [ ] **Phase 0.5:** pure `resolveHit` + tests (G-P0-1)
3. [ ] **Phase 0.5:** RPC envelopes / error codes (G-P0-2)
4. [ ] **Phase 1:** macOS spike — WebView + Liquid Glass toolbar + hole hit-test ([spike architecture](macos-spike-architecture.md), S1–S7)
5. [ ] Accept ADR 0002 after Phase 1 channel feedback
6. [ ] **Phase 2:** Bun host + typed RPC / preload bridge
7. [ ] **Phase 3:** Capability plugins (fs, dialog, clipboard, notify) + allow/deny playground
8. [ ] **Phase 4:** Windows WebView2 + Mica/Acrylic + hit parity
9. [ ] **Phase 5–7:** as dependency spine allows; mobile shares contracts without blocking desktop

---

## Documentation and process follow-ups

| Item | Status |
|------|--------|
| ADR 0002 Proposed | `[x]` [adr/0002-ipc-privilege.md](adr/0002-ipc-privilege.md) |
| Accept ADR 0002 after Phase 1 | `[ ]` |
| ADR 0003 Plugin ABI + signing | `[ ]` planned |
| Testing and acceptance (host smoke) | `[x]` [testing-and-acceptance.md](testing-and-acceptance.md) |
| Qt composition notes | `[x]` research |
| Tauri comparison | `[x]` research |
| Docs index | `[x]` [README.md](README.md) |
| macOS spike architecture | `[x]` design |
| Design gaps register | `[x]` [design-gaps.md](design-gaps.md) |
| `@vela/api` pure `resolveHit` + RPC envelopes | `[ ]` design-gaps P0 |
| CI matrix once hosts exist | `[ ]` [G-P2-6](design-gaps.md) |
| Linux WebView + blur baseline choices | `[ ]` [G-P2-3](design-gaps.md) |
| Product vs repo naming clarity | `[~]` README partial [G-P2-7](design-gaps.md) |

Update [docs/README.md](README.md) when this page’s role or reading order changes.

---

## Explicit non-goals (early phases)

Do not schedule these as Phase 0–4 success criteria:

- Full CSS/DOM reimplementation outside WebView
- Pixel-perfect material parity across OS
- Per-pixel alpha hit testing as the default hit model
- Replacing sibling Rust/wgpu `Vela` (`../Vela`) product scope
- Bundled Chromium (system WebView is the model)
- Page JS with Node integration or raw FFI

Competitor-driven **invent list** (why Vela exists — do not regress): regional layer pass-through, materials as layers, `WindowInputMode` vs `HitPolicy` split, capability default-deny. See [design gaps](design-gaps.md) competitor table.

---

## How to update this roadmap

1. Change checkboxes when work lands in the repo, not when it is only discussed.
2. Close or re-open rows in [design-gaps.md](design-gaps.md) when contracts absorb a rule.
3. Promote ADR status only via the ADR file + index; link from here.
4. When a phase exit is claimed, point to acceptance scenarios or tests that prove it.
5. Keep language aligned with [writing guidelines](writing-guidelines.md) (US English, Tracking type honesty).

## Related

| Doc | Why open it |
|-----|-------------|
| [Architecture](architecture.md) | Product split and security spine |
| [Design gaps](design-gaps.md) | Prioritized contract debt (P0–P2) |
| [Testing and acceptance](testing-and-acceptance.md) | S1–S7, W1–W3, capability gates |
| [macOS spike architecture](macos-spike-architecture.md) | Phase 1 executable design |
| [ADR 0001](adr/0001-composition-hit-material.md) | Accepted composition decisions |
| [ADR 0002](adr/0002-ipc-privilege.md) | IPC / privilege (Proposed → Accept after Phase 1) |
| [API contracts](api-contracts.md) | `@vela/api` module map |
| [Platform support](platform-support.md) | Tiers and feature matrix |
| [Technology stack](technology-stack.md) | Host/runtime choices |
| [Docs index](README.md) | Reading order |
