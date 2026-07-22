import type { Region } from "../geometry.ts";
import type {
  OpaqueRegionEntry,
  OpaqueRegionStore,
} from "../hit/resolve-hit.ts";
import type { WindowId } from "../window/types.ts";
import type { Layer, LayerId } from "./types.ts";

export type SnapshotOpaqueRegion = {
  readonly layerId: LayerId;
  readonly opaqueRegions: Region;
  readonly lastAcceptedGeneration?: number;
};

/** Shell↔Bun layer tree snapshot (G-P1-5). */
export type LayerTreeSnapshot = {
  readonly windowId?: WindowId;
  readonly generation: number;
  readonly layers: readonly Layer[];
  readonly opaqueRegions: readonly SnapshotOpaqueRegion[];
};

export function toOpaqueRegionStore(
  snapshot: LayerTreeSnapshot,
): OpaqueRegionStore {
  const store = new Map<LayerId, OpaqueRegionEntry>();

  for (const entry of snapshot.opaqueRegions) {
    const opaqueRegionEntry: OpaqueRegionEntry =
      entry.lastAcceptedGeneration === undefined
        ? { opaqueRegions: entry.opaqueRegions }
        : {
            opaqueRegions: entry.opaqueRegions,
            lastAcceptedGeneration: entry.lastAcceptedGeneration,
          };
    store.set(entry.layerId, opaqueRegionEntry);
  }

  return store;
}
