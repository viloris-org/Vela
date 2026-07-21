import { describe, expect, test } from "bun:test";
import {
  regionFromRect,
  regionUnion,
  rectContains,
} from "./geometry.ts";

describe("geometry", () => {
  test("rectContains", () => {
    const r = { x: 10, y: 20, width: 100, height: 50 };
    expect(rectContains(r, { x: 10, y: 20 })).toBe(true);
    expect(rectContains(r, { x: 109, y: 69 })).toBe(true);
    expect(rectContains(r, { x: 110, y: 20 })).toBe(false);
  });

  test("regionUnion concatenates primitives", () => {
    const a = regionFromRect({ x: 0, y: 0, width: 10, height: 10 });
    const b = regionFromRect({ x: 20, y: 0, width: 10, height: 10 });
    expect(regionUnion(a, b).primitives).toHaveLength(2);
  });
});
