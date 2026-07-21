# Capabilities and plugins

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: App authors | Host implementers  
> **SoT**: `packages/api/src/capability/*`, `component/define.ts`, `protocol/bridge.ts`; ADR 0001 § D5–D7

Vela separates **Capabilities** (non-UI system APIs) from **Native Components** (UI-bearing surfaces that create Layers). Both are permission-gated; default is **deny**.

Types:

- `packages/api/src/capability/types.ts`, `define.ts`
- `packages/api/src/component/define.ts`
- Preload: `packages/api/src/protocol/bridge.ts`

Decisions: [ADR 0001 § D5 - D7](adr/0001-composition-hit-material.md).

Security vocabulary is intentionally close to **Tauri 2** (permissions, scopes, capability grants bound to windows/profiles, runtime enforcement). Vela is not Tauri; see [Tauri comparison](research/tauri-comparison.md) for the map and divergences (layer-insert gates, signed native UI plugins).

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

## Native components

UI-bearing system features register as **Native Components** and create `kind: "native"` layers.

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

| Plugin type | Surface | Tauri-shaped guidance |
|-------------|---------|------------------------|
| Capability plugin | Methods behind `vela.call`, permission ids | Ship catalog entries + default/narrow allow sets |
| Native UI plugin | `defineNativeComponent` + signed module | Like mobile native plugins; Shell loads, page never does |
| Material backend | Platform paint for `MaterialId`s | Composition-specific; no Tauri peer |

When packaging plugins (Phase 5+), prefer:

- Explicit permission ids (`plugin:command` style)
- A documented **default** set plus tighter subsets
- Platform arrays on definitions (desktop vs mobile)
- No ambient global APIs on the page - only bridge methods

Follow-up ADRs: IPC / typed RPC - **[ADR 0002](adr/0002-ipc-privilege.md)** (Proposed); plugin ABI and signing (**0003**, planned).

## Security defaults

1. Deny all capabilities unless manifest-granted.
2. Deny unsigned native load unless `native:load-unsigned` (and product policy).
3. Prefer custom URL schemes in production; no open localhost by default.
4. Enforce on **both** Bun host and Shell (defense in depth).
5. Keep secrets and high-value logic out of WebView content.
6. Treat third-party frontend deps as part of the attack surface (optional
isolation interceptor is future work under ADR 0002).

## Acceptance checklist

- [ ] Missing permission → structured deny, no silent success
- [ ] Camera layer insert without grant fails
- [ ] `window:material` required for material layers
- [ ] Preload cannot access Node/`fs`/`child_process`
- [ ] Unsigned module load blocked by default
- [ ] `call` with serializable args only; host rejects non-serializable abuse
- [ ] Profile A cannot use permissions granted only to profile B on another WebView
