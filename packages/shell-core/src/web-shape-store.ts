import type {
  ApplyWebShapeResult,
  LayerId,
  OpaqueRegionStore,
  Region,
  WebShapeUpdate,
} from "@vela/api";
import {
  applyWebShapeUpdate,
  createEmptyOpaqueRegionStore,
} from "@vela/api";
import { DOGFOOD_LAYER_IDS } from "./ids.ts";

export type WebShapeStore = {
  getStore(): OpaqueRegionStore;
  setOpaqueRegions(update: WebShapeUpdate): ApplyWebShapeResult;
  setMainOpaqueRegions(region: Region): ApplyWebShapeResult;
  snapshotEntries(): readonly {
    readonly layerId: LayerId;
    readonly opaqueRegions: Region;
    readonly lastAcceptedGeneration?: number;
  }[];
};

export function createWebShapeStore(
  mainLayerId: LayerId = DOGFOOD_LAYER_IDS.mainWebview,
): WebShapeStore {
  let store = createEmptyOpaqueRegionStore();
  let mainGeneration = 0;

  return {
    getStore() {
      return store;
    },
    setOpaqueRegions(update) {
      const result = applyWebShapeUpdate(store, update);
      store = result.store;
      return result;
    },
    setMainOpaqueRegions(region) {
      mainGeneration += 1;
      const result = applyWebShapeUpdate(store, {
        layerId: mainLayerId,
        opaqueRegions: region,
        generation: mainGeneration,
      });
      store = result.store;
      return result;
    },
    snapshotEntries() {
      const entries: {
        readonly layerId: LayerId;
        readonly opaqueRegions: Region;
        readonly lastAcceptedGeneration?: number;
      }[] = [];
      for (const [layerId, entry] of store) {
        entries.push(
          entry.lastAcceptedGeneration === undefined
            ? { layerId, opaqueRegions: entry.opaqueRegions }
            : {
                layerId,
                opaqueRegions: entry.opaqueRegions,
                lastAcceptedGeneration: entry.lastAcceptedGeneration,
              },
        );
      }
      return entries;
    },
  };
}
