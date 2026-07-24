import { describe, expect, test } from "bun:test";
import { FsMethods, normalizeAppRelativePath } from "./fs.ts";

describe("normalizeAppRelativePath", () => {
  test("accepts simple relative paths", () => {
    expect(normalizeAppRelativePath("notes.txt")).toEqual({
      ok: true,
      path: "notes.txt",
    });
    expect(normalizeAppRelativePath("a/b/c.txt")).toEqual({
      ok: true,
      path: "a/b/c.txt",
    });
  });

  test("collapses . and redundant slashes", () => {
    expect(normalizeAppRelativePath("./a/./b//c")).toEqual({
      ok: true,
      path: "a/b/c",
    });
  });

  test("allows .. within sandbox", () => {
    expect(normalizeAppRelativePath("a/b/../c")).toEqual({
      ok: true,
      path: "a/c",
    });
  });

  test("rejects escape via ..", () => {
    const r = normalizeAppRelativePath("../secret");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/escapes/);
  });

  test("rejects absolute and drive paths", () => {
    expect(normalizeAppRelativePath("/etc/passwd").ok).toBe(false);
    expect(normalizeAppRelativePath("~/x").ok).toBe(false);
    expect(normalizeAppRelativePath("C:/Windows").ok).toBe(false);
    expect(normalizeAppRelativePath("//server/share").ok).toBe(false);
  });

  test("rejects empty / null / root-only", () => {
    expect(normalizeAppRelativePath("").ok).toBe(false);
    expect(normalizeAppRelativePath(".").ok).toBe(false);
    expect(normalizeAppRelativePath("./").ok).toBe(false);
    expect(normalizeAppRelativePath("a\0b").ok).toBe(false);
  });

  test("normalizes backslashes to forward", () => {
    expect(normalizeAppRelativePath("a\\b\\c")).toEqual({
      ok: true,
      path: "a/b/c",
    });
  });
});

describe("FsMethods", () => {
  test("stable method names", () => {
    expect(FsMethods.read).toBe("fs.read");
    expect(FsMethods.write).toBe("fs.write");
  });
});
