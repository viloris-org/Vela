---
name: vela-app-ts
description: >
  Author Vela App TypeScript against window.vela (call, layers, hit, events)
  with default-deny capabilities and in-page mock fallback. Use when writing or
  editing Vela app UI, integrating layers or materials from page JS, calling
  notify/tray/dialog, fixing bridge usage, or the user mentions window.vela or
  App TS. Not for implementing hosts, Shell, or framework packages.
---

# Vela App TypeScript

App code runs in the **system WebView** as least-privilege page JS. The only
public privileged surface is **`window.vela`** (`VelaPreloadBridge` from
`@vela/api`). Do not import Bun, Node, FFI, or OS APIs from App TS.

## Trust boundary

| Allowed in App TS | Forbidden in App TS |
|-------------------|---------------------|
| DOM, CSS, any web UI stack | `bun:`, Node builtins, native addons |
| `import type` / types from `@vela/api` | Direct filesystem, tray, notify, dialog OS calls |
| `window.vela.call` / `layers` / `hit` / `events` | Second IPC channel that bypasses the bridge |
| In-page **mock** when preload is missing (dev) | Treating mock success as a shipped host guarantee |

```text
App TS  →  window.vela.*  →  (message)  →  Host + Shell  →  OS
```

## Bootstrap pattern

Prefer host preload when present; install a mock only for content-only dogfood:

```ts
import type { VelaPreloadBridge } from "@vela/api";
import { installMockVela } from "./mock-vela.ts";

function getBridge(): VelaPreloadBridge {
  if (window.vela) return window.vela;
  return installMockVela();
}

const vela = getBridge();
```

Keep the mock aligned with `VelaPreloadBridge` in
`packages/api/src/protocol/bridge.ts` (or the installed `@vela/api` version).
Template and clock samples ship a mock under `src/mock-vela.ts`.

## Bridge surface (contract)

```ts
vela.version; // string; mocks often end with "-mock"

await vela.call(method: string, args?: unknown): Promise<unknown>;

await vela.layers.insert(spec);  // → { id }
await vela.layers.update(id, patch);
await vela.layers.remove(id);

vela.hit.setOpaqueRegions({ layerId, opaqueRegions, generation? });
vela.hit.setMainOpaqueRegions(region); // convenience; avoid double-applying with setOpaqueRegions

const unsub = vela.events.subscribe(channel, handler);
unsub();
```

**SoT for field shapes**: `@vela/api` (`InsertLayerSpec`, `LayerPatch`,
`Region`, `WebShapeUpdate`). Do not invent layer kinds or method strings.

## Layers and materials

- Kinds: `webview` | `native` | `material` | `chrome` | `passthrough`
- Coordinates: logical content space, origin **top-left**, **y down**
- Material insert example pattern (glass under WebView UI): see
  `example/clock/src/main.ts` — material `zIndex` below main webview, web owns
  hits via web-shaped regions, material often `hitPolicy: { mode: "transparent" }`

```ts
await vela.layers.insert({
  id: "card-glass",
  kind: "material",
  material: "apple.liquidGlass",
  bounds: { x, y, width, height },
  zIndex: 8,
  shape: { type: "roundedRect", radius: 28 },
  samples: { type: "layers-below" },
  variant: "regular",
  interactive: false,
  hitPolicy: { mode: "transparent" },
});
```

On mock or incomplete hosts, `insert` may only log or throw. Catch, degrade UI
honestly, do not assume real system glass painted.

## Hit testing (web-shaped)

When the WebView is not a full-window opaque slab, push **opaque regions** for
interactive chrome (cards, bars). Prefer **one** path:

- Use `setOpaqueRegions` with `layerId` + monotonic `generation`, **or**
- Use `setMainOpaqueRegions` alone

Do not call both for the same update (double-apply confuses generation).

Re-push after layout changes (resize, font toggle, DOM size changes). Clock
uses double `requestAnimationFrame` before reading boxes.

## Capabilities (`vela.call`)

Default is **deny**. Method names and permissions are shared contracts; page JS
never holds raw OS handles.

First-party methods (when the host registers the plugin and the app is granted
permission):

| Method | Permission (concept) | Notes |
|--------|----------------------|--------|
| `notify.show` / `notify.close` | `notify:show` | Optional thin client: `@vela/plugin-notify/client` |
| `tray.create` / update / remove | `tray:manage` | Host + sys tray backend |
| `dialog.open` / `dialog.save` | dialog permissions | Picker only; does not write files |

```ts
try {
  await vela.call("notify.show", { title: "Hi", body: "Ready" });
} catch (err) {
  // deny, mock stub, or missing host — show in-app fallback
}
```

In-page mocks often **always throw** on `call`. That is expected without a real
Host. Do not invent methods like `fs.write` unless they exist in `@vela/api`
and a granted permission.

Optional packaging: `vela.manifest.json` (`AppManifest`) lists grants. It does
not replace `vela.json`. Align ids with docs when both exist.

## UI stack

Any web stack is fine (vanilla, React, Vue, Svelte, …) as long as:

1. Entry stays a normal web bundle loaded by the package `serve` / static entry
2. Privileged work goes through `window.vela`
3. `serve.ts` (or equivalent) emits browser JS; WebViews do not run raw TS

## Verification

```bash
cd <app-root>
bun run typecheck    # if package defines it
bun run serve        # mock path in a normal browser
```

With Vela CLI + Shell (when available on the machine):

```bash
bun run vela -- dev --dir <app-root>
```

Check console / UI for mock vs host preload (`version` suffix `-mock`).

## Common mistakes

| Mistake | Fix |
|---------|-----|
| App imports Host or `sys-desktop` | Keep those on Host only; App uses `call` |
| Hardcode Electron `ipcRenderer` / Tauri `invoke` | Use `window.vela` only |
| Skip `vela.json` and only use `package.json` | Package root marker is `vela.json` |
| Treat mock `layers.insert` as real glass | Feature-detect / try-catch; degrade |
| New capability method from imagination | Read `@vela/api` capability modules + plugin READMEs |

## Reference samples (in Vela checkout)

| Path | What to copy ideas from |
|------|-------------------------|
| `templates/minimal` | Smallest bridge + mock |
| `example/clock` | Clock UI, material layer, web-shaped hit, layout sync |
| `apps/playground` | Broader dogfood content |

## Related

Paths are under the Vela repository (https://github.com/viloris-org/Vela):

- `docs/api-contracts.md` — `@vela/api` map
- `docs/composition-and-layers.md` — layer tree
- `docs/input-and-hit-testing.md` — hit / web-shaped
- `docs/capabilities-and-plugins.md` — permissions
- Skill sibling: `create-vela-app` (install both: `npx skills add -g -y viloris-org/Vela`)
