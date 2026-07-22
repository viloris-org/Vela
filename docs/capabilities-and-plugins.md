# Capabilities and plugins

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: App authors | Host implementers  
> **SoT**: `packages/api/src/capability/*`, `component/define.ts`, `protocol/bridge.ts`; [ADR 0006](adr/0006-ts-first-capabilities.md); [ADR 0007](adr/0007-typescript-full-stack-host.md); [ADR 0008](adr/0008-zig-systems-surface.md); ADR 0001 § D5–D7

Vela separates **Capabilities** (non-UI system APIs) from **Native Components** (UI-bearing surfaces that create Layers). Both are permission-gated; default is **deny**.

**Product goal:** TypeScript velocity on **both** the App (frontend) and the privileged Host (backend plugins). Apps always call through `window.vela`. Capability plugins are authored in **Host TypeScript** by default. First-party **portable OS-touching** and hot-path kernels default to a **unified Zig systems surface** so implementations do not scatter across Swift/Kotlin/C++ imports ([ADR 0008](adr/0008-zig-systems-surface.md)). Toolkit UI, materials paint, and vendor SDKs stay on L4 / adapters — not the common author path. See [ADR 0006](adr/0006-ts-first-capabilities.md), [ADR 0007](adr/0007-typescript-full-stack-host.md), and [ADR 0008](adr/0008-zig-systems-surface.md).

Types:

- `packages/api/src/capability/types.ts`, `define.ts`
- `packages/api/src/component/define.ts`
- Preload: `packages/api/src/protocol/bridge.ts`

Decisions: [ADR 0006](adr/0006-ts-first-capabilities.md), [ADR 0007](adr/0007-typescript-full-stack-host.md), [ADR 0008](adr/0008-zig-systems-surface.md), [ADR 0001 § D5 - D7](adr/0001-composition-hit-material.md).

Security vocabulary is intentionally close to **Tauri 2** (permissions, scopes, capability grants bound to windows/profiles, runtime enforcement). Vela is not Tauri; see [Tauri comparison](research/tauri-comparison.md) for the map and divergences (layer-insert gates, signed native UI plugins).

## TypeScript-first full stack

Most product work should feel like ordinary async TypeScript on **two** sides of the trust boundary. Do not conflate them.

| Role | Language | Runs where | How it reaches the OS |
|------|----------|------------|------------------------|
| **App TS** (UI) | TS / web | System WebView (least privilege) | Only `window.vela` (message pass) |
| **Host TS** (capability plugins) | **TS by default** | Privileged host runtime (desktop **reference**: Bun) | HostAPI → Zig systems surface / Shell after `require` |
| Optional client wrappers | TS | WebView | Thin `call` helpers only — no second privilege path |
| Systems kernels (portable OS / hot path) | **Zig** (default first-party) | Host-loaded native / shared `vela-sys` | [ADR 0008](adr/0008-zig-systems-surface.md) |
| Native UI factories | Swift / Win / … | Shell L4 (when needed) | Toolkit views (`kind: "native"`) |
| Desktop transport | Zig | Shell control plane ([ADR 0005](adr/0005-zig-interop-layer.md)) | Not a capability dumping ground |

### App TS versus Host TS

| | App TS | Host TS |
|--|--------|---------|
| Trust | Least | Medium–high |
| Public surface | `window.vela` | Host registration / `handle` (design target) |
| Bun / FFI / Zig imports | **Forbidden** | Allowed only on the host side of the bridge |
| Portable without a device-side Bun binary | **Yes** (bridge on every OS, including iOS) | **Source-portable** when a host backend exists; interim native handlers may share the same method names |

**“Call system APIs from TypeScript on iOS”** means App TS → `window.vela` → host/Shell → UIKit/… . It does **not** require embedding Bun (or a full JIT V8) in the WebView or in the IPA for the App path. See [ADR 0007 D3](adr/0007-typescript-full-stack-host.md).

### Indirect system access (every platform)

```text
App TS (WKWebView / WebView2 / …)
  await window.vela.call("clipboard.write", { text })
  await window.vela.layers.insert({ kind: "material", /* … */ })
        │ async message pass
        ▼
Privileged host + Shell
  capability check → allow or structured deny
        │
        ▼
OS / toolkit APIs
```

Rules:

1. Page JS never holds raw OS handles or toolkit types.
2. Method names and permission ids are shared across desktop and mobile.
3. Until Host TS runs on a mobile backend, native code may implement the **same** `call` / insert paths so App TS keeps working (parity bridge, not the long-term authoring default).

### Pluggable privileged host runtime

