import { describe, expect, test } from "bun:test";
import type { Layer } from "../layer/types.ts";
import {
  EMPTY_REGION,
  defaultWebViewHitPolicy,
} from "./web-shaped-defaults.ts";
import {
  applyWebShapeUpdate,
  createEmptyOpaqueRegionStore,
  resolveHit,
} from "./resolve-hit.ts";

const fullClient = { x: 0, y: 0, width: 800, height: 600 };

const layers: readonly Layer[] = [
  {
    id: "underlay",
    kind: "native",
    component: "test.underlay",
    bounds: fullClient,
    zIndex: 0,
    visible: true,
    opacity: 1,
    hitPolicy: { mode: "opaque" },
  },
  {
    id: "web",
    kind: "webview",
    bounds: fullClient,
    zIndex: 10,
    visible: true,
    opacity: 1,
    hitPolicy: defaultWebViewHitPolicy(),
  },
];

describe("web-shaped defaults", () => {
  test("returns the web-shaped hit policy for new webviews", () => {
    expect(defaultWebViewHitPolicy()).toEqual({ mode: "web-shaped" });
  });

  test("falls through when opaque store has no entry for the webview", () => {
    const target = resolveHit(
      { mode: "normal" },
      layers,
      createEmptyOpaqueRegionStore(),
      { x: 200, y: 200 },
    );
    expect(target).toEqual({
      kind: "native",
      layerId: "underlay",
      localPoint: { x: 200, y: 200 },
    });
  });

  test("falls through after an empty web shape update", () => {
    const update = applyWebShapeUpdate(createEmptyOpaqueRegionStore(), {
      layerId: "web",
      opaqueRegions: EMPTY_REGION,
      generation: 1,
    });

    const target = resolveHit(
      { mode: "normal" },
      layers,
      update.store,
      { x: 200, y: 200 },
    );

    expect(target).toEqual({
      kind: "native",
      layerId: "underlay",
      localPoint: { x: 200, y: 200 },
    });
  });

  test("hits webview inside reported opaque region", () => {
    const update = applyWebShapeUpdate(createEmptyOpaqueRegionStore(), {
      layerId: "web",
      opaqueRegions: {
        primitives: [
          { type: "rect", rect: { x: 100, y: 100, width: 200, height: 200 } },
        ],
      },
      generation: 2,
    });

    const inside = resolveHit(
      { mode: "normal" },
      layers,
      update.store,
      { x: 150, y: 150 },
    );
    const outside = resolveHit(
      { mode: "normal" },
      layers,
      update.store,
      { x: 400, y: 400 },
    );

    expect(inside).toEqual({
      kind: "webview",
      layerId: "web",
      localPoint: { x: 150, y: 150 },
    });
    expect(outside).toEqual({
      kind: "native",
      layerId: "underlay",
      localPoint: { x: 400, y: 400 },
    });
  });
});
