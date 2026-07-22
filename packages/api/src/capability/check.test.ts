import { describe, expect, test } from "bun:test";
import {
  matchPathPattern,
  matchUrlPattern,
  scopesAllowResource,
} from "./match-scope.ts";
import {
  checkCapability,
  checkProfileCapability,
  grantForProfile,
} from "./check.ts";
import {
  insertLayerPermissionsGranted,
  permissionsForInsertLayer,
} from "./layer-gates.ts";
import { CapabilityDeniedError } from "./host.ts";
import { BuiltinPermissions } from "./types.ts";

describe("matchPathPattern", () => {
  test("exact match", () => {
    expect(matchPathPattern("app-data/a.txt", "app-data/a.txt")).toBe(true);
    expect(matchPathPattern("app-data/a.txt", "app-data/b.txt")).toBe(false);
  });

  test("single-segment *", () => {
    expect(matchPathPattern("app-data/*", "app-data/a.txt")).toBe(true);
    expect(matchPathPattern("app-data/*", "app-data/nested/a.txt")).toBe(
      false,
    );
  });

  test("** suffix", () => {
    expect(matchPathPattern("app-data/**", "app-data/a.txt")).toBe(true);
    expect(matchPathPattern("app-data/**", "app-data/nested/a.txt")).toBe(
      true,
    );
    expect(matchPathPattern("app-data/**", "other/a.txt")).toBe(false);
  });
});

describe("matchUrlPattern", () => {
  test("https host path with *", () => {
    expect(
      matchUrlPattern(
        "https://api.example.com/*",
        "https://api.example.com/v1",
      ),
    ).toBe(true);
    expect(
      matchUrlPattern(
        "https://api.example.com/*",
        "https://api.example.com/v1/x",
      ),
    ).toBe(false);
  });
});

describe("scopesAllowResource", () => {
  test("no scopes always allow", () => {
    expect(scopesAllowResource(undefined, undefined)).toBe(true);
    expect(scopesAllowResource([], "x")).toBe(true);
  });

  test("scoped grant requires resource", () => {
    expect(
      scopesAllowResource([{ type: "path", pattern: "app-data/**" }], undefined),
    ).toBe(false);
  });

  test("at least one scope match", () => {
    const scopes = [
      { type: "path" as const, pattern: "app-data/**" },
      { type: "path" as const, pattern: "cache/*" },
    ];
    expect(scopesAllowResource(scopes, "app-data/x/y")).toBe(true);
    expect(scopesAllowResource(scopes, "cache/a")).toBe(true);
    expect(scopesAllowResource(scopes, "secret/a")).toBe(false);
  });
});

describe("checkCapability", () => {
  test("default deny without grant", () => {
    const r = checkCapability(undefined, {
      permission: BuiltinPermissions.ClipboardWrite,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/no capability grant/i);
  });

  test("allow when permission listed", () => {
    const r = checkCapability(
      { permissions: [BuiltinPermissions.ClipboardWrite] },
      { permission: BuiltinPermissions.ClipboardWrite },
    );
    expect(r).toEqual({ allowed: true });
  });

  test("deny when permission missing", () => {
    const r = checkCapability(
      { permissions: [BuiltinPermissions.NotifyShow] },
      { permission: BuiltinPermissions.ClipboardWrite },
    );
    expect(r.allowed).toBe(false);
  });

  test("scope miss denies", () => {
    const r = checkCapability(
      {
        permissions: [BuiltinPermissions.FsAppRead],
        scopes: [{ type: "path", pattern: "app-data/**" }],
      },
      {
        permission: BuiltinPermissions.FsAppRead,
        resource: "/etc/passwd",
      },
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/out of scope/i);
  });

  test("scope hit allows", () => {
    const r = checkCapability(
      {
        permissions: [BuiltinPermissions.FsAppRead],
        scopes: [{ type: "path", pattern: "app-data/**" }],
      },
      {
        permission: BuiltinPermissions.FsAppRead,
        resource: "app-data/notes.txt",
      },
    );
    expect(r.allowed).toBe(true);
  });
});

describe("grantForProfile / checkProfileCapability", () => {
  const caps = {
    default: {
      permissions: [BuiltinPermissions.ClipboardWrite],
    },
    camera: {
      permissions: [BuiltinPermissions.CameraPreview],
    },
  };

  test("defaults to default profile", () => {
    expect(grantForProfile(caps, undefined)?.permissions).toContain(
      BuiltinPermissions.ClipboardWrite,
    );
    const r = checkProfileCapability(
      caps,
      undefined,
      BuiltinPermissions.ClipboardWrite,
    );
    expect(r.allowed).toBe(true);
  });

  test("named profile isolation", () => {
    expect(
      checkProfileCapability(
        caps,
        "default",
        BuiltinPermissions.CameraPreview,
      ).allowed,
    ).toBe(false);
    expect(
      checkProfileCapability(
        caps,
        "camera",
        BuiltinPermissions.CameraPreview,
      ).allowed,
    ).toBe(true);
  });
});

describe("layer insert gates", () => {
  test("material requires window:material", () => {
    const req = permissionsForInsertLayer({
      kind: "material",
      material: "apple.liquidGlass",
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      zIndex: 1,
    });
    expect(req).toEqual([BuiltinPermissions.WindowMaterial]);
    expect(insertLayerPermissionsGranted([], req)).toBe(false);
    expect(
      insertLayerPermissionsGranted(
        [BuiltinPermissions.WindowMaterial],
        req,
      ),
    ).toBe(true);
  });

  test("camera.preview is well-known", () => {
    const req = permissionsForInsertLayer({
      kind: "native",
      component: "camera.preview",
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      zIndex: 1,
    });
    expect(req).toEqual([BuiltinPermissions.CameraPreview]);
  });

  test("webview insert has no gate", () => {
    expect(
      permissionsForInsertLayer({
        kind: "webview",
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        zIndex: 0,
      }),
    ).toEqual([]);
  });
});

describe("CapabilityDeniedError", () => {
  test("carries capability.denied code", () => {
    const err = new CapabilityDeniedError("missing", {
      permission: BuiltinPermissions.FsAppRead,
      method: "fs.read",
    });
    expect(err.code).toBe("capability.denied");
    expect(err.permission).toBe(BuiltinPermissions.FsAppRead);
    expect(err.method).toBe("fs.read");
  });
});
