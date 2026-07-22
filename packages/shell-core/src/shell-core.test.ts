import { describe, expect, test } from "bun:test";
import type { Region } from "@vela/api";
import { VelaRpcErrorCodes } from "@vela/api";
import {
  DOGFOOD_LAYER_IDS,
  PLAYGROUND_DOGFOOD_ID_LITERALS,
  ShellCoreError,
  applyDogfoodBootstrap,
  createPreloadBridge,
  createShellCore,
  dogfoodBootstrapSpecs,
} from "./index.ts";

const content = { x: 0, y: 0, width: 800, height: 600 };

/** Approximate playground panel region (opaque web UI). */
const panelRegion: Region = {
  primitives: [
    {
      type: "roundedRect",
      rect: { x: 480, y: 120, width: 280, height: 360 },
      radius: 16,
    },
  ],
};

describe("DOGFOOD_LAYER_IDS", () => {
  test("pins playground string literals", () => {
    expect(DOGFOOD_LAYER_IDS.mainWebview).toBe(
      PLAYGROUND_DOGFOOD_ID_LITERALS.mainWebview,
    );
    expect(DOGFOOD_LAYER_IDS.toolbarMaterial).toBe(
      PLAYGROUND_DOGFOOD_ID_LITERALS.toolbarMaterial,
    );
    expect(DOGFOOD_LAYER_IDS.underlay).toBe("underlay-native");
  });
});

describe("layer tree CRUD", () => {
  test("insert assigns id, update, reorder, remove, list", () => {
    const core = createShellCore();
    const a = core.insertLayer({
      kind: "native",
      component: "test.a",
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      zIndex: 1,
    });
    expect(a.id.startsWith("layer-")).toBe(true);

    const b = core.insertLayer({
      id: "fixed",
      kind: "webview",
      bounds: content,
      zIndex: 5,
    });
    expect(b.id).toBe("fixed");
    expect(b.hitPolicy).toEqual({ mode: "web-shaped" });

    core.updateLayer("fixed", {
      bounds: { x: 1, y: 2, width: 3, height: 4 },
    });
    expect(core.listLayers().find((l) => l.id === "fixed")?.bounds).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });

    core.reorderLayer("fixed", 99);
    expect(core.listLayers().find((l) => l.id === "fixed")?.zIndex).toBe(99);

    core.removeLayer(a.id);
    expect(core.listLayers().map((l) => l.id)).toEqual(["fixed"]);
  });

  test("unknown layer throws layer.not_found", () => {
    const core = createShellCore();
    try {
      core.updateLayer("missing", { opacity: 0.5 });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ShellCoreError);
      expect((err as ShellCoreError).code).toBe(VelaRpcErrorCodes.layerNotFound);
    }
  });
});

describe("dogfood bootstrap", () => {
  test("inserts underlay + main web + toolbar with expected z-order", () => {
    const core = createShellCore({ platform: "linux" });
    applyDogfoodBootstrap(core, content);
    const layers = core.listLayers();
    expect(layers.map((l) => l.id)).toEqual([
      DOGFOOD_LAYER_IDS.underlay,
      DOGFOOD_LAYER_IDS.mainWebview,
      DOGFOOD_LAYER_IDS.toolbarMaterial,
    ]);
    expect(layers.map((l) => l.zIndex)).toEqual([5, 10, 30]);
    const web = layers.find((l) => l.id === DOGFOOD_LAYER_IDS.mainWebview);
    expect(web?.kind).toBe("webview");
    expect(web?.hitPolicy).toEqual({ mode: "web-shaped" });
  });

  test("dogfoodBootstrapSpecs length is 3", () => {
    expect(dogfoodBootstrapSpecs(content)).toHaveLength(3);
  });
});

describe("S2 web-shaped hole to underlay", () => {
  test("hole hits underlay; panel region hits webview", () => {
    const core = createShellCore();
    applyDogfoodBootstrap(core, content);

    // Empty web-shaped → hole at center falls to underlay
    const hole = core.resolvePointer({ x: 200, y: 300 });
    expect(hole.kind).toBe("native");
    expect(hole.layerId).toBe(DOGFOOD_LAYER_IDS.underlay);

    const applied = core.setOpaqueRegions({
      layerId: DOGFOOD_LAYER_IDS.mainWebview,
      opaqueRegions: panelRegion,
      generation: 1,
    });
    expect(applied.accepted).toBe(true);

    const onPanel = core.resolvePointer({ x: 500, y: 200 });
    expect(onPanel.kind).toBe("webview");
    expect(onPanel.layerId).toBe(DOGFOOD_LAYER_IDS.mainWebview);

    // Still a hole outside panel
    const stillHole = core.resolvePointer({ x: 200, y: 300 });
    expect(stillHole.kind).toBe("native");
    expect(stillHole.layerId).toBe(DOGFOOD_LAYER_IDS.underlay);
  });
});

describe("S6 single HitTarget per pointerDown", () => {
  test("lastHit is one target; updates once per pointerDown", () => {
    const core = createShellCore();
    applyDogfoodBootstrap(core, content);

    const hits: unknown[] = [];
    core.subscribe("debug.hit", (p) => hits.push(p));

    const t1 = core.pointerDown({ x: 200, y: 300 });
    expect(core.lastHit()).toEqual(t1);
    expect(hits).toHaveLength(1);

    const t2 = core.pointerDown({ x: 40, y: 30 }); // toolbar
    expect(t2.kind).toBe("material");
    expect(core.lastHit()).toEqual(t2);
    expect(hits).toHaveLength(2);
    // Not an array of dual targets
    expect(Array.isArray(core.lastHit())).toBe(false);
  });
});