| Concern | Decision |
|---------|----------|
| Authoring default for non-UI capabilities | Host TypeScript (ADR 0006) |
| Desktop reference runtime | Bun |
| Mobile / alternate backends | Pluggable (e.g. system JavaScriptCore context, embeddable engine) behind a stable Host plugin ABI |
| Portable unit | Host **plugin source** + `@vela/api` — not one engine binary in every store package |
| Host sandbox | Whitelist HostAPI only; no DOM, no ambient Node, no page objects ([ADR 0007 D5](adr/0007-typescript-full-stack-host.md)) |
| Composition (hit, materials, window) | Stays **Shell native** — Host TS requests, does not reimplement |

Bun remains the **repo toolchain** (`bun test`, install, web bundles) even when a given shipped app package does not embed the Bun runtime.

### Implementation tiers

| Tier | Use when | Example |
|------|----------|---------|
| **T0 Host TS** | Pure logic or host APIs without a meaningful OS kernel | Orchestration-only helpers |
| **T1 Host TS + systems** | Needs OS touchpoints without a custom view | Clipboard, notify, sandboxed fs — **TS facade + prefer Zig systems surface** for first-party portable impl |
| **T1.5 Perf / systems module** | Hot path **or** first-party portable OS kernel that must not scatter languages; **no** toolkit view | Transcode, parse, crypto, shared `vela-sys` domains — **Zig kernel** + TS facade |
| **T2 Native UI bridge** | Toolkit view, camera, materials, vendor UI SDK | `camera.preview` layer, Liquid Glass paint |

**Prefer Host TS for authoring.** Prefer **Zig systems surface** for first-party
portable OS implementations so authors do not hop Swift/Kotlin/C++ imports
([ADR 0008](adr/0008-zig-systems-surface.md)). Use pure T0 when no OS kernel is
needed. Use **T2** when you need a real Layer / toolkit surface.

