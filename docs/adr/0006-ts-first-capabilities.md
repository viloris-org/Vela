# ADR 0006: TypeScript-first capabilities with optional native bridges

> **Type**: Decision  
> **Status**: Accepted decision (doc current)  
> **Audience**: App authors | Plugin authors | Host implementers | Maintainers  
> **SoT**: Binding authoring model for capabilities/plugins; types in `@vela/api`

- **Status**: Accepted
- **Date**: 2026-07-22
- **Amended**: 2026-07-22 (D9 performance modules)
- **Deciders**: Project maintainers

## Context

Vela apps are WebView-first and author UI in TypeScript/web stacks. Desktop
orchestration is Bun. Many product features need **system capabilities**
(filesystem sandbox, clipboard, dialogs, notifications, HTTP helpers, app
state) that should feel like ordinary async TypeScript — not require Swift,
Kotlin, or C++ for every feature.

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
(desktop: Bun host; mobile: native host may embed a smaller TS/JS capability
runtime later, or ship first-party ports — mobile packaging is a separate
host concern).

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
| **T1.5 Perf module** | CPU/GPU-adjacent hot path; TS too slow or GC-hostile | **Zig (preferred) or other native lib** loaded by **Bun host**; narrow ABI | `vela.call` / events (same as T0) |
| **T2 Native UI / toolkit bridge** | Toolkit view, camera, materials, vendor UI SDK | Shell L4 and/or signed native UI module; Zig Shell interop dispatches | `vela.call` and/or `layers.insert` (`kind: "native"` / `material`) |

**Default path is T0/T1.** Choose **T1.5** when measurement shows a hot path needs
native speed but **no** toolkit Layer. Choose **T2** when the feature needs a
real native view or material surface.

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
| **Perf capability plugin** | **Zig kernel + TS facade** (T1.5) | Same `call` handlers; Bun loads native lib | No |
| **Native UI plugin** | Platform native (+ optional TS wrapper) | `defineNativeComponent` + signed module | Yes (`kind: "native"`) |
| **Material backend** | Platform native (Shell L4) | Host material paint for `MaterialId` | Yes (`kind: "material"`) |
| **Shell interop** | Zig (desktop, ADR 0005) | Transport / C ABI to L4 only | No |

A single product feature may ship **TS capability surface + optional native
backend** behind the same permission ids and method names.

### D5 - How TS reaches other languages (allowed bridges)

Privilege stays on the host side of the bridge. Page JS never picks the
backend language.

| From | To | Mechanism | Allowed for |
|------|----|-----------|-------------|
| Page TS | Host | `window.vela` message pass | All app code |
| Bun TS capability | OS / pure logic | Bun APIs, child processes with policy, pure TS | T0/T1 |
| Bun TS capability | **Perf Zig module** | Privileged Bun load of narrow C ABI / addon ([D9](#d9---zig-performance-modules-behind-ts)) | T1.5 hot paths |
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


### D9 - Zig performance modules behind TS (high-performance apps)

**Yes — for measured hot paths, implement the kernel in Zig (or another native
language), abstract a narrow interface, expose it to the Bun host, and keep
application calls in TypeScript.**

This is **T1.5**, distinct from ADR 0005 Shell interop:

| Zig role | Binary / package | Job |
|----------|------------------|-----|
| **Shell interop** (ADR 0005) | `hosts/zig-shell` | RPC, dispatch, C ABI to L4 window/WebView/layers |
| **Perf module** (this D9) | Plugin or `packages/*-native` / `plugins/*/zig` | CPU-heavy or GC-hostile work for a capability |

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

1. **Measure first** — do not rewrite ordinary T0/T1 plugins into Zig by default.
2. **TS owns the public method** — permission checks, arg validation, and
   policy stay in the Bun TS handler before any native call.
3. **Narrow ABI** — versioned C functions or a tiny command enum; no leaking
   Zig types into `@vela/api` or page bundles.
4. **Page never loads the module** — only the privileged Bun host (or Shell for
   UI-adjacent work) links/loads it.
5. **Data plane** — control stays on RPC envelopes; large binary may use
   `ArrayBuffer` / host-managed buffers / later shared memory. Do not force
   multi-megabyte blobs through JSON if the path is hot.
6. **Same method names** if a feature starts in pure TS and later gains a Zig
   kernel — apps should not need a new API for the optimization.
7. **Other languages allowed** — Rust/C/C++ perf kernels are fine when they
   expose the same narrow ABI; Zig is the **preferred** first-party native
   systems language for new Vela-owned kernels, not a monopoly for third-party
   SDKs.

#### When T1.5 vs T2

| Need | Tier |
|------|------|
| Fast encode/parse/simulate/crypto **without** a native view | **T1.5** Zig (or similar) behind Bun TS |
| Camera preview, map underlay, system material chrome | **T2** Shell L4 / native UI plugin |
| Both (e.g. process frames + show preview) | TS facade + Zig kernel **and** native layer; still one app-facing API family |

#### Non-goals for D9

- Replacing WebView UI with Zig UI
- Requiring every plugin to ship a Zig binary
- Bun in-process FFI into the **full Shell** process (still ADR 0002 / 0005:
  Shell control plane is RPC; perf modules for Bun-side work are host-local)

## Consequences

### Positive

- Fast iteration: most plugins stay in TypeScript next to Bun tooling.
- App authors keep one mental model (`vela.call` / layers / events).
- Native and other languages remain available when required.
- High-performance apps can drop Zig kernels under the same TS surface (D9).
- Aligns with WebView-first product and least-privilege bridge.

### Negative / costs

- Host must provide a clear plugin registration API for TS handlers (Phase 2–3).
- Risk of putting too much privilege in Bun without good sandbox/scopes.
- Mobile may lag desktop TS plugin parity until host capability runtime exists.
- T1.5 adds native build matrix and ABI versioning discipline.

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
Verdict: **rejected** as default authoring language. **Accepted** as optional
**T1.5 perf kernel** behind TS (D9), not as the app-facing API language.

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
- [Tauri comparison](../research/tauri-comparison.md) - command/plugin mindset
- ADR 0003 (planned) - plugin ABI and signing
