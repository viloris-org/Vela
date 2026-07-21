import type { Rect, Shape } from "../geometry.ts";
import type { HitPolicy } from "../hit/policy.ts";

/**
 * Cross-platform material identifiers.
 * Semantics: "system material layer". Visuals are platform-mapped.
 */
export type MaterialId =
  | "apple.liquidGlass"
  | "apple.material"
  | "win.mica"
  | "win.acrylic"
  | "win.smoke"
  | "gtk.blur"
  | "fallback.css";

export type MaterialVariant = "regular" | "clear";

export type BackdropSource =
  /** Sample all layers with lower zIndex (default for glass toolbars). */
  | { readonly type: "layers-below" }
  | { readonly type: "layer"; readonly layerId: string }
  | { readonly type: "window-content" };

export interface Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number;
}

/**
 * Spec for inserting a material layer (e.g. Liquid Glass via Swift).
 * Real system materials must be painted by the platform backend so they
 * sample live surfaces below — not CSS-only fakes (except fallback.css).
 */
export interface MaterialLayerSpec {
  readonly id?: string;
  readonly kind: "material";
  readonly material: MaterialId;
  readonly bounds: Rect;
  readonly zIndex: number;
  readonly shape?: Shape;
  readonly samples?: BackdropSource;
  readonly variant?: MaterialVariant;
  readonly tint?: Color;
  /** Touch/pointer reactive glass where the platform supports it. */
  readonly interactive?: boolean;
  readonly hitPolicy?: HitPolicy;
  readonly visible?: boolean;
  readonly opacity?: number;
  /**
   * Optional content hosted on/in the material (native children or a layer id).
   * Prefer GlassEffectContainer-style children for multi-control fusion on Apple.
   */
  readonly content?: MaterialContentRef;
}

export type MaterialContentRef =
  | { readonly type: "layer"; readonly layerId: string }
  | { readonly type: "native-subtree"; readonly subtreeId: string };

/** Resolved material after platform fallback mapping. */
export interface ResolvedMaterial {
  readonly requested: MaterialId;
  readonly effective: MaterialId;
  readonly platform: PlatformId;
  readonly degraded: boolean;
  readonly reason?: string;
}

export type PlatformId =
  | "macos"
  | "ios"
  | "windows"
  | "linux"
  | "android"
  | "unknown";

/**
 * Map a requested material to what the current platform can actually render.
 * Pure policy helper for hosts; Shell may apply the same rules natively.
 */
export function resolveMaterial(
  requested: MaterialId,
  platform: PlatformId,
  options?: { readonly supportsLiquidGlass?: boolean },
): ResolvedMaterial {
  const supportsLiquidGlass = options?.supportsLiquidGlass ?? false;

  if (requested === "fallback.css") {
    return {
      requested,
      effective: "fallback.css",
      platform,
      degraded: false,
    };
  }

  if (platform === "macos" || platform === "ios") {
    if (requested === "apple.liquidGlass") {
      if (supportsLiquidGlass) {
        return {
          requested,
          effective: "apple.liquidGlass",
          platform,
          degraded: false,
        };
      }
      return {
        requested,
        effective: "apple.material",
        platform,
        degraded: true,
        reason: "Liquid Glass unavailable; using system material",
      };
    }
    if (requested === "apple.material" || requested.startsWith("apple.")) {
      return {
        requested,
        effective: "apple.material",
        platform,
        degraded: requested !== "apple.material",
      };
    }
    return {
      requested,
      effective: "apple.material",
      platform,
      degraded: true,
      reason: `Mapped ${requested} → apple.material`,
    };
  }

  if (platform === "windows") {
    if (
      requested === "win.mica" ||
      requested === "win.acrylic" ||
      requested === "win.smoke"
    ) {
      return { requested, effective: requested, platform, degraded: false };
    }
    if (requested === "apple.liquidGlass" || requested === "apple.material") {
      return {
        requested,
        effective: "win.mica",
        platform,
        degraded: true,
        reason: "Apple material mapped to Mica",
      };
    }
    return {
      requested,
      effective: "win.acrylic",
      platform,
      degraded: true,
      reason: `Mapped ${requested} → win.acrylic`,
    };
  }

  if (platform === "linux") {
    if (requested === "gtk.blur") {
      return { requested, effective: "gtk.blur", platform, degraded: false };
    }
    return {
      requested,
      effective: "gtk.blur",
      platform,
      degraded: true,
      reason: `Mapped ${requested} → gtk.blur (best effort)`,
    };
  }

  // android / unknown
  return {
    requested,
    effective: "fallback.css",
    platform,
    degraded: true,
    reason: "No system material backend; CSS fallback",
  };
}