See [ADR 0006 D9](adr/0006-ts-first-capabilities.md#d9---zig-performance-and-systems-modules-behind-ts) and [ADR 0008](adr/0008-zig-systems-surface.md).

### What app code always looks like

```ts
// Page JS — same shape whether the handler is TS or native-backed
await window.vela.call("clipboard.write", { text: "hello" });
await window.vela.layers.insert({
  kind: "material",
  material: "apple.liquidGlass",
  bounds: { x: 16, y: 12, width: 480, height: 52 },
  zIndex: 30,
  hitPolicy: { mode: "opaque" },
});
```

Page code never imports Bun, Zig, Swift, or FFI. Optional packages such as a
typed `clipboard.writeText()` helper must wrap `window.vela.call` only.

### Capability plugin layout (intent)

```text
plugins/clipboard/
  package.json
  src/
    permissions.ts   # defineCapability catalog entries
    host.ts          # privileged Host: register call handlers (desktop ref: Bun)
    client.ts        # optional app-side typed wrappers
  native/            # optional/default Zig (or thin wrap of vela-sys)
  README.md
```

Host registration is privileged. Treat TS handlers as trusted host code: still
`require` permissions, validate args, honor scopes. Typical plugin authors write
**TS only** and call an injected systems facade; they do not import Swift/Kotlin/C
per OS ([ADR 0008](adr/0008-zig-systems-surface.md) D5).

### Reaching other languages

| Path | Mechanism | Who chooses it |
|------|-----------|----------------|
| App → host | `window.vela` message pass | App author (only public path) |
| TS capability → **Zig systems / perf module** | Host loads narrow C ABI / addon (T1.5, ADR 0008) | Framework default for first-party portable OS; plugin author for hot paths |
| TS capability → Shell jobs | Bun RPC → Zig interop → L4 C ABI | Host / plugin when feature needs layers |
| TS capability → signed native UI module | Host loader + caps (ADR 0003) | Plugin author for T2 |
| Zig interop → Swift/C++ | C ABI inside Shell process | Shell engineers |
| Vendor / exclusive SDK | Adapter inside plugin package | Platform engineer — **not** common author import path |

App authors do not pick the backend language per call. The host registration
binds method names to TS handlers and/or native factories.

### High-performance and systems capabilities (T1.5)

For native speed **or** consolidated first-party OS kernels **without** a native view:

```text
App TS  --vela.call-->  Host TS (caps + validate)  --narrow ABI-->  Zig systems surface / kernel
```

| Do | Don't |
|----|--------|
| Keep the **same** `vela.call` method name as a pure-TS version | Import Zig/Swift/Kotlin from page JS |
| Put permission checks in the Host TS handler first | Bypass caps because the kernel is native |
| Prefer handles / job ids over huge JSON payloads | Force multi-MB blobs through control-plane JSON |
| Ship Zig (preferred) or other native kernels with a versioned C ABI | Merge unrelated capability code into `zig-shell` by default |
| Default first-party portable OS touchpoints onto the unified systems surface | Force every trivial orchestration plugin to ship native |
| Accept a thicker unified surface to avoid multi-language author imports | Optimize for thinnest glue if it scatters languages |

**Three different Zig hats:**

| Role | Where | Purpose |
|------|-------|---------|
| Shell interop | `hosts/zig-shell` | Window/WebView/layers transport ([ADR 0005](adr/0005-zig-interop-layer.md)) |
| Shared systems surface | `libs/vela-sys` (name TBD) | Unified portable OS/hot-path APIs ([ADR 0008](adr/0008-zig-systems-surface.md)) |
| Plugin kernel | `plugins/*/native` | Feature-specific T1.5 / thin wrap of systems surface |

Example layout:

```text
plugins/media-transcode/
  src/
    permissions.ts
    host.ts          # Host: require cap, call Zig ABI
    client.ts        # optional typed wrappers
  native/
    src/root.zig     # kernel
    build.zig
  README.md
```

```ts
// host.ts (privileged)
host.handle("media.transcode", async (args, ctx) => {
  ctx.require("media:transcode");
  return native.transcode(validate(args)); // narrow ABI into Zig
});

// app page
await window.vela.call("media.transcode", { jobId: "…" });
```

### Platform-exclusive capabilities

Exclusive materials, permission UX, or vendor SDKs **do not** get a fake portable
pixel/API twin. They **do** keep the same `vela.call` / layer / permission entry,
structured `unsupported` or degrade diagnostics, and live inside the same plugin
packaging story — not a second import dialect for app authors. See [ADR 0008 D7](adr/0008-zig-systems-surface.md).
## Capability model

| Concept | Role | Tauri peer (approx.) |
|---------|------|----------------------|
| `PermissionId` | String id (`fs:app-read`, plugin-defined, …) | Permission identifier |
| `CapabilityDefinition` | Catalog entry: description, risk, platforms | Permission definition / plugin permission file |
| `CapabilityGrant` | Manifest grant: permissions + optional scopes | Capability permissions + scopes |
| `AppManifestCapabilities` | Map of **profile** name → grant | Capability files bound to windows/webviews |
| Check request/result | Runtime allow/deny with reason | Runtime Authority at invoke time |

### Built-in permission ids

From `BuiltinPermissions`:

| Id | Risk (catalog) | Purpose |
|----|----------------|---------|
| `fs:app-read` | medium | Read under app data sandbox |
| `fs:app-write` | medium | Write under app data sandbox |
| `clipboard:read` | medium | Read clipboard |
| `clipboard:write` | low | Write clipboard |
| `notify:show` | low | User notifications |
| `dialog:open` | medium | Open file/folder pickers |
| `dialog:save` | medium | Save dialogs |
| `window:material` | low | Insert system material layers |
| `camera:preview` | high | Camera preview native layer |
| `camera:capture` | high | Capture frames / photos |
| `native:load-unsigned` | critical | Load unsigned native modules |
| `shell:open-external` | medium | Open external URLs / handlers |

Plugins may register more via `defineCapability`.

### Scopes

Optional resource scoping:

```ts
{ type: "path", pattern: "app-data/**" }
{ type: "url", pattern: "https://api.example.com/*" }
```

### Manifest profiles

Windows and WebViews select a **preload profile** that maps to a grant:

```ts
// CreateAppOptions / CreateWindowOptions sketch
{
  name: "MyApp",
  capabilities: {
    default: {
      permissions: ["clipboard:write", "notify:show", "window:material"],
    },
    camera: {
      permissions: ["camera:preview", "camera:capture"],
    },
  },
}
```

Runtime: host validates every `vela.call(method, args)` and every sensitive layer insert against the active profile.

## Preload bridge (web → host)

Safe surface only - **no Node, no FFI, no arbitrary require**. Traffic is **asynchronous message passing** (same safety property as Tauri Commands/Events: the host may discard malicious requests). Do not model this as FFI.

| Bridge API | Role | Tauri analogue |
|------------|------|----------------|
| `call(method, args)` | Request/response capability RPC | Commands / `invoke` |
| `events.subscribe` | Fire-and-forget / push channels | Events |
| `layers.*` | Composition control | *(Vela-specific)* |
| `hit.*` | Web-shaped hit regions | *(Vela-specific)* |

```ts
interface VelaPreloadBridge {
  version: string;
  call(method: string, args?: unknown): Promise<unknown>;
  layers: { insert; update; remove };
  hit: { setOpaqueRegions; setMainOpaqueRegions };
  events: { subscribe(channel, handler): unsubscribe };
}

// injected as window.vela
```

`call` args and results must be structured-clone / JSON-serializable. Sensitive **layer inserts** re-check permissions even if the page already obtained a handle via other means.

## Native components (T2)

UI-bearing system features register as **Native Components** and create
`kind: "native"` layers. This is the **T2 native bridge** path — use it when a
feature needs a real toolkit surface. Ordinary capabilities stay on T0/T1 TS
handlers and do **not** create layers.

```ts
defineNativeComponent({
  name: "camera.preview",
  permissions: ["camera:preview"],
  platforms: ["macos", "ios", "android"],
  propsSchema: /* optional parse */,
  defaultHitPolicy: { mode: "opaque" },
  create(host, props) { /* → NativeSurfaceHandle */ },
  setBounds(surface, bounds) { /* … */ },
  update?(surface, props) { /* … */ },
  setHitRegion?(surface, region) { /* … */ },
  invoke?(surface, method, args) { /* … */ },
  destroy(surface) { /* … */ },
});
```

Rules:

- Web code mounts by **name** only; it never calls `defineNativeComponent`.
- Shell / plugins register factories at host startup.
- Creating a sensitive layer requires matching permissions.
- Apps may ship **signed** external modules (`ExternalNativeModule`): library
path, factory symbol, permissions, `requiresSignature: true`.
- The Host must **never** `dlopen` arbitrary code from page JS.

## Plugin boundary (planned)

| Plugin type | Default language | Surface | Tauri-shaped guidance |
|-------------|------------------|---------|------------------------|
| **Capability plugin** | **Host TypeScript** (desktop ref: Bun) | `vela.call` + permission ids | Command plugin + permissions |
| **Perf capability plugin** | **Zig kernel + TS facade** | Same `vela.call`; Host loads native lib after caps | Sidecar/native command acceleration |
| Native UI plugin | Platform native + optional TS wrapper | `defineNativeComponent` + signed module | Mobile native plugins; Shell loads |
| Material backend | Platform native (Shell L4) | Paint for `MaterialId`s | No Tauri peer |
| Shell interop | Zig (desktop) | Transport / C ABI to L4 only | Not an app-facing plugin |

When packaging plugins (Phase 3–5), prefer:

- **TS-first** capability handlers for non-UI system APIs ([ADR 0006](adr/0006-ts-first-capabilities.md))
- Explicit permission ids (`plugin:command` style)
- A documented **default** set plus tighter subsets
- Platform arrays on definitions (desktop vs mobile)
- No ambient global APIs on the page - only bridge methods
- Native binaries only for **T2** features, with signing policy (ADR 0003)

Follow-up ADRs:

- IPC / typed RPC — [ADR 0002](adr/0002-ipc-privilege.md) (Proposed)
- Plugin ABI and signing — **0003** (planned)
- Zig interop — [ADR 0005](adr/0005-zig-interop-layer.md) (Accepted)
- TS-first capabilities — [ADR 0006](adr/0006-ts-first-capabilities.md) (Accepted)
- TypeScript-first full stack / pluggable Host — [ADR 0007](adr/0007-typescript-full-stack-host.md) (Accepted)

## Security defaults

1. Deny all capabilities unless manifest-granted.
2. Deny unsigned native load unless `native:load-unsigned` (and product policy).
3. Prefer custom URL schemes in production; no open localhost by default.
4. Enforce on **both** privileged Host and Shell (defense in depth).
5. Keep secrets and high-value logic out of WebView content.
6. Treat third-party frontend deps as part of the attack surface (optional
isolation interceptor is future work under ADR 0002).
7. **Host TS handlers are privileged** — not “safe because TypeScript”; still
require permissions, validate args, honor scopes.
8. Host runtime sandbox: no page DOM, no ambient full Node, no raw `dlopen` from
plugin code without policy ([ADR 0007 D5](adr/0007-typescript-full-stack-host.md)).

## Acceptance checklist

- [ ] Missing permission → structured deny, no silent success
- [ ] Camera layer insert without grant fails
- [ ] `window:material` required for material layers
- [ ] Preload cannot access Node/`fs`/`child_process`
- [ ] Unsigned module load blocked by default
- [ ] `call` with serializable args only; host rejects non-serializable abuse
- [ ] Profile A cannot use permissions granted only to profile B on another WebView
- [ ] First-party non-UI plugins (clipboard/dialog/notify/fs subset) implementable in TS without L4 code
- [ ] T2 native feature still uses the same `call` / layer names from app TS
- [ ] T1.5 perf plugin: page still only `vela.call`; Bun enforces caps before Zig ABI
- [ ] Perf Zig modules are not required for ordinary T0 plugins

## Related

- [ADR 0006: TypeScript-first capabilities](adr/0006-ts-first-capabilities.md)
- [ADR 0007: TypeScript-first full stack and pluggable Host](adr/0007-typescript-full-stack-host.md)
- [Architecture](architecture.md)
- [Cross-platform abstraction](cross-platform-abstraction.md)
- [Platform support](platform-support.md)
- [API contracts](api-contracts.md)
- [ADR 0002](adr/0002-ipc-privilege.md)
- [ADR 0005](adr/0005-zig-interop-layer.md)
- [Tauri comparison](research/tauri-comparison.md)
- [Roadmap](roadmap.md)
