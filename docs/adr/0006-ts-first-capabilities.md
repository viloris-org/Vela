# ADR 0006: TypeScript-first capabilities with optional native bridges

> **Type**: Decision  
> **Status**: Accepted decision (doc current)  
> **Audience**: App authors | Plugin authors | Host implementers | Maintainers  
> **SoT**: Binding authoring model for capabilities/plugins; types in `@vela/api`

- **Status**: Accepted
- **Date**: 2026-07-22
- **Amended**: 2026-07-22 (D9 performance modules); 2026-07-23 (full-stack goal → [ADR 0007](0007-typescript-full-stack-host.md); Host framing not Bun identity); 2026-07-23 (systems-surface reading of D9 → [ADR 0008](0008-zig-systems-surface.md))
- **Deciders**: Project maintainers

## Context

Vela apps are WebView-first and author UI in TypeScript/web stacks. Desktop
orchestration uses a TypeScript privileged Host (reference runtime: Bun —
DX/toolchain, not a performance identity; see [ADR 0007](0007-typescript-full-stack-host.md)).
Many product features need **system capabilities**
(filesystem sandbox, clipboard, dialogs, notifications, HTTP helpers, app
state) that should feel like ordinary async TypeScript — not require Swift,
Kotlin, or C++ for every feature.

**Product north star (full stack):** TypeScript velocity for **App and Host**,
not only page UI. Portable Host unit is plugin **source + contracts**; runtimes
are pluggable. iOS and other platforms reach OS features from App TS only via
`window.vela`. Binding detail: **[ADR 0007](0007-typescript-full-stack-host.md)**.

At the same time, some features **must** touch platform toolkits or foreign
code:

- UI-bearing surfaces (camera preview, custom chrome, map underlays)
- System materials paint
- High-performance or vendor SDKs
- Existing native libraries the app already owns

[ADR 0002](0002-ipc-privilege.md) keeps page JS on a whitelist bridge.
[ADR 0005](0005-zig-interop-layer.md) places Zig as desktop Bun↔Shell interop,
not as the place app authors write features.
[ADR 0003](README.md) (planned) will cover signed native module ABI.

Without an explicit authoring split, hosts tend to push “everything native” or
“everything in the page,” both wrong for security and velocity.

## Decisions

### D1 - TypeScript is the default capability authoring language

**Most capabilities are implemented in TypeScript on the privileged host side**
(desktop **reference runtime**: Bun; mobile and other hosts: **same Host TS
source** on a pluggable privileged backend when available; interim native
handlers may implement the same `call` names so App TS keeps working — see
[ADR 0007](0007-typescript-full-stack-host.md)).

App and plugin authors should be able to:

1. Declare permission ids and risk metadata (`defineCapability`).
2. Implement `vela.call` handlers as async TS functions.
3. Ship optional typed client wrappers for app code.
4. Grant permissions via app manifest profiles.

They should **not** need Zig, Swift, or C++ for clipboard, dialogs, sandboxed
fs, notifications, or similar non-UI system APIs when a TS host implementation
exists.

### D2 - Implementation tiers (including performance)

| Tier | When to use | Where it runs | Page sees |
|------|-------------|---------------|-----------|
| **T0 Pure / host TS** | No OS UI surface; Node/Bun or safe OS APIs enough | Bun host (desktop); host capability runtime | `vela.call` / events only |
| **T1 Host TS + system command** | Needs OS CLI/API but not a Layer | Bun host calling OS via controlled APIs | `vela.call` |
| **T1.5 Perf / systems module** | Measured hot path **or** first-party portable OS-touching kernel that should not scatter across languages | **Zig (preferred) or other native lib** loaded by **Host**; narrow ABI | `vela.call` / events (same as T0) |
| **T2 Native UI / toolkit bridge** | Toolkit view, camera, materials, vendor UI SDK | Shell L4 and/or signed native UI module; Zig Shell interop dispatches | `vela.call` and/or `layers.insert` (`kind: "native"` / `material`) |

