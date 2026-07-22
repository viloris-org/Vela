# ADR 0008: Zig as the default unified systems surface for capabilities

> **Type**: Decision  
> **Status**: Accepted decision (doc current)  
> **Audience**: Plugin authors | Host implementers | Maintainers  
> **SoT**: Binding placement of Zig for **capability systems** implementations; app contracts remain `@vela/api`; Shell interop remains [ADR 0005](0005-zig-interop-layer.md)

- **Status**: Accepted
- **Date**: 2026-07-23
- **Deciders**: Project maintainers

## Context

[ADR 0006](0006-ts-first-capabilities.md) makes TypeScript the default **authoring**
language for capability plugins and allows optional native kernels (T1.5) mainly
framed as performance. [ADR 0005](0005-zig-interop-layer.md) places Zig as the
desktop **Shell interop** control plane (RPC, dispatch, C ABI to L4). [ADR 0007](0007-typescript-full-stack-host.md)
locks TypeScript-first full stack and pluggable Host runtimes.

Product discussion clarified a stronger, maintenance-first need:

1. **System capabilities should ship as plugins**, not as ad hoc host glue.
2. **Authors should stay on TypeScript** for contracts, permissions, validation,
   and orchestration.
3. **First-party code that touches the OS or hot native paths should not scatter**
   across Swift, Kotlin, C/C++, WinRT, and one-off FFI per feature.
4. Without a **unified systems implementation surface**, each capability tends to
   invent its own language, ABI, error model, and build story — expensive to
   review, test, and staff.
5. A **slightly thicker** unified native layer is an acceptable cost if it keeps
   the common author path free of “import Swift here, Kotlin there, C over there.”
6. **Platform-exclusive** features (Liquid Glass, some permission UX, vendor SDKs)
   must not be falsely unified at the pixel/UX level — but they must still hang
   off the same plugin method names, discovery, and degrade/error paths.

Performance remains a valid reason to use Zig kernels. It is **not** the primary
reason for this ADR. **Maintainability and a single systems dialect** are.

This ADR does **not** make Zig the app UI language, the default Host plugin
authoring language, or a replacement for multi-backend Shell L4 toolkits.

## Decisions

### D1 - Primary motive: anti-scatter maintainability

Vela prefers **one default first-party systems implementation language and one
shared systems interface family** over many thin per-OS, per-language bridges.

| Without a unified systems surface | With this ADR |
|-----------------------------------|---------------|
| Clipboard in Bun, fs in Swift, crypto in Rust, dialogs in C++… | Portable OS/hot paths default to **Zig** behind Host TS |
| Each plugin invents FFI and error codes | Shared error model, ABI conventions, layout, CI templates |
| Plugin authors learn N native stacks | Common path: **TS only**; framework owns systems surface |
| Reviews span unrelated languages per feature | Reviews center on plugin TS + optional Zig module |

**Rule of thumb:** prefer a **slightly thick** unified systems surface over
**fragmented thin** native bridges that every capability author must learn.

### D2 - Two unifications (do not conflate)

| Layer | Owner | Audience | Unifies |
|-------|--------|----------|---------|
| **Product contract** | `@vela/api`, `window.vela`, permission ids | App authors, Host TS, docs | Method names, types, pure helpers, deny shapes |
| **Systems implementation surface** | **Zig** (this ADR) | Host loaders, plugin native kernels, maintainers | How first-party code calls OS / runs hot native work |

App and ordinary plugin **authoring** never treat the Zig surface as a second
public SDK. Page JS never imports Zig. Host TS talks to systems code through
**injected HostAPI / narrow ABI facades** after capability checks.

### D3 - Capability plugins remain the delivery unit

Non-UI system capabilities are **plugins** ([ADR 0006](0006-ts-first-capabilities.md)):

```text
plugins/<name>/
  src/
    permissions.ts    # defineCapability
    host.ts           # TS: require, validate, orchestrate
    client.ts         # optional thin App wrappers over vela.call
  native/             # default: Zig (or thin wrap of shared vela-sys)
  README.md
```

- **TS owns** public method registration, `ctx.require`, arg validation, policy,
  and structured errors toward the App.
- **Zig owns** (when present) the default first-party **implementation** of OS
  touchpoints and measured hot paths for that plugin or a shared systems library.
- Business capability code does **not** land in `hosts/zig-shell` by default
  ([ADR 0005](0005-zig-interop-layer.md), [ADR 0006](0006-ts-first-capabilities.md) D5).

### D4 - Zig is the default unified systems surface (not the Host runtime)

**Zig is:**

- The **default first-party language** for new portable systems implementations
  (OS-touching kernels, shared `vela-sys`-class modules, T1.5 hot paths).
- The place that **unifies** call shape, errors, buffers/handles, lifecycle, and
  capability hook points for those implementations across desktop OS (and, where
  linked in-process, mobile pure-compute kernels).

**Zig is not:**

