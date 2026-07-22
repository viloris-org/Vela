import { describe, expect, test } from "bun:test";
import type { Region } from "./geometry.ts";
import {
  regionFromRect,
  regionUnion,
  rectContains,
  regionContains,
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

  test("regionContains accepts point in any rect primitive", () => {
    const region = regionUnion(
      regionFromRect({ x: 0, y: 0, width: 10, height: 10 }),
      regionFromRect({ x: 50, y: 50, width: 10, height: 10 }),
    );
    expect(regionContains(region, { x: 5, y: 5 })).toBe(true);
    expect(regionContains(region, { x: 55, y: 55 })).toBe(true);
    expect(regionContains(region, { x: 25, y: 25 })).toBe(false);
  });

  test("regionContains circle is inclusive of radius edge", () => {
    const region: Region = {
      primitives: [
        { type: "circle", center: { x: 0, y: 0 }, radius: 10 },
      ],
    };
    expect(regionContains(region, { x: 0, y: 0 })).toBe(true);
    expect(regionContains(region, { x: 10, y: 0 })).toBe(true);
    expect(regionContains(region, { x: 10.1, y: 0 })).toBe(false);
  });

  test("regionContains capsule uses half-height endcaps", () => {
    const region: Region = {
      primitives: [
        {
          type: "capsule",
          rect: { x: 0, y: 0, width: 100, height: 20 },
        },
      ],
    };
    expect(regionContains(region, { x: 50, y: 10 })).toBe(true);
    expect(regionContains(region, { x: 0, y: 10 })).toBe(true);
    expect(regionContains(region, { x: -1, y: 10 })).toBe(false);
    expect(regionContains(region, { x: 50, y: -1 })).toBe(false);
  });
});
