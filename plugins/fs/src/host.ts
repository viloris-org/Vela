import {
  BuiltinPermissions,
  CapabilityDeniedError,
  FsMethods,
  normalizeAppRelativePath,
  type CapabilityHost,
  type CapabilityPlugin,
  type FsReadResult,
  type FsWriteResult,
} from "@vela/api";
import { registerFsPermissions } from "./permissions.ts";

function asRecord(args: unknown): Record<string, unknown> {
  if (args !== null && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

function parsePath(args: unknown, method: string): string {
  const o = asRecord(args);
  const path = o.path;
  if (typeof path !== "string") {
    throw new Error(`${method}: path must be a string`);
  }
  const normalized = normalizeAppRelativePath(path);
  if (!normalized.ok) {
    throw new Error(`${method}: ${normalized.reason}`);
  }
  return normalized.path;
}

function parseWriteData(args: unknown): string {
  const o = asRecord(args);
  const data = o.data;
  if (typeof data !== "string") {
    throw new Error("fs.write: data must be a string");
  }
  return data;
}

/**
 * Register `fs.read` / `fs.write` on a CapabilityHost.
 * Requires injected `host.api.sys.fs`. Paths are app-relative; scopes use the
 * normalized relative path as `resource`.
 */
export function registerFsPlugin(host: CapabilityHost): void {
  registerFsPermissions();

  host.handle(FsMethods.read, async (args, ctx): Promise<FsReadResult> => {
    const path = parsePath(args, FsMethods.read);
    ctx.require(BuiltinPermissions.FsAppRead, path);
    const facade = host.api.sys?.fs;
    if (facade === undefined) {
      throw new CapabilityDeniedError(
        "fs.read: host systems facade missing (sys.fs)",
        {
          permission: BuiltinPermissions.FsAppRead,
          method: FsMethods.read,
          resource: path,
        },
      );
    }
    const data = await facade.readText(path);
    return { data };
  });

  host.handle(FsMethods.write, async (args, ctx): Promise<FsWriteResult> => {
    const path = parsePath(args, FsMethods.write);
    const data = parseWriteData(args);
    ctx.require(BuiltinPermissions.FsAppWrite, path);
    const facade = host.api.sys?.fs;
    if (facade === undefined) {
      throw new CapabilityDeniedError(
        "fs.write: host systems facade missing (sys.fs)",
        {
          permission: BuiltinPermissions.FsAppWrite,
          method: FsMethods.write,
          resource: path,
        },
      );
    }
    await facade.writeText(path, data);
    return { ok: true };
  });
}

export const fsPlugin: CapabilityPlugin = {
  name: "fs",
  register: registerFsPlugin,
};