- The default language for writing capability **plugins** (that remains Host TS).
- The App UI runtime or a substitute for the system WebView.
- A mandatory shared **UI toolkit** ([ADR 0004](0004-cross-platform-abstraction.md)).
- A requirement to route mobile App→OS through a desktop-style Zig **process**
  ([ADR 0005](0005-zig-interop-layer.md) D5, [ADR 0007](0007-typescript-full-stack-host.md)).

Conceptual call path:

```text
App TS
  window.vela.call
        │
        ▼
Host TS plugin handler     # caps, validate, orchestrate
        │
        ▼
Zig systems surface        # unified impl interface (plugin native and/or vela-sys)
        │
        ├─ portable backends (darwin / windows / linux / …)
        └─ exclusive / UI → L4 or vendor adapter (same call name; no false pixels)
```

### D5 - Accept thickness; reject multi-language author imports

**Accepted cost:** a unified systems library and plugin-native matrix may be
heavier than the thinnest possible per-platform glue.

**Rejected cost:** the common author path requiring:

```text
// Forbidden common-path DX
import … from "swift-bridge"
import … from "kotlin-bridge"
import … from "winrt-c"
```

| Role | Common path |
|------|-------------|
| **App author** | TypeScript / web only — `window.vela` |
| **Typical plugin author** | Host TypeScript only — injected `sys` / HostAPI facades |
| **Systems maintainer** | Zig (default) implementing the unified surface |
| **Platform / SDK engineer** | Swift, Kotlin, WinRT, vendor SDKs **behind** L4 or plugin adapters — not on the default import path |

**DX non-negotiable:** first-party **portable** capabilities must not require
plugin authors to choose a per-OS implementation language for the common path.

### D6 - What the unified surface covers

**In scope for unified Zig systems APIs (illustrative domains):**

- Sandboxed filesystem kernels, path policy helpers
- Clipboard, notifications (non-UI cores), process/open-external helpers
- Crypto, parse, encode, index, simulate, and similar hot kernels
- Shared buffer/handle conventions; stable error domains
- Versioned C ABI (or equivalent) for Host TS loaders

**Out of scope as “one Zig API fakes all OS UI”:**

- Windowing, WebView embed, layer tree, hit router entry ([ADR 0005](0005-zig-interop-layer.md) / L4)
- True system material paint (Liquid Glass, Mica, …) — L4; Zig may dispatch only
- Toolkit views (camera preview, maps, custom chrome) — T2 / L4
- Store-only permission sheets and platform UX copy

### D7 - Platform-exclusive capabilities (except without scatter)

Exclusive features are **excepted from false semantic unification**, not from
plugin discipline.

| Rule | Meaning |
|------|---------|
| **Same product entry** | App still uses `vela.call` / layers / permission ids |
| **No fake parity** | Do not implement “looks like Liquid Glass” on Windows as if it were equal |
| **Discover + degrade** | Unsupported platform → structured `unsupported` / material degrade diagnostics |
| **Implementation slot** | Prefer `os/<platform>.zig` backend, L4 factory, or vendor adapter **inside the same plugin package** |
| **No private stacks** | Exclusive work must not invent a second page-visible API or a one-off Host import dialect |

Examples:

| Feature | Contract | Systems / L4 |
|---------|----------|--------------|
| `apple.liquidGlass` | `MaterialId` + resolve/degrade | L4 paint; not a portable Zig blur pretend |
| iOS-only permission flow | Same permission id; platform availability | Native host path; method names stable |
| Vendor map/payment SDK | Plugin-defined methods | Original language + narrow ABI; TS facade |

### D8 - Three Zig hats (keep packages separate)

| Hat | Home (intent) | Job |
|-----|---------------|-----|
| **Shell interop** | `hosts/zig-shell` | Desktop RPC, dispatch, C ABI to L4 ([ADR 0005](0005-zig-interop-layer.md)) |
| **Shared systems surface** | e.g. `libs/vela-sys` or `hosts/vela-sys` (name TBD) | Unified portable OS/hot-path APIs and error/ABI conventions |
| **Plugin kernels** | `plugins/*/native` (or `zig/`) | Feature-specific T1.5 / thin wraps of `vela-sys` ([ADR 0006](0006-ts-first-capabilities.md) D9) |

**Forbidden by default:** dumping unrelated capability business logic into
`zig-shell` so the Shell process becomes a universal OS daemon.

### D9 - Relationship to tiers (extends ADR 0006)

| Tier | Authoring | Default systems impl |
|------|-----------|----------------------|
| **T0** | Host TS | Pure TS or host-safe APIs **allowed** when no meaningful OS kernel is needed |
| **T1** | Host TS | **Prefer** Zig systems surface for first-party OS touchpoints |
| **T1.5** | Host TS facade | **Zig** (preferred) kernel — perf **and/or** systems consolidation |
| **T2** | Host TS facade | L4 / signed native UI; Zig does not own toolkit paint |

Amend the reading of ADR 0006 D9: Zig kernels are not only “measure then
optimize.” For **first-party portable OS-touching** code, Zig is also the
**default implementation home** so capabilities do not scatter. Measurement still
gates rewriting **trivial** pure-TS plugins into native for speed alone.

### D10 - Mobile and process topology

