import { describe, expect, test } from "bun:test";
import type { Layer } from "../layer/types.ts";
import type { WindowInputMode } from "./policy.ts";
import {
  applyWebShapeUpdate,
  createEmptyOpaqueRegionStore,
  isGenerationStale,
  resolveHit,
  type OpaqueRegionStore,
} from "./resolve-hit.ts";

type LayerSeed = {
  readonly id: string;
  readonly kind: Layer["kind"];
  readonly bounds: Layer["bounds"];
  readonly zIndex: number;
  readonly hitPolicy: Layer["hitPolicy"];
  readonly visible?: boolean;
  readonly opacity?: number;
  readonly clip?: Layer["clip"];
  readonly transform?: Layer["transform"];
  readonly component?: string;
};

function baseLayer(seed: LayerSeed): Layer {
  const visible = seed.visible ?? true;
  const opacity = seed.opacity ?? 1;
  const base = {
    id: seed.id,
    bounds: seed.bounds,
    zIndex: seed.zIndex,
    hitPolicy: seed.hitPolicy,
    visible,
    opacity,
    ...(seed.clip !== undefined ? { clip: seed.clip } : {}),
    ...(seed.transform !== undefined ? { transform: seed.transform } : {}),
  };
  switch (seed.kind) {
    case "webview":
      return { ...base, kind: "webview" };
    case "native":
      return {
        ...base,
        kind: "native",
        component: seed.component ?? "test.native",
      };
    case "material":
      return {
        ...base,
        kind: "material",
        material: "apple.material",
        shape: { type: "rect" },
        samples: { type: "layers-below" },
        variant: "regular",
        interactive: true,
      };
    case "chrome":
      return { ...base, kind: "chrome", role: "titlebar" };
    case "passthrough":
      return { ...base, kind: "passthrough" };
  }
}

const fullClient = { x: 0, y: 0, width: 800, height: 600 };
const normalMode: WindowInputMode = { mode: "normal" };

