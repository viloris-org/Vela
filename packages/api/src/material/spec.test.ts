import { describe, expect, test } from "bun:test";
import { resolveMaterial } from "./spec.ts";

describe("resolveMaterial", () => {
  test("Apple Liquid Glass when supported", () => {
    const r = resolveMaterial("apple.liquidGlass", "macos", {
      supportsLiquidGlass: true,
    });
    expect(r.effective).toBe("apple.liquidGlass");
    expect(r.degraded).toBe(false);
  });

  test("Apple Liquid Glass degrades to material", () => {
    const r = resolveMaterial("apple.liquidGlass", "macos", {
      supportsLiquidGlass: false,
    });
    expect(r.effective).toBe("apple.material");
    expect(r.degraded).toBe(true);
  });

  test("maps Apple materials to Mica on Windows", () => {
    const r = resolveMaterial("apple.liquidGlass", "windows");
    expect(r.effective).toBe("win.mica");
    expect(r.degraded).toBe(true);
  });

  test("unknown platform falls back to CSS", () => {
    const r = resolveMaterial("apple.liquidGlass", "unknown");
    expect(r.effective).toBe("fallback.css");
    expect(r.degraded).toBe(true);
  });
});
