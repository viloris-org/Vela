import {
  BuiltinPermissions,
  CapabilityDeniedError,
  ClipboardMethods,
  type CapabilityHost,
  type CapabilityPlugin,
  type ClipboardReadResult,
  type ClipboardWriteResult,
} from "@vela/api";
import { registerClipboardPermissions } from "./permissions.ts";

function asRecord(args: unknown): Record<string, unknown> {
  if (args !== null && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

function parseWriteOptions(args: unknown): string {
  const o = asRecord(args);
  const text = o.text;
  if (typeof text !== "string") {
    throw new Error("clipboard.write: text must be a string");
  }
  return text;
}

/**
 * Register `clipboard.read` / `clipboard.write` on a CapabilityHost.
 * Requires injected `host.api.sys.clipboard`.
 */
export function registerClipboardPlugin(host: CapabilityHost): void {
  registerClipboardPermissions();

  host.handle(
    ClipboardMethods.read,
    async (_args, ctx): Promise<ClipboardReadResult> => {
      ctx.require(BuiltinPermissions.ClipboardRead);
      const facade = host.api.sys?.clipboard;
      if (facade === undefined) {
        throw new CapabilityDeniedError(
          "clipboard.read: host systems facade missing (sys.clipboard)",
          {
            permission: BuiltinPermissions.ClipboardRead,
            method: ClipboardMethods.read,
          },
        );
      }
      const text = await facade.readText();
      return { text };
    },
  );

  host.handle(
    ClipboardMethods.write,
    async (args, ctx): Promise<ClipboardWriteResult> => {
      ctx.require(BuiltinPermissions.ClipboardWrite);
      const text = parseWriteOptions(args);
      const facade = host.api.sys?.clipboard;
      if (facade === undefined) {
        throw new CapabilityDeniedError(
          "clipboard.write: host systems facade missing (sys.clipboard)",
          {
            permission: BuiltinPermissions.ClipboardWrite,
            method: ClipboardMethods.write,
          },
        );
      }
      await facade.writeText(text);
      return { ok: true };
    },
  );
}

export const clipboardPlugin: CapabilityPlugin = {
  name: "clipboard",
  register: registerClipboardPlugin,
};
