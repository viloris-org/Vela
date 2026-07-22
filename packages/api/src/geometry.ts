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

function assertNever(value: never): never {
  throw new Error(`unexpected region primitive: ${JSON.stringify(value)}`);
}

function normalizeCornerRadius(radius: CornerRadius): {
  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomRight: number;
  readonly bottomLeft: number;
} {
  if (typeof radius === "number") {
    return {
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius,
    };
  }
  return radius;
}

function pointInCircle(
  center: Point,
  radius: number,
  point: Point,
): boolean {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return dx * dx + dy * dy <= radius * radius;
}

/** Stadium: semicircular caps on the shorter axis (width≥height → horizontal). */
function pointInCapsule(rect: Rect, point: Point): boolean {
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  if (rect.width >= rect.height) {
    const r = rect.height / 2;
    const bodyLeft = rect.x + r;
    const bodyRight = rect.x + rect.width - r;
    const cy = rect.y + r;
    if (point.y < rect.y || point.y > rect.y + rect.height) {
      return false;
    }
    if (point.x >= bodyLeft && point.x <= bodyRight) {
      return true;
    }
    if (point.x < bodyLeft) {
      return pointInCircle({ x: bodyLeft, y: cy }, r, point);
    }
    return pointInCircle({ x: bodyRight, y: cy }, r, point);
  }
  const r = rect.width / 2;
  const bodyTop = rect.y + r;
  const bodyBottom = rect.y + rect.height - r;
  const cx = rect.x + r;
  if (point.x < rect.x || point.x > rect.x + rect.width) {
    return false;
  }
  if (point.y >= bodyTop && point.y <= bodyBottom) {
    return true;
  }
  if (point.y < bodyTop) {
    return pointInCircle({ x: cx, y: bodyTop }, r, point);
  }
  return pointInCircle({ x: cx, y: bodyBottom }, r, point);
}

function pointInRoundedRect(
  rect: Rect,
  radius: CornerRadius,
  point: Point,
): boolean {
  if (!rectContains(rect, point)) {
    return false;
  }
  const corners = normalizeCornerRadius(radius);
  const maxR = Math.min(rect.width, rect.height) / 2;
  const tl = Math.min(Math.max(0, corners.topLeft), maxR);
  const tr = Math.min(Math.max(0, corners.topRight), maxR);
  const br = Math.min(Math.max(0, corners.bottomRight), maxR);
  const bl = Math.min(Math.max(0, corners.bottomLeft), maxR);

  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  if (point.x < left + tl && point.y < top + tl) {
    return pointInCircle({ x: left + tl, y: top + tl }, tl, point);
  }
  if (point.x >= right - tr && point.y < top + tr) {
    return pointInCircle({ x: right - tr, y: top + tr }, tr, point);
  }
  if (point.x >= right - br && point.y >= bottom - br) {
    return pointInCircle({ x: right - br, y: bottom - br }, br, point);
  }
  if (point.x < left + bl && point.y >= bottom - bl) {
    return pointInCircle({ x: left + bl, y: bottom - bl }, bl, point);
  }
  return true;
}

export function regionPrimitiveContains(
  primitive: RegionPrimitive,
  point: Point,
): boolean {
  switch (primitive.type) {
    case "rect":
      return rectContains(primitive.rect, point);
    case "roundedRect":
      return pointInRoundedRect(primitive.rect, primitive.radius, point);
    case "capsule":
      return pointInCapsule(primitive.rect, point);
    case "circle":
      return pointInCircle(primitive.center, primitive.radius, point);
    default:
      return assertNever(primitive);
  }
}

export function regionContains(region: Region, point: Point): boolean {
  for (const primitive of region.primitives) {
    if (regionPrimitiveContains(primitive, point)) {
      return true;
    }
  }
  return false;
}
