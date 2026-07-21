import type { Rect, Region, Shape } from "../geometry.ts";
import type { HitPolicy } from "../hit/policy.ts";
import type {
  BackdropSource,
  Color,
  MaterialId,
  MaterialVariant,
} from "../material/spec.ts";

export type LayerId = string;

export type LayerKind =
  | "webview"
  | "native"
  | "material"
  | "chrome"
  | "passthrough";

export interface LayerBase {
  readonly id: LayerId;
  readonly kind: LayerKind;
  readonly bounds: Rect;
  readonly zIndex: number;
  readonly visible: boolean;
  readonly opacity: number;
  readonly hitPolicy: HitPolicy;
  readonly clip?: Region;
  /** v1: translate only recommended for native/material. */
  readonly transform?: LayerTransform;
}

export interface LayerTransform {
  readonly translateX?: number;
  readonly translateY?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

export interface WebViewLayer extends LayerBase {
  readonly kind: "webview";
  readonly url?: string;
  readonly preloadProfile?: string;
  /** Capability set granted to this web content. */
  readonly capabilities?: readonly string[];
}

export interface NativeLayer extends LayerBase {
  readonly kind: "native";
  /** Registered component name, e.g. "camera.preview". */
  readonly component: string;
  readonly props?: unknown;
}

export interface MaterialLayer extends LayerBase {
  readonly kind: "material";
  readonly material: MaterialId;
  readonly shape: Shape;
  readonly samples: BackdropSource;
  readonly variant: MaterialVariant;
  readonly tint?: Color;
  readonly interactive: boolean;
}

export interface ChromeLayer extends LayerBase {
  readonly kind: "chrome";
  readonly role: "titlebar" | "drag-region" | "system-buttons" | "custom";
}

export interface PassthroughLayer extends LayerBase {
  readonly kind: "passthrough";
}

export type Layer =
  | WebViewLayer
  | NativeLayer
  | MaterialLayer
  | ChromeLayer
  | PassthroughLayer;

/** Insert / create descriptors (id optional until Shell assigns). */
export type InsertLayerSpec =
  | InsertWebViewLayerSpec
  | InsertNativeLayerSpec
  | InsertMaterialLayerSpec
  | InsertChromeLayerSpec
  | InsertPassthroughLayerSpec;

interface InsertLayerCommon {
  readonly id?: LayerId;
  readonly bounds: Rect;
  readonly zIndex: number;
  readonly visible?: boolean;
  readonly opacity?: number;
  readonly hitPolicy?: HitPolicy;
  readonly clip?: Region;
}

export interface InsertWebViewLayerSpec extends InsertLayerCommon {
  readonly kind: "webview";
  readonly url?: string;
  readonly preloadProfile?: string;
  readonly capabilities?: readonly string[];
}

export interface InsertNativeLayerSpec extends InsertLayerCommon {
  readonly kind: "native";
  readonly component: string;
  readonly props?: unknown;
}

export interface InsertMaterialLayerSpec extends InsertLayerCommon {
  readonly kind: "material";
  readonly material: MaterialId;
  readonly shape?: Shape;
  readonly samples?: BackdropSource;
  readonly variant?: MaterialVariant;
  readonly tint?: Color;
  readonly interactive?: boolean;
}

export interface InsertChromeLayerSpec extends InsertLayerCommon {
  readonly kind: "chrome";
  readonly role: ChromeLayer["role"];
}

export interface InsertPassthroughLayerSpec extends InsertLayerCommon {
  readonly kind: "passthrough";
}

export interface LayerPatch {
  readonly bounds?: Rect;
  readonly zIndex?: number;
  readonly visible?: boolean;
  readonly opacity?: number;
  readonly hitPolicy?: HitPolicy;
  readonly clip?: Region | null;
  readonly props?: unknown;
  readonly url?: string;
}

export function defaultHitPolicyForKind(kind: LayerKind): HitPolicy {
  switch (kind) {
    case "passthrough":
      return { mode: "transparent" };
    case "webview":
      return { mode: "web-shaped" };
    case "material":
    case "native":
    case "chrome":
      return { mode: "opaque" };
  }
}
