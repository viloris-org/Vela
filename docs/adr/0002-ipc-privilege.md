# ADR 0002: IPC, typed RPC, and privilege boundaries

> **Type**: Decision  
> **Status**: Proposed decision (doc current)  
> **Audience**: Maintainers | Host implementers  
> **SoT**: Proposed decisions for IPC and privilege boundaries

- **Status**: Proposed (design locked enough to implement against; accept after Phase 1 spike feedback)
- **Date**: 2026-07-21
- **Deciders**: Project maintainers

## Context

Vela splits runtime privilege across:

| Zone | Privilege | Role |
|------|-----------|------|
| WebView page JS | Least | Only `window.vela`; no Node, no FFI, no secrets |
| Bun host (desktop) | Medium - high | Capabilities catalog, plugins, lifecycle, packaging |
| Native Shell | Highest OS surface | Windowing, WebView embed, layer tree, hit router, materials, signed natives |

[ADR 0001](0001-composition-hit-material.md) fixed composition, hit, and materials. This ADR fixes **how trust boundaries talk**: transport, message shapes, where capability checks run, and what Phase 1 may stub.

We adopt **Tauri 2’s security mindset** (least privilege, message-pass IPC, capability grants, system WebView) without adopting Tauri as a runtime. See [Tauri comparison](../research/tauri-comparison.md).

Open stack questions this ADR closes (from [technology-stack](../technology-stack.md)):

- Bun ↔ Shell IPC transport
- Whether page→privilege is message-pass only (yes)
- Phase 1 vs Phase 2 process topology

## Decisions

### D1 - Message passing only from the page

- All privileged entry from Web content is **asynchronous message passing**.
- Preload exposes a **whitelist** only: `call` | `layers` | `hit` | `events`
(`VelaPreloadBridge` in `@vela/api`).
- **No** Node integration, **no** raw FFI, **no** arbitrary `require` from page JS.
- The privileged side may reject any request; structured errors preferred over silent no-ops.

### D2 - Desktop process topology

| Phase | Topology |
|-------|----------|
| **Phase 1 (macOS spike)** | **Single Shell process** may own window + layers + hit + local preload bridge. Bun optional. Goal: prove composition. |
| **Phase 2+** | **Two processes**: Bun host (orchestration) + Native Shell (window/WebView/layers). Mobile remains native host + same contracts (no in-process Bun app runtime). |

Bun is **not** embedded as the Shell’s UI event-loop language. Shell owns AppKit/Win/GTK loops.

### D3 - Bun ↔ Shell transport (Phase 2 default)

**Decision: Unix domain socket (macOS/Linux) / named pipe (Windows) + framed JSON-RPC-style messages.**

| Option | Verdict |
|--------|---------|
| Unix socket / named pipe + JSON envelopes | **Chosen** - clear boundary, testable, Bun-friendly |
| stdio child process | Dev-only alternative; avoid fighting logs/debuggers in production |
| In-process FFI Bun↔Shell | **Rejected** for desktop Phase 2+ - collapses crash/trust domains |
| Shared memory first | Deferred - media/assets later, not control plane |

Framing: length-prefixed or newline-delimited JSON (host implementation detail); contracts define **payload shapes**, not wire bytes.

Desktop Phase 2+ implementation note: the Shell-side RPC endpoint and dispatch
live in the **Zig interop layer** ([ADR 0005](0005-zig-interop-layer.md)). Zig
may use in-process C ABI toward platform L4 backends inside the Shell process;
that does not reopen Bun↔Shell FFI.

### D4 - Channels and privilege

| Channel | Direction | Privilege notes |
|---------|-----------|-----------------|
| `call` | Web → Bun (via Shell or direct host routing) | Capability + schema check on Bun; Shell may prefilter |
| `layers` | Web → Shell | Sensitive inserts re-checked (`window:material`, `camera:*`, …) |
| `hit` | Web → Shell | web-shaped regions only; no OS privilege escalation |
| `events` | Shell/Bun → Web | Push only; no elevation |
| Shell ↔ Bun control | Bidirectional | Full host trust; still typed |

**Defense in depth:** Bun **and** Shell both enforce capability checks where each can observe the operation (layer insert on Shell; `call` on Bun). Neither alone is sufficient long-term.

### D5 - Envelope (contract direction)

To be added to `@vela/api` (see [design gaps](../design-gaps.md) P0):

```ts
// Design target - not all shipped yet
type VelaRpcRequest = {
  id: string;
  channel: "call" | "layers" | "hit" | "window" | "shell";
  method: string;
  args?: unknown; // structured-clone / JSON-serializable
};

type VelaRpcResponse = {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

type VelaEvent = {
  channel: string;
  payload: unknown;
};
```

Recommended error codes (initial set):

| Code | Meaning |
|------|---------|
| `capability.denied` | Missing permission / profile |
| `schema.invalid` | Args failed validation |
| `layer.not_found` | Unknown layer id |
| `material.degraded` | Not an error on insert if accepted with degrade - prefer **event** |
| `unsupported.platform` | Operation not available |
| `generation.stale` | web-shaped update rejected |
| `internal` | Unexpected host fault |

### D6 - Content loading and schemes

- Production: custom schemes `app://`, `asset://` (or successor) for app content.
- **Default deny** open developer localhost in production builds.
- Phase 1 spike may use `file://` or temporary local servers **only** for dogfood,
not as the product default.

### D7 - Isolation pattern (optional, later)

An isolation-style interceptor between untrusted page scripts and the privilege bridge (Tauri isolation pattern class) is **optional Phase 2+**, not required for Phase 1. If added, it must not bypass Shell hit/layer authority.

### D8 - What we copy from Tauri vs invent

| Copy (mindset) | Invent (Vela) |
|----------------|---------------|
| Process privilege split | Layer tree + hit router as first-class IPC surfaces |
| Commands ≈ `call`, Events ≈ `events` | `layers.*` / `hit.*` channels |
| Capabilities / permissions / runtime deny | Material + native layer insert gates |
| System WebView, not Chromium embed | Material backends, regional hit |
| Custom protocols for assets | Bun-centered desktop orchestration |

## Consequences

### Positive

- Clear security story for reviews and host implementation.
- Phase 1 can ship a demo without premature multi-process complexity.
- Phase 2 transport is boring and debuggable.
- Same envelope mindset for mobile native hosts (different physical transport).

### Negative / costs

- Dual process adds packaging and lifecycle work (Phase 2).
- JSON control plane is not optimal for high-frequency binary streams (accept; specialize later).
- Double capability checks require shared permission vocabulary.

### Follow-ups

- Land envelope types + error codes in `@vela/api`.
- ADR 0003: Plugin ABI and signing.
- ADR 0005: Zig interop layer (Accepted) — Shell-side RPC endpoint language.
- Phase 1: [macOS spike architecture](../macos-spike-architecture.md).
- Accept this ADR after spike confirms preload ↔ Shell channel assumptions.

## References

- [Architecture](../architecture.md) trust boundaries
- [Capabilities and plugins](../capabilities-and-plugins.md)
- [Tauri comparison](../research/tauri-comparison.md)
- Tauri 2: [process model](https://v2.tauri.app/concept/process-model/),
[IPC](https://v2.tauri.app/concept/inter-process-communication/), [capabilities](https://v2.tauri.app/security/capabilities/), [security](https://v2.tauri.app/security/)
- Electron contrast: `contextBridge` + IPC (window-level mouse ignore is **not** layer hit)
- [Design gaps](../design-gaps.md)
- [ADR 0005](0005-zig-interop-layer.md) - Zig interop placement
