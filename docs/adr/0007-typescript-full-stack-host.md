# ADR 0007: TypeScript-first full stack and pluggable privileged host

> **Type**: Decision  
> **Status**: Accepted decision (doc current)  
> **Audience**: App authors | Plugin authors | Host implementers | Maintainers  
> **SoT**: Binding product goal for full-stack TypeScript velocity; builds on [ADR 0006](0006-ts-first-capabilities.md)

- **Status**: Accepted
- **Date**: 2026-07-23
- **Amended**: 2026-07-23 (D8 performance assumptions; drop “Bun-centered” product identity; D7 static mode — Bun compile-only, App JS in WebView)
- **Deciders**: Project maintainers

## Context

[ADR 0006](0006-ts-first-capabilities.md) established TypeScript as the default
language for **capability plugins** on the privileged host, with optional native
bridges (T1.5 / T2). Product discussion clarified the real goal is broader:

> **TypeScript development velocity for both frontend (App) and privileged
> backend (Host)** — not “embed a particular JS engine brand,” and not “native
> host with TypeScript only on the page.”

Several false dichotomies appeared in design threads:

| Trap | Why it is wrong for Vela |
|------|---------------------------|
| “No Bun on device ⇒ cannot call system APIs from TS” | App TS always uses `window.vela`; the bridge works on every OS, including iOS |
| “Must ship full V8/Bun everywhere for Host TS” | Portable unit is **Host plugin source + contracts**, not one binary runtime |
| “System WebView JIT can hold privileged plugins” | Page and host must stay isolated; privilege lives behind the bridge |
| “Pure native host is enough for TS speed” | That keeps App TS fast but kills Host plugin velocity |
| “Tauri solves mobile by running Node on device” | Tauri compiles a privileged core; Vela’s App path is still bridge-only |

This ADR freezes the **full-stack TypeScript** goal, the **App vs Host TS**
split, **pluggable privileged runtimes**, and **iOS / mobile indirect system
access** through the same abstractions.

Related: [ADR 0002](0002-ipc-privilege.md) (bridge / privilege),
[ADR 0004](0004-cross-platform-abstraction.md) (contracts-first Shell),
[ADR 0005](0005-zig-interop-layer.md) (desktop interop, not plugin language),
[ADR 0006](0006-ts-first-capabilities.md) (capability tiers and T1.5).

## Decisions

### D1 - Product goal: TypeScript-first full stack

Vela optimizes for **author velocity in TypeScript** on both sides of the trust
boundary:

| Side | Author language | Runs where | Touches OS how |
|------|-----------------|------------|----------------|
| **App (frontend)** | TypeScript / web | System WebView JS engine | Only `window.vela` (message pass) |
| **Host (privileged backend)** | TypeScript (default) | Privileged host runtime | HostAPI / native bindings / Shell RPC after capability checks |
| **Shell (composition)** | Platform native | L3/L4 | Direct toolkit APIs (hit, materials, window, WebView embed) |

**Non-goals of this goal statement:**

- Pixel UI written in a second JS UI toolkit instead of WebView
- Privileged logic in page JS
- Requiring one JS engine binary on every OS

### D2 - App TS versus Host TS (never conflate)

| | **App TS** | **Host TS** |
|--|------------|-------------|
| Trust | Least privilege | Medium–high (host plugin) |
| API surface | `window.vela`: `call` / `layers` / `hit` / `events` | `HostAPI` / `handle` / injected `native` facades (design target) |
| May import Bun / FFI / Zig | **No** | Yes, only on the host side of the bridge |
| Portable from day one | **Yes** — same bridge on desktop and mobile | **Source-portable** when a host runtime backend exists; see D4 |
| iOS | WKWebView + preload bridge | Privileged runtime backend or temporary native method with the **same** `call` names |

**Rule:** “Using TypeScript to call system capabilities” on mobile always means
**App TS → abstraction → host/Shell**. It does **not** require Bun or V8 inside
the WebView, and it does **not** mean page JS holds raw OS handles.

### D3 - Indirect system access on every platform (including iOS)

On **iOS, Android, macOS, Windows, and Linux**, application code reaches system
capabilities **only** through Vela abstractions:

```text
App TS (system WebView)
  window.vela.call / layers / hit / events
        │ async message pass
        ▼
Privileged host + Shell
  capability check → OS / toolkit APIs
```

Consequences:

1. **iOS apps can and must** invoke clipboard, camera layers, materials, etc.
   **indirectly** via `window.vela` once the host implements those methods —
   same shapes as desktop.
2. **Absence of Bun on device does not block** App-side TS → system capability
   flows.
