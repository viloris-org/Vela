import type { Point, Region } from "../geometry.ts";

/**
 * Layer-level hit policy (inside the app).
 * Distinct from {@link WindowInputMode} (window → other apps / desktop).
 */
export type HitPolicy =
  | { readonly mode: "opaque" }
  | { readonly mode: "transparent" }
  | { readonly mode: "mask"; readonly region: Region }
  /**
   * Web layer reports which regions (or points) are interactive.
   * Non-matching points pass through to lower layers.
   */
  | { readonly mode: "web-shaped" }
  /**
   * Shell asks the native surface (e.g. Swift shape hitTest).
   * Used when mask cannot express the outline.
   */
  | { readonly mode: "callback" };

/**
 * How this window delivers input relative to the OS / other applications.
 * Not used for Web ↔ native stacking inside the client area.
 */
export type WindowInputMode =
  | { readonly mode: "normal" }
  /** Entire window ignores hits (Flutter-style all-or-nothing). */
  | { readonly mode: "click-through" }
  /** Only these regions pass through to the desktop / windows below. */
  | { readonly mode: "region-through"; readonly region: Region }
  /** Window outline + hit outline (shaped window). */
  | { readonly mode: "shaped"; readonly region: Region };

export type HitTargetKind =
  | "os-desktop"
  | "window-background"
  | "chrome"
  | "webview"
  | "native"
  | "material";

export interface HitTarget {
  readonly kind: HitTargetKind;
  readonly layerId?: string;
  readonly localPoint: Point;
}

/** Payload Web → Shell when using web-shaped policy. */
export interface WebShapeUpdate {
  readonly layerId: string;
  /** Regions that should receive hits on the web layer. */
  readonly opaqueRegions: Region;
  /** Optional generation for stale-update rejection. */
  readonly generation?: number;
}

export interface WebShapePointQuery {
  readonly layerId: string;
  readonly point: Point;
}
