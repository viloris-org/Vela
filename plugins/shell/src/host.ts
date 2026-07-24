import {
  BuiltinPermissions,
  CapabilityDeniedError,
  ShellMethods,
  parseExternalUrl,
  type CapabilityHost,
  type CapabilityPlugin,
  type ShellOpenExternalResult,
} from "@vela/api";
import { registerShellPermissions } from "./permissions.ts";

function asRecord(args: unknown): Record<string, unknown> {
  if (args !== null && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

function parseUrlArg(args: unknown): string {
  const o = asRecord(args);
  const url = o.url;
  if (typeof url !== "string") {
    throw new Error("shell.openExternal: url must be a string");
  }
  const parsed = parseExternalUrl(url);
  if (!parsed.ok) {
    throw new Error(`shell.openExternal: ${parsed.reason}`);
  }
  return parsed.href;
}

/**
 * Register `shell.openExternal` on a CapabilityHost.
 * Requires injected `host.api.sys.shell`.
 * URL is validated (http/https/mailto) then passed as the capability resource
 * so manifest URL scopes can further restrict destinations.
 */
export function registerShellPlugin(host: CapabilityHost): void {
  registerShellPermissions();

  host.handle(
    ShellMethods.openExternal,
    async (args, ctx): Promise<ShellOpenExternalResult> => {
      const href = parseUrlArg(args);
      ctx.require(BuiltinPermissions.ShellOpenExternal, href);
      const facade = host.api.sys?.shell;
      if (facade === undefined) {
        throw new CapabilityDeniedError(
          "shell.openExternal: host systems facade missing (sys.shell)",
          {
            permission: BuiltinPermissions.ShellOpenExternal,
            method: ShellMethods.openExternal,
            resource: href,
          },
        );
      }
      await facade.openExternal(href);
      return { ok: true };
    },
  );
}

export const shellPlugin: CapabilityPlugin = {
  name: "shell",
  register: registerShellPlugin,
};
