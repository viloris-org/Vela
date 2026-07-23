# API contracts (`@vela/api`)

> **Type**: Reference  
> **Status**: Current  
> **Audience**: App authors | Host implementers  
> **SoT**: `packages/api/` (`@vela/api`)

`@vela/api` is the **shared TypeScript contract package**. It is usable today: types + pure helpers, no host implementation.

Package: `packages/api/` Entry: `packages/api/src/index.ts`

## Package rules

- Zero required runtime dependencies (schemas are structural; hosts may plug Zod/Valibot).
- Implementations live in planned `hosts/` and `plugins/`.
- Cross-host stability: desktop Bun and mobile native hosts speak the same types.

## Module map

| Path | Exports (summary) |
|------|-------------------|
| `geometry.ts` | `Point`, `Size`, `Rect`, `Shape`, `Region`, helpers |
| `coordinates.ts` | AppKit ↔ logical point/rect conversion (once at Shell boundary) |
| `hit/policy.ts` | `HitPolicy`, `WindowInputMode`, `HitTarget`, web-shape payloads |
| `hit/resolve-hit.ts` | pure `resolveHit`, opaque region store, generation helpers |
| `hit/web-shaped-defaults.ts` | `EMPTY_REGION`, default web-shaped policy helpers |
| `protocol/rpc.ts` | `VelaRpcRequest` / `Response`, error codes, `rpcOk` / `rpcErr` |
| `layer/types.ts` | `Layer*` variants, `InsertLayerSpec`, `LayerPatch`, defaults |
| `layer/snapshot.ts` | `LayerTreeSnapshot`, `toOpaqueRegionStore` |
| `material/spec.ts` | `MaterialId`, `BackdropSource`, `resolveMaterial`, … |
| `material/paint-plan.ts` | `planMaterialPaint`, `MaterialPaintPath` (runtime paint honesty) |
| `session/features.ts` | `ShellSessionProbe`, `ShellSessionFeature`, `DisplayBackend` |
| `capability/types.ts` | Permissions, grants, checks, risk |
| `capability/define.ts` | `defineCapability`, registry, builtins |
| `capability/check.ts` | pure `checkCapability` / `checkProfileCapability` (default deny) |
| `capability/match-scope.ts` | path/url scope patterns (`*`, `**`) |
| `capability/layer-gates.ts` | insert-layer permission requirements |
| `capability/host.ts` | `CapabilityHost`, `HostAPI`, `CallContext`, `CapabilityDeniedError` |
| `manifest/types.ts` | `AppManifest` + `parseAppManifest` (JSON schema v1) |
| `project/package.ts` | `VelaPackage` + `parseVelaPackage` / `VELA_PACKAGE_MARKER` (`vela.json`) |
| `project/workspace.ts` | `VelaWorkspace` + `parseVelaWorkspace` / monorepo scan parents |
| `component/define.ts` | `defineNativeComponent`, factories, external modules |
| `window/types.ts` | `VelaWindow`, `VelaApp`, create options |
| `protocol/bridge.ts` | `VelaPreloadBridge`, `window.vela` typing |

Related host-facing packages (not app SDK):

- **`@vela/shell-core`** — portable in-process Shell controller (layer tree, hit routing, dogfood bootstrap, preload bridge adapter).
- **`@vela/host-core`** — portable privileged Host call router (`handle` / `ctx.require` / `invokeRpc`).

App authors still only use `@vela/api` / `window.vela`. Host implementers use shell-core / host-core against the same contracts.

## Geometry

Logical window content coordinates: origin **top-left**, **y down**.

- `Shape`: axis-aligned `rect` | `roundedRect` | `capsule` | `circle`
- `Region`: union of primitives (no arbitrary paths in v1)

Helpers: `regionFromRect`, `regionFromRoundedRect`, `regionUnion`, `rectContains`.

## Layers

See [Composition and layers](composition-and-layers.md).

Core types: `Layer`, `InsertLayerSpec`, `LayerPatch`, `LayerKind`, `defaultHitPolicyForKind`.

## Hit / window input

See [Input and hit testing](input-and-hit-testing.md).

## Materials

See [Materials](materials.md) for semantic buckets (A desktop / B window-behind / C in-window glass / Liquid Glass approximation policy) and the resolve → session probe → paint-plan pipeline.

| Helper | Role |
|--------|------|
| `resolveMaterial(requested, platform, options?)` | Map author `MaterialId` → platform preferred id |
| `planMaterialPaint(..., { session, samples? })` | Runtime `MaterialPaintPath` + honest degrade |
| `ShellSessionProbe` / `ShellSessionFeature` | Portable session capabilities (no raw Wayland names on the app surface) |

## Capabilities & components

See [Capabilities and plugins](capabilities-and-plugins.md).

## Window and app facades

These are **host-facing interfaces** (contract only):

```ts
interface VelaApp {
  whenReady(): Promise<void>;
  createWindow(options?: CreateWindowOptions): Promise<VelaWindow>;
  quit(): void | Promise<void>;
}

interface VelaWindow {
  // state, title, bounds, inputMode, focus, close
  insertLayer / updateLayer / removeLayer / listLayers / reorderLayer
  mountChild? // native under material/native parent
}
```

## Preload bridge

```ts
window.vela?: VelaPreloadBridge
// call | layers | hit | events
```

## Import examples

```ts
import type {
  InsertLayerSpec,
  HitPolicy,
  WindowInputMode,
  VelaPreloadBridge,
} from "@vela/api";

import {
  regionFromRect,
  regionContains,
  resolveHit,
  createEmptyOpaqueRegionStore,
  applyWebShapeUpdate,
  resolveMaterial,
  defaultHitPolicyForKind,
  BuiltinPermissions,
  defineCapability,
  checkCapability,
  checkProfileCapability,
  permissionsForInsertLayer,
  parseAppManifest,
  CapabilityDeniedError,
  defineNativeComponent,
  rpcOk,
  rpcErr,
  VelaRpcErrorCodes,
} from "@vela/api";
```

## Verification

```bash
bun install
bun test # packages/api tests
bun run typecheck
```

## Related docs

- [Doc index](README.md)
- [Architecture](architecture.md)
- Domain guides linked above
- [Testing and acceptance](testing-and-acceptance.md)

## Planned contract expansions

| Item | Status | Doc |
|------|--------|-----|
| IPC / typed RPC envelopes + error codes | Types in `protocol/rpc.ts`; wire Phase 2 | [ADR 0002](adr/0002-ipc-privilege.md) |
| Pure `resolveHit` helper | Landed in `hit/resolve-hit.ts` + tests | [input-and-hit-testing](input-and-hit-testing.md), [design gaps](design-gaps.md) |
| Pure capability check + Host registration types | Landed (`checkCapability`, `CapabilityHost`, `parseAppManifest`); `@vela/host-core` dispatch | [capabilities-and-plugins](capabilities-and-plugins.md), G-P1-6/9/11 |
| Notify + tray + dialog capability contracts + Host TS plugins | Landed (`Notify*` / `Tray*` / `Dialog*` types; plugins + mock sys; `@vela/sys-desktop` notify/dialog facades) | [capabilities-and-plugins](capabilities-and-plugins.md) |
| Plugin ABI + signing | Planned ADR 0003 | [tauri-comparison](research/tauri-comparison.md) |
| Event catalog (`material.degraded`, …) | Planned | design gaps G-P1-3 |
| `HitPolicy.callback` payloads | Planned | design gaps G-P1-1 |

Full register: [design gaps](design-gaps.md).
