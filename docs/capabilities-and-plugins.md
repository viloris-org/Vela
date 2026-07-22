# Capabilities and plugins

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: App authors | Host implementers  
> **SoT**: `packages/api/src/capability/*`, `component/define.ts`, `protocol/bridge.ts`; [ADR 0006](adr/0006-ts-first-capabilities.md); ADR 0001 § D5–D7

Vela separates **Capabilities** (non-UI system APIs) from **Native Components** (UI-bearing surfaces that create Layers). Both are permission-gated; default is **deny**.

**Authoring default:** implement most capabilities in **TypeScript** on the privileged host (desktop: Bun). Apps always call through `window.vela`. Native and other languages are **optional bridges** for toolkit UI, materials, or foreign ABIs — not the default for clipboard-class features. See [ADR 0006](adr/0006-ts-first-capabilities.md).

Types:

- `packages/api/src/capability/types.ts`, `define.ts`
- `packages/api/src/component/define.ts`
- Preload: `packages/api/src/protocol/bridge.ts`

Decisions: [ADR 0006](adr/0006-ts-first-capabilities.md), [ADR 0001 § D5 - D7](adr/0001-composition-hit-material.md).

Security vocabulary is intentionally close to **Tauri 2** (permissions, scopes, capability grants bound to windows/profiles, runtime enforcement). Vela is not Tauri; see [Tauri comparison](research/tauri-comparison.md) for the map and divergences (layer-insert gates, signed native UI plugins).

## TypeScript-first authoring

Most product plugins should feel like ordinary async TypeScript.

| You write | Language | Runs where |
|-----------|----------|------------|
| App UI | TS / web | WebView (least privilege) |
| Capability handlers (`vela.call`) | **TS by default** | Bun host (desktop) |
| Optional client wrappers | TS | WebView (thin `call` helpers only) |
| Native UI factories | Swift / Win / … | Shell L4 (when needed) |
| Desktop transport | Zig | Shell control plane ([ADR 0005](adr/0005-zig-interop-layer.md)) |

### Implementation tiers

| Tier | Use when | Example |
|------|----------|---------|
| **T0 Host TS** | Pure logic or Bun/OS APIs without a Layer | Clipboard, notify, sandboxed fs |
| **T1 Host TS + controlled OS** | Needs dialogs/process policy still without custom views | File picker, open-external |
| **T1.5 Perf module** | Measured hot path; TS too slow or GC-hostile; **no** toolkit view | Transcode, parse, simulate, crypto — **Zig kernel** + TS facade |
| **T2 Native UI bridge** | Toolkit view, camera, materials, vendor UI SDK | `camera.preview` layer, Liquid Glass paint |

**Prefer T0/T1.** Use **T1.5** when profiling says you need native speed but not a
native view. Use **T2** when you need a real Layer / toolkit surface.

See [ADR 0006 D9](adr/0006-ts-first-capabilities.md#d9---zig-performance-modules-behind-ts).

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
    host.ts          # Bun: register call handlers
    client.ts        # optional app-side typed wrappers
  README.md
```

Host registration is privileged. Treat TS handlers as trusted host code: still
`require` permissions, validate args, honor scopes.

### Reaching other languages

| Path | Mechanism | Who chooses it |
|------|-----------|----------------|
| App → host | `window.vela` message pass | App author (only public path) |
| TS capability → **perf Zig module** | Bun loads narrow C ABI / addon (T1.5) | Plugin author after measurement |
| TS capability → Shell jobs | Bun RPC → Zig interop → L4 C ABI | Host / plugin when feature needs layers |
| TS capability → signed native UI module | Host loader + caps (ADR 0003) | Plugin author for T2 |
| Zig interop → Swift/C++ | C ABI inside Shell process | Shell engineers |

App authors do not pick the backend language per call. The host registration
binds method names to TS handlers and/or native factories.

### High-performance capabilities (T1.5)

For apps that need native speed **without** a native view:

```text
App TS  --vela.call-->  Bun TS (caps + validate)  --narrow ABI-->  Zig perf module
```

| Do | Don't |
|----|--------|
| Keep the **same** `vela.call` method name as a pure-TS version | Import Zig from page JS |
| Put permission checks in the Bun TS handler first | Bypass caps because the kernel is native |
| Prefer handles / job ids over huge JSON payloads | Force multi-MB blobs through control-plane JSON |
| Ship Zig (preferred) or other native kernels with a versioned C ABI | Merge unrelated perf code into `zig-shell` by default |
| Measure before rewriting ordinary plugins | Make every plugin ship a native binary |

**Two different Zig hats:**

| Role | Where | Purpose |
|------|-------|---------|
| Shell interop | `hosts/zig-shell` | Window/WebView/layers transport ([ADR 0005](adr/0005-zig-interop-layer.md)) |
| Perf module | plugin / package native code | Hot-path compute for a capability ([ADR 0006 D9](adr/0006-ts-first-capabilities.md#d9---zig-performance-modules-behind-ts)) |

Example layout:

```text
plugins/media-transcode/
  src/
    permissions.ts
    host.ts          # Bun: require cap, call Zig ABI
    client.ts        # optional typed wrappers
  zig/
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
- Bun must **never** `dlopen` arbitrary code from page JS.

## Plugin boundary (planned)

| Plugin type | Default language | Surface | Tauri-shaped guidance |
|-------------|------------------|---------|------------------------|
| **Capability plugin** | **TypeScript (Bun host)** | `vela.call` + permission ids | Command plugin + permissions |
| **Perf capability plugin** | **Zig kernel + TS facade** | Same `vela.call`; Bun loads native lib | Sidecar/native command acceleration |
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

## Security defaults

1. Deny all capabilities unless manifest-granted.
2. Deny unsigned native load unless `native:load-unsigned` (and product policy).
3. Prefer custom URL schemes in production; no open localhost by default.
4. Enforce on **both** Bun host and Shell (defense in depth).
5. Keep secrets and high-value logic out of WebView content.
6. Treat third-party frontend deps as part of the attack surface (optional
isolation interceptor is future work under ADR 0002).
7. **TS host handlers are privileged** — not “safe because TypeScript”; still
require permissions, validate args, honor scopes.

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
- [Architecture](architecture.md)
- [Cross-platform abstraction](cross-platform-abstraction.md)
- [API contracts](api-contracts.md)
- [ADR 0002](adr/0002-ipc-privilege.md)
- [ADR 0005](adr/0005-zig-interop-layer.md)
- [Tauri comparison](research/tauri-comparison.md)
- [Roadmap](roadmap.md)
