import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDesktopFsSys, resolveUnderRoot } from "./index.ts";

describe("resolveUnderRoot", () => {
  test("joins under root", () => {
    const full = resolveUnderRoot("/tmp/app-data", "notes/a.txt");
    expect(full).toBe(join("/tmp/app-data", "notes/a.txt"));
  });

  test("rejects escape", () => {
    expect(() => resolveUnderRoot("/tmp/app-data", "../etc/passwd")).toThrow(
      /escapes|sandbox/i,
    );
  });
});

describe("createDesktopFsSys", () => {
  test("round-trip write + read under sandbox", async () => {
    const root = await mkdtemp(join(tmpdir(), "vela-fs-"));
    try {
      const fs = createDesktopFsSys({ root });
      await fs.writeText("notes/hello.txt", "hi");
      expect(await fs.readText("notes/hello.txt")).toBe("hi");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("missing file throws", async () => {
    const root = await mkdtemp(join(tmpdir(), "vela-fs-"));
    try {
      const fs = createDesktopFsSys({ root });
      await expect(fs.readText("nope.txt")).rejects.toThrow(/not found/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
