import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "./args";
import {
  DEMO_DEFAULT_PORT,
  contentPortEnv,
  discoverDemos,
  findNearestPackageRoot,
  formatDemoList,
  loadPackageRoot,
  loadWorkspace,
  matchDemo,
  resolveExternalTarget,
  workspaceTargetFromDemo,
} from "./discover";
import { join as pathJoin } from "node:path";
import { repoRoot } from "./paths";

describe("parseArgs", () => {
  test("dev defaults (no hardcoded app)", () => {
    const p = parseArgs(["dev"]);
    expect(p.command).toBe("dev");
    expect(p.dev.app).toBeUndefined();
    expect(p.dev.script).toBe("serve");
    expect(p.dev.scriptExplicit).toBe(false);
    expect(p.dev.dir).toBeUndefined();
    expect(p.dev.list).toBe(false);
  });

  test("dev flags", () => {
    const p = parseArgs([
      "dev",
      "--app",
      "playground",
      "--browser",
      "--port",
      "5199",
      "--no-build",
    ]);
    expect(p.dev.app).toBe("playground");
    expect(p.dev.browser).toBe(true);
    expect(p.dev.port).toBe(5199);
    expect(p.dev.noBuild).toBe(true);
  });

  test("script explicit", () => {
    const p = parseArgs(["dev", "--dir=../Z", "--script=dev"]);
    expect(p.dev.scriptExplicit).toBe(true);
    expect(p.dev.script).toBe("dev");
  });

  test("rejects --app with --dir", () => {
    expect(() => parseArgs(["dev", "--app", "clock", "--dir", "../Z"])).toThrow(
      /mutually exclusive/,
    );
  });

  test("rejects --script without --dir", () => {
    expect(() => parseArgs(["dev", "--script", "dev"])).toThrow(/--script requires --dir/);
  });

  test("platform flag defaults to auto", () => {
    const p = parseArgs(["dev"]);
    expect(p.dev.platform).toBe("auto");
  });

  test("platform flag parses", () => {
    expect(parseArgs(["dev", "--platform", "macos"]).dev.platform).toBe("macos");
    expect(parseArgs(["dev", "--platform=windows"]).dev.platform).toBe("windows");
  });

  test("rejects bad platform", () => {
    expect(() => parseArgs(["dev", "--platform", "amiga"])).toThrow(/platform/);
  });
});

describe("shell paths", () => {
  test("detectShellPlatform maps node platforms", async () => {
    const {
      detectShellPlatform,
      resolveShellPlatform,
      defaultShellBinary,
      shellDir,
    } = await import("./paths");
    expect(detectShellPlatform("linux")).toBe("linux");
    expect(detectShellPlatform("darwin")).toBe("macos");
    expect(detectShellPlatform("win32")).toBe("windows");
    expect(resolveShellPlatform("auto", "darwin")).toBe("macos");
    expect(resolveShellPlatform("linux", "darwin")).toBe("linux");
    expect(shellDir("macos")).toMatch(/hosts\/desktop-shell$/);
    expect(defaultShellBinary("linux")).toMatch(/vela-linux-shell$/);
    expect(defaultShellBinary("macos")).toMatch(/vela-desktop-shell$/);
    expect(defaultShellBinary("windows")).toMatch(/vela-windows-shell\.exe$/);
  });
});

describe("workspace + package layout (repo)", () => {
  test("findNearestPackageRoot from example/clock", () => {
    const clock = pathJoin(repoRoot(), "example", "clock");
    const found = findNearestPackageRoot(clock);
    expect(found).toBe(clock);
    // from a nested path
    expect(findNearestPackageRoot(pathJoin(clock, "src"))).toBe(clock);
  });

  test("findNearestPackageRoot from monorepo root is null", () => {
    // monorepo root has vela.workspace.json but not vela.json
    expect(findNearestPackageRoot(repoRoot())).toBeNull();
  });

  test("loadWorkspace reads vela.workspace.json", () => {
    const ws = loadWorkspace(repoRoot());
    expect(ws.packageParents).toContain("apps");
    expect(ws.packageParents).toContain("example");
  });

  test("discover finds packages with vela.json only", () => {
    const demos = discoverDemos();
    const ids = demos.map((d) => d.id).sort();
    expect(ids).toContain("clock");
    expect(ids).toContain("playground");

    const clock = demos.find((d) => d.id === "clock")!;
    expect(clock.defaultPort).toBe(5174);
    expect(clock.envPortKey).toBe("CLOCK_PORT");
    expect(clock.script).toBe("serve");
    expect(clock.vela.entry?.web).toBe("index.html");
  });

  test("matchDemo by id / package / number", () => {
    const demos = discoverDemos();
    expect(matchDemo(demos, "clock")?.id).toBe("clock");
    expect(matchDemo(demos, "@vela/playground")?.id).toBe("playground");
    expect(matchDemo(demos, "1")).toEqual(demos[0]);
    expect(formatDemoList(demos)).toContain("vela.json".length >= 0 ? "clock" : "");
  });
});

describe("loadPackageRoot / external", () => {
  test("requires vela.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "vela-pkg-"));
    try {
      expect(() => loadPackageRoot(dir)).toThrow(/vela\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("loads valid external package", () => {
    const dir = mkdtempSync(join(tmpdir(), "vela-pkg-"));
    try {
      writeFileSync(
        join(dir, "vela.json"),
        JSON.stringify({
          schemaVersion: 1,
          id: "zepyyr",
          dev: { port: 5191, script: "dev" },
        }),
      );
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "zepyyr" }));
      const demo = loadPackageRoot(dir);
      expect(demo.id).toBe("zepyyr");
      expect(demo.defaultPort).toBe(5191);
      expect(demo.script).toBe("dev");

      const t = resolveExternalTarget(dir);
      expect(t.kind).toBe("external");
      expect(t.script).toBe("dev");
      expect(contentPortEnv(5191, t).ZEPYYR_PORT).toBe("5191");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("fixture tree discovery", () => {
    const root = mkdtempSync(join(tmpdir(), "vela-ws-"));
    try {
      mkdirSync(join(root, "apps", "a"), { recursive: true });
      mkdirSync(join(root, "example", "b"), { recursive: true });
      mkdirSync(join(root, "example", "orphan"), { recursive: true });
      writeFileSync(
        join(root, "vela.workspace.json"),
        JSON.stringify({ schemaVersion: 1, packageParents: ["apps", "example"] }),
      );
      writeFileSync(
        join(root, "apps", "a", "vela.json"),
        JSON.stringify({ schemaVersion: 1, id: "a", dev: { port: DEMO_DEFAULT_PORT } }),
      );
      writeFileSync(
        join(root, "example", "b", "vela.json"),
        JSON.stringify({ schemaVersion: 1, id: "b", dev: { port: DEMO_DEFAULT_PORT } }),
      );
      // orphan: package.json only — not a package
      writeFileSync(
        join(root, "example", "orphan", "package.json"),
        JSON.stringify({ name: "orphan", scripts: { serve: "x" } }),
      );

      const demos = discoverDemos(root);
      expect(demos.map((d) => d.id).sort()).toEqual(["a", "b"]);
      // port collision resolution
      expect(new Set(demos.map((d) => d.defaultPort)).size).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("workspace target", () => {
    const demos = discoverDemos();
    const clock = demos.find((d) => d.id === "clock")!;
    const t = workspaceTargetFromDemo(clock);
    expect(t.kind).toBe("workspace");
    expect(t.dir).toBe(clock.dir);
    expect(contentPortEnv(5199, t).CLOCK_PORT).toBe("5199");
  });
});