**Default path is T0/T1 for authoring** (Host TS facades). Choose **T1.5** when
measurement shows a hot path needs native speed **or** when a first-party
portable capability should live on the **unified Zig systems surface** so
implementations do not scatter ([ADR 0008](0008-zig-systems-surface.md)) — still
**no** toolkit Layer. Choose **T2** when the feature needs a real native view or
material surface.

T1.5 is still **TypeScript-first at the boundary**: app and thin client wrappers
stay TS; only the privileged backend kernel moves to Zig (or similar).

### D3 - App code always looks like TypeScript

Regardless of tier, **application Web content** only uses:

```ts
await window.vela.call("clipboard.write", { text });
await window.vela.layers.insert({ kind: "material", /* … */ });
window.vela.events.subscribe("notify.clicked", handler);
```

Rules:

- No Node, no `require`, no FFI, no Zig/Swift imports in page JS.
- Optional ergonomic packages (e.g. `@vela/plugin-clipboard`) are thin TS
  wrappers over `call` / events — they must not open a second privilege path.
- Native implementation language is an **host/plugin packaging detail**, not an
  app import.

### D4 - Capability plugins vs native UI plugins

| Plugin kind | Primary language | Registers | Creates layers? |
|-------------|------------------|-----------|-----------------|
| **Capability plugin** | **TypeScript (default)** | `defineCapability` + `call` handlers | No (unless it also ships a native UI piece) |
| **Perf / systems capability plugin** | **Zig kernel + TS facade** (T1.5; [ADR 0008](0008-zig-systems-surface.md)) | Same `call` handlers; Host loads native lib | No |
| **Native UI plugin** | Platform native (+ optional TS wrapper) | `defineNativeComponent` + signed module | Yes (`kind: "native"`) |
| **Material backend** | Platform native (Shell L4) | Host material paint for `MaterialId` | Yes (`kind: "material"`) |
| **Shell interop** | Zig (desktop, ADR 0005) | Transport / C ABI to L4 only — **not** capability dumping ground | No |
| **Shared systems surface** | Zig (`vela-sys`-class; ADR 0008) | Unified portable OS/hot-path APIs behind Host TS | No |

A single product feature may ship **TS capability surface + optional native
backend** behind the same permission ids and method names.

### D5 - How TS reaches other languages (allowed bridges)

Privilege stays on the host side of the bridge. Page JS never picks the
backend language.

