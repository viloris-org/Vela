import type { Point, Region } from "../geometry.ts";
import { regionContains } from "../geometry.ts";
import type { LayerId } from "../layer/types.ts";
import type { HitPolicy } from "./policy.ts";
import type { OpaqueRegionStore } from "./resolve-hit.ts";

/**
 * New webview layers use a web-shaped policy. Until a page reports its opaque
 * regions, the store has no entry or this empty region, so hit testing falls
 * through to accepting layers below (G-P0-5 dogfood default).
 */
export const EMPTY_REGION: Region = { primitives: [] };

export function defaultWebViewHitPolicy(): HitPolicy {
  return { mode: "web-shaped" };
}

export function isWebShapedAccepting(
  store: OpaqueRegionStore,
  layerId: LayerId,
  point: Point,
): boolean {
  const entry = store.get(layerId);
  if (entry === undefined) {
    return false;
  }
  return regionContains(entry.opaqueRegions, point);
}
