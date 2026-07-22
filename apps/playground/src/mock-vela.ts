/**
 * In-page mock when host preload has not injected window.vela.
 * Logs bridge calls and draws region overlays for layout review.
 */
import type {
  InsertLayerSpec,
  LayerId,
  LayerPatch,
  Region,
  VelaPreloadBridge,
  WebShapeUpdate,
} from "@vela/api";

export type MockHudSink = {
  onLog: (line: string) => void;
  onGeneration: (gen: number) => void;
  onHit: (text: string) => void;
};

const MAIN_LAYER_ID = "main-webview";

function clearOverlays(): void {
  for (const el of document.querySelectorAll(".mock-region-overlay")) {
    el.remove();
  }
}

function drawRegionOverlays(region: Region): void {
  clearOverlays();
  for (const prim of region.primitives) {
    const box = document.createElement("div");
    box.className = "mock-region-overlay";
    if (prim.type === "circle") {
      const d = prim.radius * 2;
      box.style.left = `${prim.center.x - prim.radius}px`;
      box.style.top = `${prim.center.y - prim.radius}px`;
      box.style.width = `${d}px`;
      box.style.height = `${d}px`;
      box.style.borderRadius = "50%";
      box.dataset["kind"] = "circle";
    } else {
      const rect = prim.rect;
      box.style.left = `${rect.x}px`;
      box.style.top = `${rect.y}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      if (prim.type === "capsule") {
        box.dataset["kind"] = "capsule";
      } else if (prim.type === "roundedRect") {
        const r =
          typeof prim.radius === "number"
            ? prim.radius
            : Math.max(
                prim.radius.topLeft,
                prim.radius.topRight,
                prim.radius.bottomRight,
                prim.radius.bottomLeft,
              );
        box.style.borderRadius = `${r}px`;
        box.dataset["kind"] = "roundedRect";
      } else {
        box.dataset["kind"] = "rect";
      }
    }
    document.body.appendChild(box);
  }
}

export function installMockVela(hud: MockHudSink): VelaPreloadBridge {
  let generation = 0;
  const layers = new Map<LayerId, InsertLayerSpec>();

  const log = (msg: string): void => {
    console.info(`[vela mock] ${msg}`);
    hud.onLog(msg);
  };

  const bridge: VelaPreloadBridge = {
    version: "0.0.1-mock",

    async call(method: string, args?: unknown): Promise<unknown> {
      log(`call(${method}, ${JSON.stringify(args ?? null)}) → deny-all stub`);
      throw new Error(`mock: capability denied: ${method}`);
    },

    layers: {
      async insert(spec: InsertLayerSpec): Promise<{ readonly id: LayerId }> {
        const id = spec.id ?? `layer-${layers.size + 1}`;
        layers.set(id, spec);
        log(`layers.insert kind=${spec.kind} id=${id}`);
        return { id };
      },
      async update(id: LayerId, patch: LayerPatch): Promise<void> {
        log(`layers.update id=${id} keys=${Object.keys(patch).join(",")}`);
      },
      async remove(id: LayerId): Promise<void> {
        layers.delete(id);
        log(`layers.remove id=${id}`);
      },
    },

    hit: {
      setOpaqueRegions(update: WebShapeUpdate): void {
        if (update.generation !== undefined) {
          generation = update.generation;
          hud.onGeneration(generation);
        }
        const n = update.opaqueRegions.primitives.length;
        log(
          `hit.setOpaqueRegions layerId=${update.layerId} primitives=${n} gen=${update.generation ?? "—"}`,
        );
        drawRegionOverlays(update.opaqueRegions);
      },
      setMainOpaqueRegions(region: Region): void {
        generation += 1;
        hud.onGeneration(generation);
        log(
          `hit.setMainOpaqueRegions primitives=${region.primitives.length} gen=${generation} (layer=${MAIN_LAYER_ID})`,
        );
        drawRegionOverlays(region);
      },
    },

    events: {
      subscribe(
        channel: string,
        handler: (payload: unknown) => void,
      ): () => void {
        log(`events.subscribe channel=${channel}`);
        // Simulate a material.degraded notice in mock mode
        if (channel === "material.degraded") {
          queueMicrotask(() => {
            handler({
              material: "apple.liquidGlass",
              degraded: true,
              reason: "mock: no native material host",
            });
          });
        }
        if (channel === "debug.hit") {
          // Click tracking in mock approximates last target via data-hit
          const onPointer = (ev: PointerEvent): void => {
            const target = (ev.target as HTMLElement | null)?.closest?.(
              "[data-hit]",
            ) as HTMLElement | null;
            const kind = target?.dataset["hit"] ?? "hole/underlay";
            const text = `kind=webview-mock hit=${kind} @(${ev.clientX | 0},${ev.clientY | 0})`;
            hud.onHit(text);
            handler({ kind: "webview", localPoint: { x: ev.clientX, y: ev.clientY }, mockHit: kind });
          };
          window.addEventListener("pointerdown", onPointer);
          return () => window.removeEventListener("pointerdown", onPointer);
        }
        return () => {
          log(`events.unsubscribe channel=${channel}`);
        };
      },
    },
  };

  Object.defineProperty(window, "vela", {
    value: bridge,
    configurable: true,
    writable: false,
  });

  log("installed mock window.vela (browser layout review)");
  return bridge;
}

export { MAIN_LAYER_ID };
