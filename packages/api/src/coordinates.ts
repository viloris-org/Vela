import type { Point, Rect } from "./geometry.ts";

/**
 * Logical space has a top-left origin with y increasing down. AppKit
 * contentView space has a bottom-left origin with y increasing up. Convert
 * exactly once at the Shell boundary; API contracts remain in logical space.
 */

export function appKitPointToLogical(
  point: Point,
  contentHeight: number,
): Point {
  return { x: point.x, y: contentHeight - point.y };
}

export function logicalPointToAppKit(
  point: Point,
  contentHeight: number,
): Point {
  return { x: point.x, y: contentHeight - point.y };
}

export function appKitRectToLogical(
  rect: Rect,
  contentHeight: number,
): Rect {
  return {
    x: rect.x,
    y: contentHeight - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}

export function logicalRectToAppKit(
  rect: Rect,
  contentHeight: number,
): Rect {
  return {
    x: rect.x,
    y: contentHeight - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}
