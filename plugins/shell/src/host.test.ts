import { describe, expect, test } from "bun:test";
import {
  BuiltinPermissions,
  ShellMethods,
  VelaRpcErrorCodes,
} from "@vela/api";
import { createCapabilityHost } from "@vela/host-core";
import { registerShellPlugin } from "./host.ts";
import { createMockShellSys } from "./mock-sys.ts";

describe("@vela/plugin-shell", () => {
  test("allow openExternal with grant", async () => {
    const mock = createMockShellSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { shell: mock.facade },
      },
      capabilities: {
        default: {
          permissions: [BuiltinPermissions.ShellOpenExternal],
        },
      },
    });
    registerShellPlugin(host);

    const result = await host.invoke({
      method: ShellMethods.openExternal,
      args: { url: "https://example.com/docs" },
    });
    expect(result).toEqual({ ok: true });
    expect(mock.opened).toEqual(["https://example.com/docs"]);
  });

  test("deny without shell:open-external", async () => {
    const mock = createMockShellSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { shell: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.ClipboardWrite] },
      },
    });
    registerShellPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "1",
      method: ShellMethods.openExternal,
      args: { url: "https://evil.example" },
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
    expect(mock.opened).toHaveLength(0);
  });

  test("reject file: scheme before OS", async () => {
    const mock = createMockShellSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { shell: mock.facade },
      },
      capabilities: {
        default: {
          permissions: [BuiltinPermissions.ShellOpenExternal],
        },
      },
    });
    registerShellPlugin(host);

    await expect(
      host.invoke({
        method: ShellMethods.openExternal,
        args: { url: "file:///etc/passwd" },
      }),
    ).rejects.toThrow(/scheme not allowed/);
    expect(mock.opened).toHaveLength(0);
  });

  test("reject non-string url", async () => {
    const mock = createMockShellSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { shell: mock.facade },
      },
      capabilities: {
        default: {
          permissions: [BuiltinPermissions.ShellOpenExternal],
        },
      },
    });
    registerShellPlugin(host);

    await expect(
      host.invoke({
        method: ShellMethods.openExternal,
        args: { url: 42 },
      }),
    ).rejects.toThrow(/url must be a string/);
  });

  test("URL scope restricts destination", async () => {
    const mock = createMockShellSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { shell: mock.facade },
      },
      capabilities: {
        default: {
          permissions: [BuiltinPermissions.ShellOpenExternal],
          scopes: [{ type: "url", pattern: "https://allowed.example/**" }],
        },
      },
    });
    registerShellPlugin(host);

    await expect(
      host.invoke({
        method: ShellMethods.openExternal,
        args: { url: "https://other.example/" },
      }),
    ).rejects.toThrow(/denied|scope|capability/i);

    const ok = await host.invoke({
      method: ShellMethods.openExternal,
      args: { url: "https://allowed.example/docs" },
    });
    expect(ok).toEqual({ ok: true });
    expect(mock.opened).toEqual(["https://allowed.example/docs"]);
  });

  test("missing sys.shell fails closed", async () => {
    const host = createCapabilityHost({
      api: { platform: "linux" },
      capabilities: {
        default: {
          permissions: [BuiltinPermissions.ShellOpenExternal],
        },
      },
    });
    registerShellPlugin(host);
    await expect(
      host.invoke({
        method: ShellMethods.openExternal,
        args: { url: "https://example.com" },
      }),
    ).rejects.toThrow(/facade missing/);
  });
});
