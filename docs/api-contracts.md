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
| `hit/policy.ts` | `HitPolicy`, `WindowInputMode`, `HitTarget`, web-shape payloads |
| `hit/resolve-hit.ts` | pure `resolveHit`, opaque region store, generation helpers |
| `protocol/rpc.ts` | `VelaRpcRequest` / `Response`, error codes, `rpcOk` / `rpcErr` |
| `layer/types.ts` | `Layer*` variants, `InsertLayerSpec`, `LayerPatch`, defaults |
| `material/spec.ts` | `MaterialId`, `BackdropSource`, `resolveMaterial`, … |
| `capability/types.ts` | Permissions, grants, checks, risk |
| `capability/define.ts` | `defineCapability`, registry, builtins |
| `component/define.ts` | `defineNativeComponent`, factories, external modules |
| `window/types.ts` | `VelaWindow`, `VelaApp`, create options |
| `protocol/bridge.ts` | `VelaPreloadBridge`, `window.vela` typing |

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

See [Materials](materials.md).

Pure policy: `resolveMaterial(requested, platform, options?)`.

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
  defineNativeComponent,
  defineCapability,
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
| Plugin ABI + signing | Planned ADR 0003 | [tauri-comparison](research/tauri-comparison.md) |
| Event catalog (`material.degraded`, …) | Planned | design gaps G-P1-3 |
| `HitPolicy.callback` payloads | Planned | design gaps G-P1-1 |

Full register: [design gaps](design-gaps.md).
