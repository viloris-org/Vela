/**
 * In-page mock when host preload has not injected window.vela.
 * Enough for layout review; not a full capability host.
 */
import type {
  InsertLayerSpec,
  LayerId,
  LayerPatch,
  Region,
  VelaPreloadBridge,
  WebShapeUpdate,
} from "@vela/api";

export function installMockVela(): VelaPreloadBridge {
  let seq = 0;

  const bridge: VelaPreloadBridge = {
    version: "0.0.1-mock",

    async call(method: string, _args?: unknown): Promise<unknown> {
      console.info(`[vela mock] call(${method}) → deny stub`);
      throw new Error(`mock: capability denied: ${method}`);
    },

    layers: {
      async insert(spec: InsertLayerSpec): Promise<{ readonly id: LayerId }> {
        const id = spec.id ?? `layer-${++seq}`;
        console.info(`[vela mock] layers.insert kind=${spec.kind} id=${id}`);
        return { id };
      },
      async update(id: LayerId, patch: LayerPatch): Promise<void> {
        console.info(
          `[vela mock] layers.update id=${id} keys=${Object.keys(patch).join(",")}`,
        );
      },
      async remove(id: LayerId): Promise<void> {
        console.info(`[vela mock] layers.remove id=${id}`);
      },
    },

    hit: {
      setOpaqueRegions(update: WebShapeUpdate): void {
        console.info(
          `[vela mock] hit.setOpaqueRegions layerId=${update.layerId} gen=${update.generation ?? "—"}`,
        );
      },
      setMainOpaqueRegions(region: Region): void {
        console.info(
          `[vela mock] hit.setMainOpaqueRegions primitives=${region.primitives.length}`,
        );
      },
    },

    events: {
      subscribe(channel: string, _handler: (payload: unknown) => void): () => void {
        console.info(`[vela mock] events.subscribe channel=${channel}`);
        return () => {
          console.info(`[vela mock] events.unsubscribe channel=${channel}`);
        };
      },
    },
  };

  Object.defineProperty(window, "vela", {
    value: bridge,
    configurable: true,
    writable: false,
  });

  console.info("[vela mock] installed mock window.vela");
  return bridge;
}
