import { describe, expect, test } from "bun:test";
import {
  isAppManifest,
  parseAppManifest,
  type AppManifest,
} from "./types.ts";

describe("parseAppManifest", () => {
  test("accepts minimal valid manifest", () => {
    const r = parseAppManifest({
      schemaVersion: 1,
      name: "Clock",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.name).toBe("Clock");
      expect(r.manifest.schemaVersion).toBe(1);
    }
  });

  test("accepts capabilities, windows, entry", () => {
    const raw = {
      schemaVersion: 1,
      name: "Playground",
      version: "0.0.1",
      identifier: "dev.vela.playground",
      capabilities: {
        default: {
          permissions: ["clipboard:write", "notify:show", "window:material"],
        },
        camera: {
          permissions: ["camera:preview"],
          scopes: [{ type: "path", pattern: "app-data/**" }],
        },
      },
      windows: [
        {
          id: "main",
          title: "Playground",
          preloadProfile: "default",
          size: { width: 960, height: 640 },
          chrome: "system",
        },
      ],
      entry: { web: "dist/index.html", scheme: "app" },
    };
    const r = parseAppManifest(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const m: AppManifest = r.manifest;
      expect(m.capabilities?.default?.permissions).toContain("clipboard:write");
      expect(m.capabilities?.camera?.scopes?.[0]?.pattern).toBe("app-data/**");
      expect(m.windows?.[0]?.size?.width).toBe(960);
      expect(m.entry?.scheme).toBe("app");
    }
    expect(isAppManifest(raw)).toBe(true);
  });

  test("rejects wrong schemaVersion", () => {
    const r = parseAppManifest({ schemaVersion: 2, name: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/schemaVersion/);
    }
  });

  test("rejects empty name", () => {
    const r = parseAppManifest({ schemaVersion: 1, name: "  " });
    expect(r.ok).toBe(false);
  });

  test("rejects invalid permission id", () => {
    const r = parseAppManifest({
      schemaVersion: 1,
      name: "x",
      capabilities: {
        default: { permissions: ["not a permission"] },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/permission id/i);
    }
  });

  test("rejects bad scopes type", () => {
    const r = parseAppManifest({
      schemaVersion: 1,
      name: "x",
      capabilities: {
        default: {
          permissions: ["fs:app-read"],
          scopes: [{ type: "glob", pattern: "*" }],
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  test("round-trips JSON", () => {
    const raw = {
      schemaVersion: 1,
      name: "Clock",
      capabilities: {
        default: { permissions: ["clipboard:write"] },
      },
    };
    const r = parseAppManifest(JSON.parse(JSON.stringify(raw)));
    expect(r.ok).toBe(true);
  });
});