3. Page JS **never** links UIKit/AppKit/WinRT/JNI directly.
4. Missing permission yields a **structured deny**, not a silent native success.

### D4 - Portable unit is Host plugin source, not a single runtime binary

| Portable (product promise) | Not portable (implementation) |
|----------------------------|-------------------------------|
| `@vela/api` types and pure helpers | Bun vs JSC vs other embed engines |
| `window.vela` channel names and semantics | Process topology (single Shell vs Bun+Shell) |
| Permission ids and `call` method names | How `HostAPI.native.*` is bound per OS |
| Host **plugin TypeScript source** (when Host TS path is used) | Shipping the Bun executable inside every mobile IPA/APK |

**Desktop reference runtime:** Bun remains the **default privileged host** for
development speed and Phase 2+ desktop orchestration (see ADR 0002 / 0005 /
0006).

**Mobile and alternate hosts:** Prefer running the **same Host TS plugins** on a
**pluggable privileged runtime backend** (for example system JavaScriptCore
context on iOS, embeddable engine on Android, or a future shared embed ABI).
Until that backend exists for a platform, hosts may implement the **same method
names** in native code so App TS keeps working — that is a **parity bridge**,
not the long-term authoring default.

**Metric of success:** one Host plugin package can target multiple runtimes
without changing App code. **Not:** one JIT engine binary ships to the App Store
unchanged.

### D5 - Privileged host runtime is sandboxed and API-whitelisted

When Host TS runs, the runtime is **not** a browser and **not** full Node by
default:

| Allowed (direction) | Forbidden by default |
|---------------------|----------------------|
| Register `call` handlers | DOM / `window` page objects |
| `ctx.require(permission)` | Arbitrary `eval` / remote code load |
| Injected HostAPI / native facades for approved ops | Ambient filesystem or network without caps |
| Talk to Shell via host-mediated RPC | Page-visible FFI / `dlopen` |
| Load **signed** T1.5 kernels after checks | Treating “it is TypeScript” as trusted |

Engine choice (Bun, system JSC, QuickJS-class embed, V8 interpreter, …) is an
**implementation detail** behind a stable Host plugin ABI. Product docs must not
equate “Host TS” with “must embed full desktop V8 with JIT on iOS.”

Third-party **JIT** engines inside ordinary iOS App Store apps remain a
**compliance risk**; iOS backends should prefer **system JavaScriptCore** or
other store-acceptable embeds. Performance-critical work stays on **T1.5**
native kernels ([ADR 0006 D9](0006-ts-first-capabilities.md)), not on “faster
page JS.”

### D6 - Shell stays native; composition is not a JS host job

Hit routing, system materials, windowing, and WebView embed remain **Shell L3/L4
native** jobs ([ADR 0001](0001-composition-hit-material.md),
[ADR 0004](0004-cross-platform-abstraction.md)). Host TS may **request** layer
ops through the control plane; it does not reimplement Qt-class composition in
JS.

### D7 - Relationship to Bun tooling vs Bun runtime

| Use of Bun | Status |
|------------|--------|
| Workspace install, `bun test`, typecheck, bundling web assets | **Kept** — toolchain |
| Desktop privileged host (reference) | **Default for instant / Phase 2+ desktop plugin DX** — see [run modes](../run-modes.md) |
| **Static / release packages** | Bun is **build-time only** (compile/bundle). App JS runs in the **system WebView**. No product requirement to ship Bun for App execution |
| Required in-process runtime on iOS/Android app packages | **Not required** — and static mode is defined so desktop release validation matches that constraint |
| Only way App TS can call system APIs | **False** — bridge is enough for App |
| Product performance strategy | **Not Bun** — see D8 |

**App JS placement (binding):** In every mode, App TypeScript executes in the
**system WebView**, not under Bun. Instant mode may load App assets from a dev
server; static mode loads **prebundled** assets. Bun may still run as a
**separate privileged Host** on desktop for plugin DX; that process is not the
App UI engine and is not required inside mobile packages.

Docs and marketing should say **TypeScript-first full stack**, **WebView-first UI**, and **contracts-first Shell**. Prefer **“desktop reference Host: Bun”** over **“Bun-centered framework.”** If older prose says “Bun-centered,” read it as **desktop orchestration + repo tooling**, not “Bun binary inside every mobile app” and not “Bun runtime speed is the product bet.”

Run-mode matrix (instant vs static assembly): **[run-modes.md](../run-modes.md)**.  
App WebView load costs and prewarm/cache (no Bun on device to fix cold start): **[app-load-and-startup.md](../app-load-and-startup.md)**.

### D8 - Performance assumptions (engines vs native)

These are product assumptions, not microbenchmark claims:

