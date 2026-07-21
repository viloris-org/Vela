import type { Region } from "../geometry.ts";
import type { WebShapeUpdate } from "../hit/policy.ts";
import type { InsertLayerSpec, LayerId, LayerPatch } from "../layer/types.ts";

/**
 * Safe surface injected into Web content via preload.
 * No Node, no FFI, no arbitrary require.
 */
export interface VelaPreloadBridge {
  readonly version: string;

  /** Typed capability RPC (host validates permission + schema). */
  call(method: string, args?: unknown): Promise<unknown>;

  readonly layers: {
    insert(spec: InsertLayerSpec): Promise<{ readonly id: LayerId }>;
    update(id: LayerId, patch: LayerPatch): Promise<void>;
    remove(id: LayerId): Promise<void>;
  };

  readonly hit: {
    /** Push opaque regions for web-shaped layers. */
    setOpaqueRegions(update: WebShapeUpdate): void;
    /** Convenience: set regions for the default main web layer. */
    setMainOpaqueRegions(region: Region): void;
  };

  readonly events: {
    subscribe(
      channel: string,
      handler: (payload: unknown) => void,
    ): () => void;
  };
}

declare global {
  interface Window {
    /** Present only inside Vela WebViews after preload injection. */
    readonly vela?: VelaPreloadBridge;
  }
}

export {};
