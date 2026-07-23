import { describe, expect, test } from "bun:test";
import {
  isVelaPackage,
  parseVelaPackage,
  VELA_PACKAGE_MARKER,
  type VelaPackage,
} from "./package.ts";
import {
  DEFAULT_PACKAGE_PARENTS,
  defaultVelaWorkspace,
  parseVelaWorkspace,
  VELA_WORKSPACE_MARKER,
} from "./workspace.ts";

describe("parseVelaPackage", () => {
  test("marker constant", () => {
    expect(VELA_PACKAGE_MARKER).toBe("vela.json");
  });

  test("minimal", () => {
    const r = parseVelaPackage({ schemaVersion: 1, id: "clock" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.package.id).toBe("clock");
      expect(r.package.schemaVersion).toBe(1);
    }
  });

  test("full fields", () => {
    const raw = {
      schemaVersion: 1,
      id: "playground",
      name: "Playground",
      kind: "app",
      version: "0.0.1",
      identifier: "dev.vela.playground",
      dev: { port: 5173, script: "serve" },
      entry: { web: "index.html", scheme: "app" },
    };
    const r = parseVelaPackage(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const p: VelaPackage = r.package;
      expect(p.dev?.port).toBe(5173);
      expect(p.entry?.web).toBe("index.html");
    }
  });

  test("rejects bad id", () => {
    expect(parseVelaPackage({ schemaVersion: 1, id: "9bad" }).ok).toBe(false);
    expect(parseVelaPackage({ schemaVersion: 1, id: "" }).ok).toBe(false);
  });

  test("rejects bad schema", () => {
    expect(parseVelaPackage({ schemaVersion: 2, id: "x" }).ok).toBe(false);
    expect(isVelaPackage({ schemaVersion: 1, id: "ok" })).toBe(true);
  });
});

describe("parseVelaWorkspace", () => {
  test("marker and defaults", () => {
    expect(VELA_WORKSPACE_MARKER).toBe("vela.workspace.json");
    expect(defaultVelaWorkspace().packageParents).toEqual([...DEFAULT_PACKAGE_PARENTS]);
  });

  test("accepts parents", () => {
    const r = parseVelaWorkspace({
      schemaVersion: 1,
      packageParents: ["apps", "example", "demos"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.workspace.packageParents).toEqual(["apps", "example", "demos"]);
    }
  });

  test("rejects .. and absolute", () => {
    expect(
      parseVelaWorkspace({ schemaVersion: 1, packageParents: ["../evil"] }).ok,
    ).toBe(false);
    expect(
      parseVelaWorkspace({ schemaVersion: 1, packageParents: ["/abs"] }).ok,
    ).toBe(false);
  });
});