| Surface | Performance expectation |
|---------|-------------------------|
| **App TS** (system WebView) | Trust the **platform WebView** engine (WebView2/V8, WKWebView/JSC, …). Typical UI and business logic does not need a custom embed engine. |
| **Host TS** (desktop Bun or other backends) | Typical load is I/O, permission checks, validation, and RPC orchestration. **Server-oriented JS runtime advantages (for example Bun vs Node throughput) are not a product requirement** unless a plugin deliberately does heavy pure-TS work without a native kernel. |
| **Hot paths / first-party OS kernels** | Prefer **T1.5 / systems Zig** behind Host TS facades ([ADR 0006](0006-ts-first-capabilities.md) D9, [ADR 0008](0008-zig-systems-surface.md)). Do not treat “faster Host JS” as the primary fix. |
| **Composition / hit / materials** | **Shell L3/L4 native** — never a JS-engine race. |

**Rule:** do not select or justify Bun solely for runtime benchmarks. Keep Bun for **DX, monorepo tooling, and a concrete desktop Host implementation**. Engine choice remains an implementation detail under a pluggable Host plugin ABI (D4–D5).

### D9 - What we reject as the default story

| Alternative | Verdict |
|-------------|---------|
| Native-only Host as the **authoring** default forever | **Rejected** — destroys backend TS velocity (ADR 0006) |
| Page-side Node / Electron-like integration | **Rejected** — ADR 0002 |
| Full Chromium + Node as the product core | **Rejected** — ADR 0004 |
| Mandatory self-shipped JIT V8 on all platforms for Host | **Rejected** as requirement; optional where legal and sized |
| Claiming iOS cannot use `window.vela` for system features | **Rejected** — D3 |
| Framing Vela as a **Bun-centered** product identity | **Rejected** for docs/marketing; say TypeScript-first / WebView-first |
| Choosing Bun **because** of server-style JS throughput | **Rejected** as the primary reason — see D8 |

## Consequences

### Positive

- Clear product north star: **TS speed on App and Host**, composition on Shell.
- iOS/Android App authors keep one bridge mental model; system access is real and
  indirect.
- Bun remains a practical desktop **instant** Host + toolchain without blocking
  mobile architecture or overselling runtime performance; **static** packages
  keep App JS in the WebView so iOS/Android ship shape is the release default.
- Engine debates stay under “pluggable backend,” not under public app APIs.
- Aligns capability tiers (ADR 0006) with cross-platform Shell (ADR 0004).

### Negative / costs

- Must design a **Host plugin ABI** and registration API (still Phase 2–3 work).
- Mobile Host TS parity may lag; native method shims needed early.
- Two JS heaps possible (WebView + Host runtime) when Host TS is embedded —
  size and CVE surface must be budgeted.
- Teams must document which plugins are “Host TS source portable” vs
  “native-implemented call.”

### Mitigations

- Shared RPC / permission schemas in TypeScript so App and Host typecheck
  together.
- Host sandbox whitelist (D5); no npm-arbitrary require in production Host by
  default.
- Acceptance: same dogfood `vela.call` names on desktop and mobile subset.
- Prefer small first-party plugins before a large Host package ecosystem.

## Alternatives considered

### A - Contracts + App TS only; Host always native

Pros: simplest mobile shipping.  
Cons: fails the stated goal of backend TS velocity.  
Verdict: **acceptable interim** for a platform without Host runtime; **not** the
product end state for capability authoring.

### B - One embedded high-performance V8 on all OS

Pros: one embed API.  
Cons: iOS store/JIT and binary size; overkill for orchestrated `call` handlers.  
Verdict: **not required**; may appear as one backend among several.

### C - Compile Host TS to native per platform (no JS host at runtime)

Pros: store-friendly.  
Cons: heavy toolchain; weaker hot reload.  
Verdict: **allowed later** if it preserves the same plugin source layout; does
not replace D1’s authoring goal.

## References

- [Architecture](../architecture.md)
- [Capabilities and plugins](../capabilities-and-plugins.md)
- [Cross-platform abstraction](../cross-platform-abstraction.md)
- [Platform support](../platform-support.md)
- [ADR 0002](0002-ipc-privilege.md) — IPC / privilege
- [ADR 0004](0004-cross-platform-abstraction.md) — multi-backend Shell
- [ADR 0005](0005-zig-interop-layer.md) — Zig interop
- [ADR 0006](0006-ts-first-capabilities.md) — capability tiers
- [ADR 0008](0008-zig-systems-surface.md) — Zig systems surface (impl, not Host authoring)
- [Tauri comparison](../research/tauri-comparison.md) — security mindset, not runtime
