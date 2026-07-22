import type { Point, Rect, Region } from "../geometry.ts";
import { rectContains, regionContains } from "../geometry.ts";
import type { Layer, LayerId } from "../layer/types.ts";
import type {
  HitPolicy,
  HitTarget,
  HitTargetKind,
  WebShapeUpdate,
  WindowInputMode,
} from "./policy.ts";

export type OpaqueRegionEntry = {
  readonly opaqueRegions: Region;
  readonly lastAcceptedGeneration?: number;
};

export type OpaqueRegionStore = ReadonlyMap<LayerId, OpaqueRegionEntry>;

export function createEmptyOpaqueRegionStore(): OpaqueRegionStore {
  return new Map();
}

export function isGenerationStale(
  lastAccepted: number | undefined,
  incoming: number | undefined,
): boolean {
  if (incoming === undefined || lastAccepted === undefined) {
    return false;
  }
  return incoming < lastAccepted;
}

export type ApplyWebShapeResult =
  | { readonly accepted: true; readonly store: OpaqueRegionStore }
  | {
      readonly accepted: false;
      readonly store: OpaqueRegionStore;
      readonly reason: "generation.stale";
    };

export function applyWebShapeUpdate(
  store: OpaqueRegionStore,
  update: WebShapeUpdate,
): ApplyWebShapeResult {
  const prev = store.get(update.layerId);
  if (isGenerationStale(prev?.lastAcceptedGeneration, update.generation)) {
    return { accepted: false, store, reason: "generation.stale" };
  }
  const next = new Map(store);
  const entry: OpaqueRegionEntry =
    update.generation === undefined
      ? { opaqueRegions: update.opaqueRegions }
      : {
          opaqueRegions: update.opaqueRegions,
          lastAcceptedGeneration: update.generation,
        };
  next.set(update.layerId, entry);
  return { accepted: true, store: next };
}

export type ResolveHitOptions = {
  readonly acceptCallback?: (layer: Layer, point: Point) => boolean;
};

function assertNever(value: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
}

function layerHitKind(layer: Layer): HitTargetKind {
  switch (layer.kind) {
    case "webview":
      return "webview";
    case "native":
      return "native";
    case "material":
      return "material";
    case "chrome":
      return "chrome";
    case "passthrough":
      return "native";
    default:
      return assertNever(layer);
  }
}

function effectiveBounds(layer: Layer): Rect {
  const tx = layer.transform?.translateX ?? 0;
  const ty = layer.transform?.translateY ?? 0;
  return {
    x: layer.bounds.x + tx,
    y: layer.bounds.y + ty,
    width: layer.bounds.width,
    height: layer.bounds.height,
  };
}

function toLocalPoint(layer: Layer, point: Point): Point {
  const bounds = effectiveBounds(layer);
  return { x: point.x - bounds.x, y: point.y - bounds.y };
}

function windowModeIsOsThrough(
  windowMode: WindowInputMode,
  point: Point,
): boolean {
  switch (windowMode.mode) {
    case "normal":
      return false;
    case "click-through":
      return true;
    case "region-through":
      return regionContains(windowMode.region, point);
    case "shaped":
      return !regionContains(windowMode.region, point);
    default:
      return assertNever(windowMode);
  }
}

function policyAccepts(
  policy: HitPolicy,
  layer: Layer,
  point: Point,
  store: OpaqueRegionStore,
  options: ResolveHitOptions | undefined,
): boolean {
  switch (policy.mode) {
    case "opaque":
      return true;
    case "transparent":
      return false;
    case "mask":
      return regionContains(policy.region, point);
    case "web-shaped": {
      const entry = store.get(layer.id);
      if (entry === undefined) {
        return false;
      }
      return regionContains(entry.opaqueRegions, point);
    }
    case "callback":
      return options?.acceptCallback?.(layer, point) ?? false;
    default:
      return assertNever(policy);
  }
}

export function resolveHit(
  windowMode: WindowInputMode,
  layers: readonly Layer[],
  opaqueRegionStore: OpaqueRegionStore,
  point: Point,
  options?: ResolveHitOptions,
): HitTarget {
  if (windowModeIsOsThrough(windowMode, point)) {
    return { kind: "os-desktop", localPoint: point };
  }

  const candidates = layers
    .filter((layer) => layer.visible)
    .filter((layer) => rectContains(effectiveBounds(layer), point))
    .slice()
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const layer of candidates) {
    if (layer.clip !== undefined && !regionContains(layer.clip, point)) {
      continue;
    }
    if (
      !policyAccepts(
        layer.hitPolicy,
        layer,
        point,
        opaqueRegionStore,
        options,
      )
    ) {
      continue;
    }
    return {
      kind: layerHitKind(layer),
      layerId: layer.id,
      localPoint: toLocalPoint(layer, point),
    };
  }

  return { kind: "window-background", localPoint: point };
}
