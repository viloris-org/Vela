import { describe, expect, test } from "bun:test";
import {
  emptySessionProbe,
  hasSessionFeature,
  type ShellSessionProbe,
} from "./features.ts";

describe("ShellSessionProbe helpers", () => {
  test("empty probe has no features", () => {
    const p = emptySessionProbe("linux", "wayland");
    expect(p.platform).toBe("linux");
    expect(p.displayBackend).toBe("wayland");
    expect(p.features).toEqual([]);
    expect(hasSessionFeature(p, "material.backdrop.window-behind")).toBe(false);
  });

  test("hasSessionFeature matches listed features", () => {
    const p: ShellSessionProbe = {
      platform: "linux",
      displayBackend: "wayland",
      features: [
        "material.backdrop.window-behind",
        "window.fractional-scale",
      ],
      diagnostics: ["ext_background_effect_manager_v1"],
    };
    expect(hasSessionFeature(p, "material.backdrop.window-behind")).toBe(true);
    expect(hasSessionFeature(p, "window.fractional-scale")).toBe(true);
    expect(hasSessionFeature(p, "window.input-region")).toBe(false);
    expect(hasSessionFeature(null, "window.alpha")).toBe(false);
  });
});
