import {
  BuiltinPermissions,
  CapabilityDeniedError,
  DialogMethods,
  type CapabilityHost,
  type CapabilityPlugin,
  type DialogFilter,
  type DialogOpenOptions,
  type DialogOpenResult,
  type DialogSaveOptions,
  type DialogSaveResult,
} from "@vela/api";
import { registerDialogPermissions } from "./permissions.ts";

function asRecord(args: unknown): Record<string, unknown> {
  if (args !== null && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

function parseFilter(raw: unknown, method: string): DialogFilter {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${method}: filter must be an object`);
  }
  const o = raw as Record<string, unknown>;
  const name = o.name;
  if (typeof name !== "string" || name.length === 0) {
    throw new Error(`${method}: filter.name must be a non-empty string`);
  }
  if (!Array.isArray(o.extensions)) {
    throw new Error(`${method}: filter.extensions must be an array`);
  }
  const extensions: string[] = [];
  for (const ext of o.extensions) {
    if (typeof ext !== "string" || ext.length === 0) {
      throw new Error(`${method}: filter.extensions entries must be non-empty strings`);
    }
    // Normalize: strip leading dots so hosts share one convention.
    extensions.push(ext.startsWith(".") ? ext.slice(1) : ext);
  }
  if (extensions.length === 0) {
    throw new Error(`${method}: filter.extensions must not be empty`);
  }
  return { name, extensions };
}

function parseFilters(
  raw: unknown,
  method: string,
): readonly DialogFilter[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new Error(`${method}: filters must be an array`);
  }
  return raw.map((f) => parseFilter(f, method));
}

function parseOpenOptions(args: unknown): DialogOpenOptions {
  const o = asRecord(args);
  const filters = parseFilters(o.filters, "dialog.open");
  return {
    ...(typeof o.title === "string" ? { title: o.title } : {}),
    ...(typeof o.defaultPath === "string" ? { defaultPath: o.defaultPath } : {}),
    ...(filters !== undefined ? { filters } : {}),
    ...(typeof o.multiple === "boolean" ? { multiple: o.multiple } : {}),
    ...(typeof o.directory === "boolean" ? { directory: o.directory } : {}),
  };
}

function parseSaveOptions(args: unknown): DialogSaveOptions {
  const o = asRecord(args);
  const filters = parseFilters(o.filters, "dialog.save");
  return {
    ...(typeof o.title === "string" ? { title: o.title } : {}),
    ...(typeof o.defaultPath === "string" ? { defaultPath: o.defaultPath } : {}),
    ...(filters !== undefined ? { filters } : {}),
    ...(typeof o.defaultName === "string" ? { defaultName: o.defaultName } : {}),
  };
}

/**
 * Register `dialog.open` / `dialog.save` on a CapabilityHost.
 * Requires injected `host.api.sys.dialog`. Desktop-oriented at the facade layer.
 */
export function registerDialogPlugin(host: CapabilityHost): void {
  registerDialogPermissions();

  host.handle(DialogMethods.open, async (args, ctx): Promise<DialogOpenResult> => {
    ctx.require(BuiltinPermissions.DialogOpen);
    const options = parseOpenOptions(args);
    const facade = host.api.sys?.dialog;
    if (facade === undefined) {
      throw new CapabilityDeniedError(
        "dialog.open: host systems facade missing (sys.dialog)",
        {
          permission: BuiltinPermissions.DialogOpen,
          method: DialogMethods.open,
        },
      );
    }
    return await facade.open(options);
  });

  host.handle(DialogMethods.save, async (args, ctx): Promise<DialogSaveResult> => {
    ctx.require(BuiltinPermissions.DialogSave);
    const options = parseSaveOptions(args);
    const facade = host.api.sys?.dialog;
    if (facade === undefined) {
      throw new CapabilityDeniedError(
        "dialog.save: host systems facade missing (sys.dialog)",
        {
          permission: BuiltinPermissions.DialogSave,
          method: DialogMethods.save,
        },
      );
    }
    return await facade.save(options);
  });
}

export const dialogPlugin: CapabilityPlugin = {
  name: "dialog",
  register: registerDialogPlugin,
};
