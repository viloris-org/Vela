/** Logical pixels in window content coordinates (origin top-left, y down). */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type CornerRadius =
  | number
  | {
      readonly topLeft: number;
      readonly topRight: number;
      readonly bottomRight: number;
      readonly bottomLeft: number;
    };

/** Axis-aligned shape used for layer bounds and hit masks (v1). */
export type Shape =
  | { readonly type: "rect" }
  | { readonly type: "roundedRect"; readonly radius: CornerRadius }
  | { readonly type: "capsule" }
  | { readonly type: "circle" };

/**
 * Hit / clip region as a union of primitives.
 * v1: no arbitrary paths; expand later if needed.
 */
export type RegionPrimitive =
  | { readonly type: "rect"; readonly rect: Rect }
  | {
      readonly type: "roundedRect";
      readonly rect: Rect;
      readonly radius: CornerRadius;
    }
  | { readonly type: "capsule"; readonly rect: Rect }
  | { readonly type: "circle"; readonly center: Point; readonly radius: number };

export interface Region {
  readonly primitives: readonly RegionPrimitive[];
}

export function regionFromRect(rect: Rect): Region {
  return { primitives: [{ type: "rect", rect }] };
}

export function regionFromRoundedRect(
  rect: Rect,
  radius: CornerRadius,
): Region {
  return { primitives: [{ type: "roundedRect", rect, radius }] };
}

export function regionUnion(...regions: readonly Region[]): Region {
  return {
    primitives: regions.flatMap((r) => r.primitives),
  };
}

export function rectContains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}