| From | To | Mechanism | Allowed for |
|------|----|-----------|-------------|
| Page TS | Host | `window.vela` message pass | All app code |
| Bun TS capability | OS / pure logic | Bun APIs, child processes with policy, pure TS | T0/T1 |
| Bun TS capability | **Zig systems / perf module** | Privileged Host load of narrow C ABI / addon ([D9](#d9---zig-performance-and-systems-modules-behind-ts), [ADR 0008](0008-zig-systems-surface.md)) | T1.5 hot paths **and** first-party portable OS kernels |
| Bun TS capability | Shell jobs | RPC → Zig interop → L4 C ABI ([ADR 0005](0005-zig-interop-layer.md)) | Window/layers/hit/materials |
| Bun TS capability | Signed native UI module | Host loader + capability check (ADR 0003) | T2 extras |
| Zig interop | L4 Swift/C++/… | C ABI in Shell process | Shell-internal only |
| Host TS | Foreign language worker | Explicit host-mediated subprocess or plugin ABI | Heavy/sidecar cases |

**Forbidden:**

- Page TS `dlopen` / Bun FFI / Zig imports
- Capability handler that bypasses permission checks because “it is TS”
- Unsigned native load without `native:load-unsigned` (still default deny)
- Putting app business plugins into the **Shell interop** Zig binary by default
  (keep perf modules separate from window/hit control plane unless tightly coupled)

### D6 - Author experience targets

For a **T0/T1** capability, a plugin author should be able to ship:

```text
plugins/clipboard/
  package.json
  src/
    permissions.ts     # defineCapability ids
    host.ts            # register call handlers (Bun)
    client.ts          # optional typed wrappers for apps
  README.md
```

Sketch (illustrative, not shipped API freeze):

```ts
// host.ts — privileged Bun side
import { defineCapability } from "@vela/api";

defineCapability({
  id: "clipboard:write",
  risk: "low",
  description: "Write text to the clipboard",
});

export function register(host: CapabilityHost) {
  host.handle("clipboard.write", async (args, ctx) => {
    ctx.require("clipboard:write");
    await host.os.clipboard.writeText(String(args.text ?? ""));
    return { ok: true };
  });
}
```

```ts
// app page — least privilege
await window.vela.call("clipboard.write", { text: "hello" });
// or: await clipboard.writeText("hello") from a thin client wrapper
```

For **T2**, the same `call` / layer names remain; only the host registration
points at a native factory or Shell method.

### D7 - Security and review rules

1. **Default deny** — every `call` and sensitive layer insert checks the active
   capability profile.
2. **TS is not trusted because it is TS** — Bun-side handlers are privileged
   code; review and package them as host plugins, not as page scripts.
3. **Same permission vocabulary** for TS and native implementations of a
   feature.
4. **Defense in depth** — Bun enforces on `call`; Shell re-checks layer-facing
   ops it can observe.
5. **Native is explicit** — shipping a native binary/module is a deliberate T2
   choice with signing policy (ADR 0003), not the silent default.

### D8 - Relationship to Zig and multi-backend Shell

- Zig does **not** become the place app authors write clipboard-class features.
- Zig **does** carry desktop RPC so TS handlers can ask Shell for window/layer
  work without each plugin reinventing transport.
- L4 native languages implement composition quality; they are not the default
  language for non-UI capabilities.


### D9 - Zig performance and systems modules behind TS

**Yes — implement kernels in Zig (or another native language behind the same
narrow ABI), abstract a stable interface, expose it to the privileged Host, and
keep application calls in TypeScript.**

Use T1.5 when:

1. **Measurement** shows a hot path needs native speed or GC-hostile buffers, or
2. **Maintainability** says a first-party **portable OS-touching** implementation
   should live on the **unified Zig systems surface** so it does not scatter
   across Swift/Kotlin/C++/one-off FFI ([ADR 0008](0008-zig-systems-surface.md)).

Do **not** rewrite trivial pure-TS orchestration into Zig for style alone.

This is **T1.5**, distinct from ADR 0005 Shell interop and from the shared
systems library package:

| Zig role | Binary / package | Job |
|----------|------------------|-----|
| **Shell interop** (ADR 0005) | `hosts/zig-shell` | RPC, dispatch, C ABI to L4 window/WebView/layers |
| **Shared systems surface** (ADR 0008) | `libs/vela-sys` (name TBD) | Unified portable OS/hot-path APIs, errors, ABI conventions |
| **Perf / feature module** (this D9) | Plugin `native/` / `zig/` or package native code | CPU-heavy work **and/or** thin wrap of systems surface for one capability |

#### Shape

```text
App TS  --vela.call-->  Bun TS handler (caps, validate, orchestrate)
                              |
                              | narrow ABI (C / Bun FFI / addon)
                              v
                        Zig perf module (encode, parse, sim, crypto, …)
```

App code still looks like:

```ts
const out = await window.vela.call("media.transcode", {
  jobId,
  // handles / ids preferred over giant inline payloads when possible
});
```

#### Rules

1. **Prefer systems convergence for first-party OS touchpoints** — new portable
   first-party kernels default to Zig / `vela-sys` ([ADR 0008](0008-zig-systems-surface.md)).
2. **Do not native-for-style** — skip Zig for trivial pure-TS orchestration; use
   measurement when the only goal is speed.
3. **TS owns the public method** — permission checks, arg validation, and
   policy stay in the Host TS handler before any native call.
4. **Narrow ABI** — versioned C functions or a tiny command enum; no leaking
   Zig types into `@vela/api` or page bundles.
5. **Page never loads the module** — only the privileged Host (or Shell for
   UI-adjacent work) links/loads it.
6. **Data plane** — control stays on RPC envelopes; large binary may use
   `ArrayBuffer` / host-managed buffers / later shared memory. Do not force
   multi-megabyte blobs through JSON if the path is hot.
7. **Same method names** if a feature starts in pure TS and later gains a Zig
   kernel — apps should not need a new API for the optimization or consolidation.
8. **Other languages allowed** — Rust/C/C++ / vendor SDKs are fine when they
   expose the same narrow ABI family; Zig is the **preferred** first-party
   systems language, not a monopoly for third-party SDKs.

#### When T1.5 vs T2

| Need | Tier |
|------|------|
| Fast encode/parse/simulate/crypto **without** a native view | **T1.5** Zig (or similar) behind Bun TS |
| Camera preview, map underlay, system material chrome | **T2** Shell L4 / native UI plugin |
| Both (e.g. process frames + show preview) | TS facade + Zig kernel **and** native layer; still one app-facing API family |

#### Non-goals for D9

- Replacing WebView UI with Zig UI
- Requiring every plugin to ship a Zig binary (T0 pure TS remains valid)
- Making Zig the default **plugin authoring** language (Host TS remains default)
- Bun in-process FFI into the **full Shell** process (still ADR 0002 / 0005:
  Shell control plane is RPC; systems/perf modules for Host-side work are host-local)
- Dumping unrelated capabilities into `zig-shell` (ADR 0008 D8)

## Consequences

### Positive

- Fast iteration: most plugins stay in TypeScript next to Bun tooling.
- App authors keep one mental model (`vela.call` / layers / events).
- Native and other languages remain available when required.
- High-performance apps can drop Zig kernels under the same TS surface (D9).
- First-party OS implementations can converge on Zig without multi-language
  author imports ([ADR 0008](0008-zig-systems-surface.md)).
- Aligns with WebView-first product and least-privilege bridge.

### Negative / costs

- Host must provide a clear plugin registration API for TS handlers (Phase 2–3).
- Risk of putting too much privilege in Bun without good sandbox/scopes.
- Mobile may lag desktop TS plugin parity until a pluggable host capability
  runtime exists (App bridge path still works with native method shims).
- T1.5 adds native build matrix and ABI versioning discipline.
- Full-stack / App-vs-Host / iOS indirect access clarified in ADR 0007 (does not
  change tier table D2).

### Mitigations

- Path/url scopes on grants; no ambient filesystem.
- Prefer first-party T0/T1 plugins for common APIs before encouraging T2.
- Document T2 checklist (permissions, signing, layer kind, degrade path).

## Alternatives considered

### A - Native-only capabilities (Swift/Kotlin/C++ for everything)

Pros: maximum OS fidelity.  
Cons: kills velocity; contradicts Bun desktop orchestration.  
Verdict: **rejected** as default.

### B - Page-side Node integration / Electron-like require

Pros: familiar to some web devs.  
Cons: destroys least privilege; rejected by ADR 0002.  
Verdict: **rejected**.

### C - Zig as the primary plugin language

Pros: one systems language.  
Cons: poor fit for ordinary product plugins; Shell Zig is interop (ADR 0005).  
Verdict: **rejected** as default **authoring** language. **Accepted** as the
default first-party **systems implementation** language and T1.5 kernel behind
TS (D9 + [ADR 0008](0008-zig-systems-surface.md)), not as the app-facing API
language.

### D - Separate app-visible APIs per backend language

Pros: exposes native types directly.  
Cons: breaks portable apps.  
Verdict: **rejected**; backends stay behind `call` / layers.

## References

- [Capabilities and plugins](../capabilities-and-plugins.md)
- [Architecture](../architecture.md)
- [Cross-platform abstraction](../cross-platform-abstraction.md)
- [ADR 0002](0002-ipc-privilege.md) - IPC / privilege
- [ADR 0005](0005-zig-interop-layer.md) - Zig interop
- [ADR 0007](0007-typescript-full-stack-host.md) - full-stack TS + pluggable Host
- [ADR 0008](0008-zig-systems-surface.md) - Zig unified systems surface (anti-scatter)
- [Tauri comparison](../research/tauri-comparison.md) - command/plugin mindset
- ADR 0003 (planned) - plugin ABI and signing
