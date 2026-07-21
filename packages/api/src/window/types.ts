import type { Rect, Size } from "../geometry.ts";
import type { WindowInputMode } from "../hit/policy.ts";
import type { InsertLayerSpec, Layer, LayerId, LayerPatch } from "../layer/types.ts";

export type WindowId = string;

export type WindowChrome = "system" | "custom" | "none";

export interface CreateWindowOptions {
  readonly title?: string;
  readonly size?: Size;
  readonly minSize?: Size;
  readonly maxSize?: Size;
  readonly chrome?: WindowChrome;
  readonly transparent?: boolean;
  readonly alwaysOnTop?: boolean;
  readonly resizable?: boolean;
  readonly inputMode?: WindowInputMode;
  /**
   * Preload profile name → capability grant from app manifest.
   */
  readonly preloadProfile?: string;
  readonly capabilities?: readonly string[];
}

export interface WindowState {
  readonly id: WindowId;
  readonly title: string;
  readonly bounds: Rect;
  readonly focused: boolean;
  readonly visible: boolean;
  readonly fullscreen: boolean;
  readonly inputMode: WindowInputMode;
  readonly scaleFactor: number;
}

/**
 * Host-facing window controller (implemented by Shell + Bun bridge).
 * This is the TypeScript contract, not a runtime implementation.
 */
export interface VelaWindow {
  readonly id: WindowId;

  getState(): WindowState | Promise<WindowState>;

  setTitle(title: string): void | Promise<void>;
  setBounds(bounds: Rect): void | Promise<void>;
  setInputMode(mode: WindowInputMode): void | Promise<void>;
  focus(): void | Promise<void>;
  close(): void | Promise<void>;

  /** Layer tree API */
  insertLayer(spec: InsertLayerSpec): Layer | Promise<Layer>;
  updateLayer(id: LayerId, patch: LayerPatch): void | Promise<void>;
  removeLayer(id: LayerId): void | Promise<void>;
  listLayers(): readonly Layer[] | Promise<readonly Layer[]>;
  reorderLayer(id: LayerId, zIndex: number): void | Promise<void>;

  /**
   * Mount a child native control under a material/native parent
   * (e.g. buttons inside GlassEffectContainer).
   */
  mountChild?(
    parentId: LayerId,
    spec: InsertLayerSpec & { readonly kind: "native" },
  ): Layer | Promise<Layer>;
}

export interface CreateAppOptions {
  readonly name: string;
  readonly version?: string;
  readonly capabilities?: import("../capability/types.ts").AppManifestCapabilities;
}

export interface VelaApp {
  whenReady(): Promise<void>;
  createWindow(options?: CreateWindowOptions): Promise<VelaWindow>;
  quit(): void | Promise<void>;
}
