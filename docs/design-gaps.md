# Design gaps

> **Type**: Tracking  
> **Status**: Current  
> **Audience**: Maintainers | Host implementers  
> **SoT**: Gap register between docs and implementable contracts

Prioritized gaps between **written architecture** and **implementable contracts**. Filled from the 2026-07 design research pass (macOS hit, materials, IPC, sibling scan, competitor matrix).

Status legend:

- open - not done
- partial - docs exist, types or hosts incomplete
- closed - done (leave short note)

Update this file when ADRs land or `@vela/api` absorbs a rule.

## P0 - Blocks correct Phase 1 / early Phase 2

| ID | Gap | Target | Status |
|----|-----|--------|--------|
| G-P0-1 | No pure `resolveHit(windowMode, layers, opaqueRegionStore, point) → HitTarget` in `@vela/api` | Shared algorithm + unit tests; Swift mirrors | **closed** (`hit/resolve-hit.ts` + tests; host mirror still Phase 1) |
| G-P0-2 | No RPC envelope / error code types | `@vela/api` protocol module; [ADR 0002](adr/0002-ipc-privilege.md) | **partial** (types in `protocol/rpc.ts`; wire + Bun still Phase 2) |
| G-P0-3 | Phase 1 view/hit architecture was prose-only | [macos-spike-architecture.md](macos-spike-architecture.md) | **closed** (doc) |
| G-P0-4 | IPC privilege decisions unrecorded | ADR 0002 | **partial** (Proposed) |
| G-P0-5 | web-shaped empty-default vs “block all until regions” underspecified for dogfood | Spike doc + input doc + api | **closed** (`EMPTY_REGION` / `defaultWebViewHitPolicy` + resolveHit tests; host applies store) |

## P1 - Needed soon after spike / for solid hosts

| ID | Gap | Target | Status |
|----|-----|--------|--------|
| G-P1-1 | `HitPolicy.callback` has no request/response payload types | `hit/policy.ts` + Shell protocol | open |
| G-P1-2 | `MaterialLayer.content` / GlassEffectContainer multi-child weak on runtime `Layer` type | Align `MaterialLayer` with `MaterialLayerSpec.content`; `mountChild` semantics | open |
| G-P1-3 | No formal `material.degraded` / diagnostics event catalog | `events` channel catalog in api-contracts | open |
| G-P1-4 | `generation` stale rules only partial in prose | Pure helper + tests; host must drop stale | **partial** (`isGenerationStale` / `applyWebShapeUpdate` in api; host drop path remains) |
| G-P1-5 | Layer tree snapshot type for Shell↔Bun sync | `LayerTreeSnapshot` | **partial** (`layer/snapshot.ts` + `toOpaqueRegionStore`; live Bun sync Phase 2) |
| G-P1-6 | App manifest **file** schema (on-disk format) | JSON/TOML schema doc + types | open |
| G-P1-7 | Coordinate conversion policy (AppKit y-up vs logical y-down) only implied | Explicit in spike + geometry notes | **closed** pure (`coordinates.ts`); Shell must call once at boundary |
| G-P1-8 | Zig C ABI header + RPC endpoint skeleton | `hosts/zig-shell` + Phase 2 | open |
| G-P1-9 | Bun capability host registration API (`handle` / plugin load) | `@vela/api` + Bun host Phase 2–3 | open |
| G-P1-10 | Bun loader + versioning for T1.5 perf native modules (Zig ABI) | Bun host + plugin packaging | open |

## P2 - Later phases / polish

| ID | Gap | Target | Status |
|----|-----|--------|--------|
| G-P2-1 | ADR 0003 Plugin ABI + signing | Planned | open |
| G-P2-2 | Event catalog beyond free-form `subscribe` | api-contracts planned expansions | open |
| G-P2-3 | Linux WebView + blur baseline choices | technology-stack + platform-support | open |
| G-P2-4 | Android Activity / WebView packaging pattern | platform-support | open |
| G-P2-8 | Cross-platform Shell abstraction unrecorded | [ADR 0004](adr/0004-cross-platform-abstraction.md) + conceptual doc | **closed** (Accepted; multi-backend + contracts-first) |
| G-P2-9 | Bun↔native middle language unrecorded | [ADR 0005](adr/0005-zig-interop-layer.md) | **closed** (Zig interop; C ABI to L4) |
| G-P2-10 | Capability authoring language / TS-first model unrecorded | [ADR 0006](adr/0006-ts-first-capabilities.md) | **closed** (TS default; native optional T2) |
| G-P2-5 | Isolation interceptor (Tauri-class) optional design | ADR 0002 D7 | open (deferred) |
| G-P2-6 | CI matrix for hosts | testing-and-acceptance | open |
| G-P2-7 | Product vs repo naming (`New_Vela` vs Vela vs sibling wgpu Vela) | README disambiguation | partial |

## Competitor-driven product gaps (intentional invent list)

These are **not bugs** - they are why Vela exists. Track so we do not regress to “invoke-only shell”.

| Capability | Electron | Tauri 2 | Vela invent |
|------------|----------|---------|-------------|
| Regional layer pass-through | Weak / incomplete (e.g. WebContentsView holes still requested) | Not first-class | `HitPolicy` + Shell router |
| System materials as layers | Weak | Not first-class | `kind: "material"` + `MaterialId` |
| Window→OS vs layer↔layer split | Often conflated with ignore-mouse | N/A | `WindowInputMode` vs `HitPolicy` |
| Capability default-deny | Possible, heavy surface | Strong | Copy mindset; own layer gates |

## Sibling project boundary

| Repo | Product | Transfer |
|------|---------|----------|
| `New_Vela` (this) | WebView-first + Bun + native composition | - |
| `../Vela` (Rust/wgpu) | Retained GPU GUI, **no** WebView core | Doc rigor, input/focus separation, acceptance culture - **not** runtime |

Do not merge codebases or share public package names without an explicit rename plan.

## Suggested close order

1. Keep [macos-spike-architecture.md](macos-spike-architecture.md) updated during spike.
2. Accept ADR 0002 after Phase 1 channel reality check.
3. Implement G-P0-1 (`resolveHit`) + tests before multiple hosts diverge.
4. Envelope types (G-P0-2) with Bun host work.
5. ADR 0003 when first external native module is real.

## Related

- [Roadmap](roadmap.md)
- [API contracts](api-contracts.md) planned expansions
- [Cross-platform abstraction](cross-platform-abstraction.md)
- [ADR 0004](adr/0004-cross-platform-abstraction.md)
- [ADR 0005](adr/0005-zig-interop-layer.md)
- [ADR 0006](adr/0006-ts-first-capabilities.md)
- [ADR index](adr/README.md)