- **App path** remains message-pass only on every OS ([ADR 0007](0007-typescript-full-stack-host.md) D3).
- Mobile v1 **need not** run desktop Bun↔Zig UDS topology ([ADR 0005](0005-zig-interop-layer.md) D5).
- Zig systems code may be **statically linked in-process** on mobile for pure
  kernels; UI and many OS features may still be Swift/Kotlin **behind the same
  method names**.
- Do not introduce extra IPC hops solely to force every mobile call through Zig.

### D11 - Repository placement (intent)

```text
packages/api/                 # @vela/api — product contract SoT
plugins/<capability>/         # TS facade + optional native/
libs/vela-sys/                # or hosts/vela-sys — shared Zig systems surface (planned)
hosts/zig-shell/              # Shell interop only (ADR 0005)
hosts/*-shell/                # L4 toolkits (Swift, Win, …)
```

Exact folder names may change; dependency rules do not:

- `@vela/api` does not depend on Zig.
- Host TS depends on injected facades / loaders, not on leaking Zig types into App bundles.
- `zig-shell` does not become the default home for capability implementations.

### D12 - What we reject

| Alternative | Verdict |
|-------------|---------|
| Per-capability language free-for-all (Swift/Kotlin/C/…) as the **common** path | **Rejected** |
| Zig as default **plugin authoring** language (replace Host TS) | **Rejected** ([ADR 0006](0006-ts-first-capabilities.md) alt C) |
| Zig as **App** UI or page-visible FFI | **Rejected** |
| One Zig API that pretends all materials/views are identical | **Rejected** |
| Merge all capabilities into `zig-shell` | **Rejected** |
| “Thinness above all” if it forces multi-language author imports | **Rejected** |
| Mandatory Zig process hop on iOS/Android for every system call | **Rejected** |

## Consequences

### Positive

- Clear anti-scatter story: **TS for velocity and policy; Zig for systems convergence.**
- Plugin authors keep one mental model; systems maintainers keep one dialect.
- Aligns with existing Shell interop choice (Zig) without overloading `zig-shell`.
- Exclusive features stay honest (degrade/unsupported) without inventing private stacks.
- Accepts known thickness in exchange for long-term review and staffing cost control.

### Negative / costs

- Native build matrix and ABI versioning for `vela-sys` / plugin natives.
- Risk of a **god library** if `vela-sys` is not modularized by domain.
- Temptation to push trivial T0 plugins into Zig without need.
- Mobile still needs platform engineers for T2/L4 and some OS UX; Zig does not erase that.
- Docs and onboarding must carefully separate **three Zig hats** (D8).

### Mitigations

- Domain-split systems modules (fs, clipboard, crypto, …) under one convention.
- T0 pure-TS escape hatch for orchestration-only plugins.
- Exclusive-feature checklist: same method name, availability, degrade, no second API.
- CI templates for plugin-native + shared `vela-sys` targets.
- Code review rule: new first-party OS glue in non-Zig languages needs a written exception.

## Alternatives considered

### A - Keep ADR 0006 as “TS default; native only when measured slow”

Pros: minimal process change.  
Cons: does not stop multi-language scatter for ordinary OS capabilities.  
Verdict: **insufficient**; D9 remains for pure perf, but systems default needs this ADR.

### B - Native-only Host (Swift/Kotlin/C++ plugins as authoring default)

Pros: max OS fidelity.  
Cons: kills Host TS velocity ([ADR 0006](0006-ts-first-capabilities.md) / [ADR 0007](0007-typescript-full-stack-host.md)).  
Verdict: **rejected** as default.

### C - Thin per-OS bridges chosen per plugin (maximum leanness)

Pros: shortest path to each API.  
Cons: author and maintainer thrash across languages and ABIs.  
Verdict: **rejected** for the common path; thickness of one surface preferred (D5).

### D - Put all systems APIs inside `zig-shell`

Pros: one binary to stare at.  
Cons: Shell becomes a capability dumping ground; crash domain and plugin packaging blur.  
Verdict: **rejected** (D8).

### E - Rust (or C++) as the unified systems language instead of Zig

Pros: mature ecosystems.  
Cons: second heavy systems story beside existing Zig interop choice; weaker fit with
“one systems dialect” already chosen for desktop control plane.  
Verdict: **not default**; foreign kernels allowed when they expose the **same** narrow
ABI family (vendor/existing code).

## References

- [Capabilities and plugins](../capabilities-and-plugins.md)
- [Architecture](../architecture.md)
- [Technology stack](../technology-stack.md)
- [Cross-platform abstraction](../cross-platform-abstraction.md)
- [ADR 0002](0002-ipc-privilege.md) — privilege / message pass
- [ADR 0004](0004-cross-platform-abstraction.md) — multi-backend Shell
- [ADR 0005](0005-zig-interop-layer.md) — Zig Shell interop
- [ADR 0006](0006-ts-first-capabilities.md) — TS-first capabilities / T1.5
- [ADR 0007](0007-typescript-full-stack-host.md) — full-stack TS / pluggable Host
- ADR 0003 (planned) — plugin ABI and signing