describe("resolveHit", () => {
  test("returns os-desktop when window is fully click-through", () => {
    const target = resolveHit(
      { mode: "click-through" },
      [],
      createEmptyOpaqueRegionStore(),
      { x: 10, y: 10 },
    );
    expect(target).toEqual({
      kind: "os-desktop",
      localPoint: { x: 10, y: 10 },
    });
  });

  test("returns os-desktop when point is in region-through hole", () => {
    const target = resolveHit(
      {
        mode: "region-through",
        region: {
          primitives: [
            { type: "rect", rect: { x: 0, y: 0, width: 50, height: 50 } },
          ],
        },
      },
      [
        baseLayer({
          id: "web",
          kind: "webview",
          bounds: fullClient,
          zIndex: 10,
          hitPolicy: { mode: "opaque" },
        }),
      ],
      createEmptyOpaqueRegionStore(),
      { x: 10, y: 10 },
    );
    expect(target.kind).toBe("os-desktop");
  });

  test("opaque top layer wins over lower layers", () => {
    const layers: readonly Layer[] = [
      baseLayer({
        id: "under",
        kind: "native",
        bounds: fullClient,
        zIndex: 0,
        hitPolicy: { mode: "opaque" },
      }),
      baseLayer({
        id: "glass",
        kind: "material",
        bounds: { x: 0, y: 0, width: 400, height: 48 },
        zIndex: 30,
        hitPolicy: { mode: "opaque" },
      }),
    ];
    const target = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 20, y: 20 },
    );
    expect(target).toEqual({
      kind: "material",
      layerId: "glass",
      localPoint: { x: 20, y: 20 },
    });
  });

  test("transparent policy skips layer", () => {
    const layers: readonly Layer[] = [
      baseLayer({
        id: "under",
        kind: "native",
        bounds: fullClient,
        zIndex: 0,
        hitPolicy: { mode: "opaque" },
      }),
      baseLayer({
        id: "pass",
        kind: "passthrough",
        bounds: fullClient,
        zIndex: 50,
        hitPolicy: { mode: "transparent" },
      }),
    ];
    const target = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 100, y: 100 },
    );
    expect(target.layerId).toBe("under");
    expect(target.kind).toBe("native");
  });

  test("web-shaped empty regions pass through to underlay", () => {
    const layers: readonly Layer[] = [
      baseLayer({
        id: "map",
        kind: "native",
        bounds: fullClient,
        zIndex: 0,
        hitPolicy: { mode: "opaque" },
      }),
      baseLayer({
        id: "web",
        kind: "webview",
        bounds: fullClient,
        zIndex: 10,
        hitPolicy: { mode: "web-shaped" },
      }),
    ];
    const target = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 200, y: 200 },
    );
    expect(target).toEqual({
      kind: "native",
      layerId: "map",
      localPoint: { x: 200, y: 200 },
    });
  });

  test("web-shaped accepts point inside reported opaque region", () => {
    const layers: readonly Layer[] = [
      baseLayer({
        id: "map",
        kind: "native",
        bounds: fullClient,
        zIndex: 0,
        hitPolicy: { mode: "opaque" },
      }),
      baseLayer({
        id: "web",
        kind: "webview",
        bounds: fullClient,
        zIndex: 10,
        hitPolicy: { mode: "web-shaped" },
      }),
    ];
    let store = createEmptyOpaqueRegionStore();
    store = applyWebShapeUpdate(store, {
      layerId: "web",
      opaqueRegions: {
        primitives: [
          { type: "rect", rect: { x: 100, y: 100, width: 80, height: 40 } },
        ],
      },
      generation: 1,
    }).store;
    const hitUi = resolveHit(normalMode, layers, store, { x: 120, y: 120 });
    expect(hitUi.layerId).toBe("web");
    expect(hitUi.kind).toBe("webview");
    const hitHole = resolveHit(normalMode, layers, store, { x: 300, y: 300 });
    expect(hitHole.layerId).toBe("map");
  });

  test("mask policy only hits listed region", () => {
    const layers: readonly Layer[] = [
      baseLayer({
        id: "under",
        kind: "native",
        bounds: fullClient,
        zIndex: 0,
        hitPolicy: { mode: "opaque" },
      }),
      baseLayer({
        id: "masked",
        kind: "chrome",
        bounds: fullClient,
        zIndex: 40,
        hitPolicy: {
          mode: "mask",
          region: {
            primitives: [
              { type: "rect", rect: { x: 0, y: 0, width: 100, height: 24 } },
            ],
          },
        },
      }),
    ];
    const onMask = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 10, y: 10 },
    );
    expect(onMask.layerId).toBe("masked");
    const offMask = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 200, y: 200 },
    );
    expect(offMask.layerId).toBe("under");
  });

  test("invisible layers are ignored", () => {
    const layers: readonly Layer[] = [
      baseLayer({
        id: "under",
        kind: "native",
        bounds: fullClient,
        zIndex: 0,
        hitPolicy: { mode: "opaque" },
      }),
      baseLayer({
        id: "hidden",
        kind: "material",
        bounds: fullClient,
        zIndex: 99,
        hitPolicy: { mode: "opaque" },
        visible: false,
      }),
    ];
    const target = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 1, y: 1 },
    );
    expect(target.layerId).toBe("under");
  });

  test("opacity does not change hit policy", () => {
    const layers: readonly Layer[] = [
      baseLayer({
        id: "under",
        kind: "native",
        bounds: fullClient,
        zIndex: 0,
        hitPolicy: { mode: "opaque" },
      }),
      baseLayer({
        id: "faint",
        kind: "material",
        bounds: fullClient,
        zIndex: 20,
        hitPolicy: { mode: "opaque" },
        opacity: 0.01,
      }),
    ];
    const target = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 5, y: 5 },
    );
    expect(target.layerId).toBe("faint");
  });

  test("no accepting layer yields window-background", () => {
    const target = resolveHit(
      normalMode,
      [],
      createEmptyOpaqueRegionStore(),
      { x: 1, y: 1 },
    );
    expect(target).toEqual({
      kind: "window-background",
      localPoint: { x: 1, y: 1 },
    });
  });

  test("callback policy without acceptor skips layer", () => {
    const layers: readonly Layer[] = [
      baseLayer({
        id: "under",
        kind: "native",
        bounds: fullClient,
        zIndex: 0,
        hitPolicy: { mode: "opaque" },
      }),
      baseLayer({
        id: "cb",
        kind: "native",
        bounds: fullClient,
        zIndex: 50,
        hitPolicy: { mode: "callback" },
      }),
    ];
    const target = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 10, y: 10 },
    );
    expect(target.layerId).toBe("under");
  });

  test("translate transform shifts layer bounds for hit", () => {
    const layers: readonly Layer[] = [
      baseLayer({
        id: "slot",
        kind: "native",
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        zIndex: 10,
        hitPolicy: { mode: "opaque" },
        transform: { translateX: 200, translateY: 50 },
      }),
    ];
    const miss = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 10, y: 10 },
    );
    expect(miss.kind).toBe("window-background");
    const hit = resolveHit(
      normalMode,
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 210, y: 60 },
    );
    expect(hit.layerId).toBe("slot");
    expect(hit.localPoint).toEqual({ x: 10, y: 10 });
  });
});

describe("applyWebShapeUpdate / generation", () => {
  test("rejects stale generation", () => {
    let store: OpaqueRegionStore = createEmptyOpaqueRegionStore();
    const first = applyWebShapeUpdate(store, {
      layerId: "web",
      opaqueRegions: {
        primitives: [
          { type: "rect", rect: { x: 0, y: 0, width: 1, height: 1 } },
        ],
      },
      generation: 5,
    });
    expect(first.accepted).toBe(true);
    store = first.store;
    const stale = applyWebShapeUpdate(store, {
      layerId: "web",
      opaqueRegions: {
        primitives: [
          { type: "rect", rect: { x: 9, y: 9, width: 1, height: 1 } },
        ],
      },
      generation: 4,
    });
    expect(stale.accepted).toBe(false);
    if (!stale.accepted) {
      expect(stale.reason).toBe("generation.stale");
    }
  });

  test("isGenerationStale pure helper", () => {
    expect(isGenerationStale(5, 4)).toBe(true);
    expect(isGenerationStale(5, 5)).toBe(false);
    expect(isGenerationStale(5, 6)).toBe(false);
    expect(isGenerationStale(undefined, 1)).toBe(false);
  });
});
