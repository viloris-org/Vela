# ADR 0005: Zig as Bun↔native interop layer

> **Type**: Decision  
> **Status**: Accepted decision (doc current)  
> **Audience**: Maintainers | Host implementers  
> **SoT**: Binding placement of Zig in the desktop host stack; contracts remain `@vela/api`

- **Status**: Accepted
- **Date**: 2026-07-22
- **Deciders**: Project maintainers

## Context

Desktop Vela splits privilege across Bun (orchestration, capabilities, plugins)
and Native Shell (window, WebView, layers, hit, materials). [ADR 0002](0002-ipc-privilege.md)
locks **message-pass** transport (Unix domain socket / named pipe + JSON
envelopes) and **rejects** in-process FFI from Bun into the full Shell for
Phase 2+ crash/trust isolation.

[ADR 0004](0004-cross-platform-abstraction.md) locks **contracts-first
multi-backend** Shells: each OS keeps its toolkit (Swift, WinRT, …). It allows
optional shared pure native helpers but rejects a mandatory shared UI core.

We need a **portable middle layer** that:

1. Speaks the Bun↔Shell control protocol once.
2. Dispatches Shell jobs to per-OS backends without forking app contracts.
3. Gives a stable C ABI so Swift / C++ / other natives do not each reimplement
   RPC framing and process wiring.
4. Does **not** own AppKit/WebView2 paint or hit-test entry points (those stay
   platform-private L4).

**Zig** is chosen for that middle layer: manual memory control, first-class C
interop, cross-compile story, and no requirement to pull a second heavy runtime
into the Shell process.

## Decisions

### D1 - Zig is the desktop interop spine (L2.5)

On desktop Phase 2+, the Shell process is structured as:

```text
Bun host (TypeScript)
    │  UDS / named pipe + RPC envelopes (ADR 0002)
    v
Zig interop layer          ← portable control plane
    │  stable C ABI (Shell port)
    v
Platform backends (L4)     ← Swift / Win / Linux toolkit code
```

| Piece | Language | Owns |
|-------|----------|------|
| Bun host | TypeScript (Bun) | Lifecycle orchestration, capability catalog, plugins, packaging hooks |
| **Zig interop** | **Zig** | RPC listen/connect, framing, method dispatch, backend vtable, optional pure ports, Shell process main on desktop |
| Platform backend | Swift, C++/WinRT, … | Windowing, WebView embed, real views, hit entry, materials paint, OS APIs |

Zig is **not** an app-facing API and **not** a replacement for `@vela/api`.

### D2 - What Zig may and must not own

**Zig may own**

- Bun↔Shell socket lifecycle and framed RPC codec (payload shapes from `@vela/api`)
- Dispatch tables: `window.*`, `layers.*`, `hit.*`, `shell.*`, control methods
- Capability **prefilter** where the Shell can observe the op (defense in depth with Bun)
- Stable **C ABI** toward L4 (`vela_shell_*` style exports/imports)
- Optional pure ports of `resolveHit` / geometry when host-mirror drift cost is proven
- Logging, crash boundaries inside the Shell process, backend load/selection

**Zig must not own**

- App/plugin capability business logic (those default to Host TypeScript — [ADR 0006](0006-ts-first-capabilities.md)); portable OS kernels belong in plugin native / shared `vela-sys`, not here ([ADR 0008](0008-zig-systems-surface.md))
- Page-visible APIs (still only `window.vela`)
- AppKit / Win32 / GTK widget trees or WebView class selection as a product API
- True system material painting (calls into L4)
- OS hit-test overrides as the sole policy without L4 participation
- Secrets or business logic that belong in Host plugins

**Bun must not**

- `dlopen` platform toolkits or call Swift/WinRT directly for Shell jobs
- Expose Zig or C ABI to page JS

### D3 - C ABI is the Zig↔L4 contract

Platform backends expose a **C-compatible** port. Zig calls function pointers or
linked symbols; L4 may be:

| Style | When |
|-------|------|
| Static link into one Shell binary | Default desktop packaging |
| Dynamic library per backend | Optional; still Shell-trusted, not page-loaded |

Conceptual groups (names illustrative; exact headers land with host code):

| Group | Responsibility |
|-------|----------------|
| `vela_shell_window_*` | Create/show/bounds/DPI/`WindowInputMode` |
| `vela_shell_webview_*` | Embed, navigate, inject preload |
| `vela_shell_layer_*` | Insert/update/remove from contract specs |
| `vela_shell_hit_*` | Deliver `HitTarget` policy; region store updates |
| `vela_shell_material_*` | Resolve+paint; degrade reporting |
| `vela_shell_events_*` | Callbacks upward (focus, close, material.degraded, …) |

Logical coordinates and `@vela/api` field meanings stay the source of truth.
C structs are **host-private wire to L4**, not a second public app SDK.

### D4 - Trust and process boundaries (compatible with ADR 0002)

| Boundary | Mechanism | FFI? |
|----------|-----------|------|
| Page → privilege | Preload message pass only | **No** |
| Bun → Shell | UDS / named pipe + JSON-RPC envelopes | **No** (no Bun in-process Shell FFI) |
| Zig → L4 | In-process C ABI inside the Shell process | **Yes** (Shell-internal only) |