describe("S7 stale web-shaped generation", () => {
  test("higher generation wins; stale update rejected", () => {
    const core = createShellCore();
    applyDogfoodBootstrap(core, content);

    const r1 = core.setOpaqueRegions({
      layerId: DOGFOOD_LAYER_IDS.mainWebview,
      opaqueRegions: panelRegion,
      generation: 2,
    });
    expect(r1.accepted).toBe(true);

    const stale = core.setOpaqueRegions({
      layerId: DOGFOOD_LAYER_IDS.mainWebview,
      opaqueRegions: { primitives: [] },
      generation: 1,
    });
    expect(stale.accepted).toBe(false);
    if (!stale.accepted) {
      expect(stale.reason).toBe("generation.stale");
    }

    // Still accepts panel hit from gen 2 regions
    const onPanel = core.resolvePointer({ x: 500, y: 200 });
    expect(onPanel.kind).toBe("webview");
  });
});

describe("opacity does not change hit policy", () => {
  test("transparent material still receives hits when policy is opaque", () => {
    const core = createShellCore();
    applyDogfoodBootstrap(core, content);
    core.updateLayer(DOGFOOD_LAYER_IDS.toolbarMaterial, { opacity: 0 });

    const hit = core.resolvePointer({ x: 100, y: 30 });
    expect(hit.kind).toBe("material");
    expect(hit.layerId).toBe(DOGFOOD_LAYER_IDS.toolbarMaterial);
  });
});

describe("S1 partial material hit", () => {
  test("toolbar bounds hit material layer", () => {
    const core = createShellCore();
    applyDogfoodBootstrap(core, content);
    const hit = core.pointerDown({ x: 100, y: 30 });
    expect(hit.kind).toBe("material");
    expect(hit.layerId).toBe(DOGFOOD_LAYER_IDS.toolbarMaterial);
  });
});

describe("window input mode lite (S3 partial)", () => {
  test("region-through point is os-desktop; outside uses layers", () => {
    const core = createShellCore();
    applyDogfoodBootstrap(core, content);
    core.setInputMode({
      mode: "region-through",
      region: {
        primitives: [
          { type: "rect", rect: { x: 0, y: 0, width: 40, height: 40 } },
        ],
      },
    });

    expect(core.resolvePointer({ x: 10, y: 10 }).kind).toBe("os-desktop");
    // Outside region-through hole → toolbar material
    expect(core.resolvePointer({ x: 100, y: 30 }).kind).toBe("material");
  });
});

describe("material resolve + degrade event", () => {
  test("linux liquidGlass degrades and emits material.degraded", () => {
    const core = createShellCore({ platform: "linux" });
    const events: unknown[] = [];
    core.subscribe("material.degraded", (p) => events.push(p));
    const resolved = core.resolveToolbarMaterial("apple.liquidGlass");
    expect(resolved.degraded).toBe(true);
    expect(resolved.effective).toBe("gtk.blur");
    expect(events).toHaveLength(1);
  });

  test("macos with liquid glass does not degrade", () => {
    const core = createShellCore({
      platform: "macos",
      supportsLiquidGlass: true,
    });
    const events: unknown[] = [];
    core.subscribe("material.degraded", (p) => events.push(p));
    const resolved = core.resolveToolbarMaterial("apple.liquidGlass");
    expect(resolved.degraded).toBe(false);
    expect(events).toHaveLength(0);
  });
});

describe("createPreloadBridge", () => {
  test("layers + hit + deny-all call + events", async () => {
    const core = createShellCore({ platform: "unknown" });
    applyDogfoodBootstrap(core, content);
    const vela = createPreloadBridge(core, { version: "test" });
    expect(vela.version).toBe("test");

    const inserted = await vela.layers.insert({
      kind: "chrome",
      role: "drag-region",
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      zIndex: 40,
    });
    expect(inserted.id).toBeDefined();

    vela.hit.setOpaqueRegions({
      layerId: DOGFOOD_LAYER_IDS.mainWebview,
      opaqueRegions: panelRegion,
      generation: 1,
    });
    expect(core.resolvePointer({ x: 500, y: 200 }).kind).toBe("webview");

    try {
      await vela.call("fs.read", { path: "/etc/passwd" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ShellCoreError);
      expect((err as ShellCoreError).code).toBe(
        VelaRpcErrorCodes.capabilityDenied,
      );
    }

    const hits: unknown[] = [];
    const unsub = vela.events.subscribe("debug.hit", (p) => hits.push(p));
    core.pointerDown({ x: 10, y: 10 });
    expect(hits).toHaveLength(1);
    unsub();
    core.pointerDown({ x: 10, y: 10 });
    expect(hits).toHaveLength(1);
  });
});

describe("snapshot", () => {
  test("includes layers and opaque region entries", () => {
    const core = createShellCore({ windowId: "w-dogfood" });
    applyDogfoodBootstrap(core, content);
    core.setOpaqueRegions({
      layerId: DOGFOOD_LAYER_IDS.mainWebview,
      opaqueRegions: panelRegion,
      generation: 3,
    });
    const snap = core.snapshot();
    expect(snap.windowId).toBe("w-dogfood");
    expect(snap.layers).toHaveLength(3);
    expect(snap.opaqueRegions.some((e) => e.layerId === DOGFOOD_LAYER_IDS.mainWebview)).toBe(
      true,
    );
  });
});
