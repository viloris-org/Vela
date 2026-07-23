import { describe, expect, test } from "bun:test";
import type { ShellSessionProbe } from "../session/features.ts";
import { planMaterialPaint } from "./paint-plan.ts";

const waylandEmpty: ShellSessionProbe = {
  platform: "linux",
  displayBackend: "wayland",
  features: [],
};

const waylandWithBehind: ShellSessionProbe = {
  platform: "linux",
  displayBackend: "wayland",
  features: ["material.backdrop.window-behind"],
  diagnostics: ["ext_background_effect_manager_v1"],
};

const waylandWithSnapshot: ShellSessionProbe = {
  platform: "linux",
  displayBackend: "wayland",
  features: ["material.backdrop.snapshot"],
};

describe("planMaterialPaint", () => {
  test("Linux without probe → translucent chrome degrade", () => {
    const plan = planMaterialPaint("gtk.blur", "linux", {
      session: waylandEmpty,
    });
    expect(plan.effective).toBe("gtk.blur");
    expect(plan.path).toBe("translucent-chrome");
    expect(plan.degraded).toBe(true);
    expect(plan.reason).toContain("no-backdrop-blur");
  });

  test("Linux window-behind + layers-below samples → compositor path degraded", () => {
    const plan = planMaterialPaint("gtk.blur", "linux", {
      session: waylandWithBehind,
      samples: { type: "layers-below" },
    });
    expect(plan.path).toBe("compositor-window-blur");
    expect(plan.degraded).toBe(true);
    expect(plan.reason).toContain("compositor-window-blur");
  });

  test("Linux window-behind + window-content samples → compositor path", () => {
    const plan = planMaterialPaint("gtk.blur", "linux", {
      session: waylandWithBehind,
      samples: { type: "window-content" },
    });
    expect(plan.path).toBe("compositor-window-blur");
    expect(plan.degraded).toBe(false);
  });

  test("Linux snapshot feature → snapshot-blur", () => {
    const plan = planMaterialPaint("gtk.blur", "linux", {
      session: waylandWithSnapshot,
      samples: { type: "layers-below" },
    });
    expect(plan.path).toBe("snapshot-blur");
    expect(plan.degraded).toBe(true);
  });

  test("macOS liquid glass uses native-system", () => {
    const plan = planMaterialPaint("apple.liquidGlass", "macos", {
      supportsLiquidGlass: true,
    });
    expect(plan.path).toBe("native-system");
    expect(plan.degraded).toBe(false);
  });

  test("fallback.css path", () => {
    const plan = planMaterialPaint("fallback.css", "linux");
    expect(plan.path).toBe("css-fallback");
  });

  test("foreign material maps then plans on Linux", () => {
    const plan = planMaterialPaint("apple.liquidGlass", "linux", {
      session: waylandEmpty,
    });
    expect(plan.effective).toBe("gtk.blur");
    expect(plan.resolved.degraded).toBe(true);
    expect(plan.path).toBe("translucent-chrome");
  });
});