In-process Zig↔L4 does **not** reopen ADR 0002’s rejection of Bun↔Shell FFI:
crash isolation between Bun and Shell remains process-level; L4 failure is still
a Shell-domain failure.

### D5 - Phase rollout

| Phase | Zig role |
|-------|----------|
| **Phase 1 (macOS spike)** | **Optional.** Single-process Swift Shell may own local preload bridge to prove composition (S1–S7) without Zig. |
| **Phase 2 (Bun host)** | **Required on desktop.** Bun talks only to the Zig control plane over ADR 0002 transport; L4 is reached through Zig’s C ABI. |
| **Phase 4+ (Windows/Linux)** | Same Zig control plane; new L4 backends implement the same C ABI. |
| **Mobile** | **Not required.** iOS/Android may keep native orchestration without Bun; they may still reuse pure Zig libraries later if useful, but mobile v1 is not blocked on Zig. |

Phase 1 may introduce Zig early only if it does not delay S1–S7. Prefer proving
hit/materials in Swift first when those are the spike risk.

### D6 - Relationship to ADR 0004 “no mandatory shared UI core”

Zig **is** a shared **interop / control-plane** core. Zig **is not** a shared
**UI toolkit** core.

| Shared in Zig | Still multi-backend (L4) |
|---------------|---------------------------|
| RPC, dispatch, C port shape | WKWebView vs WebView2 vs WebKitGTK |
| Optional pure hit/geometry | `hitTest` / message loops |
| Process main wiring | Liquid Glass / Mica / gtk blur paint |

This refines ADR 0004 D3 “optional pure native helpers” into an explicit
language choice for the portable Shell-side control plane without adopting
WRY/TAO-style window abstraction as the product.

### D7 - Repository placement (intent)

```text
hosts/
  zig-shell/           # Zig interop: RPC, dispatch, C ABI, process main
  desktop-shell/       # macOS L4 (Swift) — existing spike tree
  windows-shell/       # future L4
  linux-shell/         # future L4
packages/api/          # @vela/api unchanged SoT for app + envelope types
```

Exact package names may adjust; the dependency rule does not:

- `@vela/api` does not depend on Zig.
- Zig may embed or generate checks from contract tests; it must not redefine
  app-facing types in a divergent public package.
- L4 backends depend on the C ABI header from `zig-shell` (or a tiny `shell-abi`
  crate/folder), not on Bun.

## Consequences

### Positive

- One Bun integration path for all desktop OS.
- Platform engineers implement a finite C port instead of each rewriting RPC.
- Preserves ADR 0002 process isolation and ADR 0004 multi-backend composition.
- Zig’s C ABI story fits Swift (`@_cdecl` / bridging header) and Win/C++ cleanly.

### Negative / costs

- Extra language in the desktop stack (TS + Zig + platform native).
- C ABI design and versioning discipline required.
- Phase 1→2 integration work to place Zig under an existing Swift spike.

### Mitigations

- Keep C ABI thin and job-shaped (window/webview/layer/hit/material/events).
- Generate or golden-test envelope codecs against `@vela/api` fixtures.
- Allow Phase 1 without Zig so composition risk stays isolated.

## Alternatives considered

### A - Bun native addon (N-API / Bun FFI) calling L4 directly

Pros: fewer processes in dev.  
Cons: collapses Bun↔Shell domains; each OS glue still needed; harder crash
isolation. Conflicts ADR 0002 D3.  
Verdict: **rejected** for Shell jobs.

### B - Shared Rust interop core instead of Zig

Pros: ecosystem familiarity (Tauri-adjacent).  
Cons: not required; risk of sliding into WRY/TAO UI core; team choice is Zig
for interop.  
Verdict: **rejected** as the default interop language (Rust may still appear
inside a specific L4 if Phase 4 picks it).

### C - Pure Swift/Win per OS including RPC duplicates

Pros: fewer languages on macOS spike.  
Cons: N copies of framing/dispatch; Bun integration forks. Acceptable only as
Phase 1 shortcut.  
Verdict: **Phase 1 only**; Phase 2+ use Zig.

### D - Zig owns full UI (no Swift/Win toolkits)

Pros: one codebase.  
Cons: loses Liquid Glass / system materials / correct sibling hit routing.
Conflicts product differentiators and ADR 0004.  
Verdict: **rejected**.

## References

- [Cross-platform abstraction](../cross-platform-abstraction.md)
- [Architecture](../architecture.md)
- [Technology stack](../technology-stack.md)
- [ADR 0002](0002-ipc-privilege.md) - IPC and privilege
- [ADR 0004](0004-cross-platform-abstraction.md) - multi-backend Shell
- [ADR 0006](0006-ts-first-capabilities.md) - TS capabilities / T1.5
- [ADR 0008](0008-zig-systems-surface.md) - Zig systems surface (not Shell dump)
- [macOS spike architecture](../macos-spike-architecture.md)
