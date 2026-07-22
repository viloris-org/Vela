import { describe, expect, test } from "bun:test";
import type { LayerTreeSnapshot } from "./snapshot.ts";
import { toOpaqueRegionStore } from "./snapshot.ts";

describe("toOpaqueRegionStore", () => {
  test("preserves regions and their accepted generation", () => {
    const webRegions = {
      primitives: [
        {
          type: "rect" as const,
          rect: { x: 10, y: 20, width: 30, height: 40 },
        },
      ],
    };
    const snapshot: LayerTreeSnapshot = {
      generation: 4,
      layers: [],
      opaqueRegions: [
        {
          layerId: "web",
          opaqueRegions: webRegions,
          lastAcceptedGeneration: 3,
        },
      ],
    };

    const store = toOpaqueRegionStore(snapshot);

    expect(store.get("web")).toEqual({
      opaqueRegions: webRegions,
      lastAcceptedGeneration: 3,
    });
  });
});
