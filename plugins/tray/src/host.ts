import {
  BuiltinPermissions,
  CapabilityDeniedError,
  TrayMethods,
  type CapabilityHost,
  type CapabilityPlugin,
  type TrayCreateOptions,
  type TrayCreateResult,
  type TrayMenuItem,
  type TrayRemoveOptions,
  type TrayUpdateOptions,
} from "@vela/api";
import { registerTrayPermissions } from "./permissions.ts";

function asRecord(args: unknown): Record<string, unknown> {
  if (args !== null && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

function parseMenuItem(raw: unknown): TrayMenuItem {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tray: menu item must be an object");
  }
  const o = raw as Record<string, unknown>;
  if (o.type === "separator") {
    return { type: "separator" };
  }
  if (o.type === "item" || o.type === undefined) {
    const id = o.id;
    const label = o.label;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error("tray: menu item id must be a non-empty string");
    }
    if (typeof label !== "string") {
      throw new Error("tray: menu item label must be a string");
    }
    return {
      type: "item",
      id,
      label,
      ...(typeof o.enabled === "boolean" ? { enabled: o.enabled } : {}),
      ...(typeof o.checked === "boolean" ? { checked: o.checked } : {}),
    };
  }
  throw new Error(`tray: unknown menu item type ${String(o.type)}`);
}

function parseMenu(raw: unknown): readonly TrayMenuItem[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new Error("tray: menu must be an array");
  }
  return raw.map(parseMenuItem);
}

function parseCreateOptions(args: unknown): TrayCreateOptions {
  const o = asRecord(args);
  const menu = parseMenu(o.menu);
  return {
    ...(typeof o.id === "string" && o.id.length > 0 ? { id: o.id } : {}),
    ...(typeof o.tooltip === "string" ? { tooltip: o.tooltip } : {}),
    ...(typeof o.icon === "string" ? { icon: o.icon } : {}),
    ...(menu !== undefined ? { menu } : {}),
  };
}

function parseUpdateOptions(args: unknown): TrayUpdateOptions {
  const o = asRecord(args);
  const id = o.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("tray.update: id must be a non-empty string");
  }
  const menu = parseMenu(o.menu);
  return {
    id,
    ...(typeof o.tooltip === "string" ? { tooltip: o.tooltip } : {}),
    ...(typeof o.icon === "string" ? { icon: o.icon } : {}),
    ...(menu !== undefined ? { menu } : {}),
  };
}

function parseRemoveOptions(args: unknown): TrayRemoveOptions {
  const o = asRecord(args);
  const id = o.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("tray.remove: id must be a non-empty string");
  }
  return { id };
}

/**
 * Register `tray.create` / `tray.update` / `tray.remove`.
 * Requires injected `host.api.sys.tray`. Desktop-only at the facade layer.
 */
export function registerTrayPlugin(host: CapabilityHost): void {
  registerTrayPermissions();

  host.handle(TrayMethods.create, async (args, ctx): Promise<TrayCreateResult> => {
    ctx.require(BuiltinPermissions.TrayManage);
    const options = parseCreateOptions(args);
    const facade = host.api.sys?.tray;
    if (facade === undefined) {
      throw new CapabilityDeniedError(
        "tray.create: host systems facade missing (sys.tray)",
        {
          permission: BuiltinPermissions.TrayManage,
          method: TrayMethods.create,
        },
      );
    }
    return await facade.create(options);
  });

  host.handle(TrayMethods.update, async (args, ctx): Promise<{ ok: true }> => {
    ctx.require(BuiltinPermissions.TrayManage);
    const options = parseUpdateOptions(args);
    const facade = host.api.sys?.tray;
    if (facade === undefined) {
      throw new CapabilityDeniedError(
        "tray.update: host systems facade missing (sys.tray)",
        {
          permission: BuiltinPermissions.TrayManage,
          method: TrayMethods.update,
        },
      );
    }
    const { id, ...patch } = options;
    await facade.update(id, patch);
    return { ok: true };
  });

  host.handle(TrayMethods.remove, async (args, ctx): Promise<{ ok: true }> => {
    ctx.require(BuiltinPermissions.TrayManage);
    const { id } = parseRemoveOptions(args);
    const facade = host.api.sys?.tray;
    if (facade === undefined) {
      throw new CapabilityDeniedError(
        "tray.remove: host systems facade missing (sys.tray)",
        {
          permission: BuiltinPermissions.TrayManage,
          method: TrayMethods.remove,
        },
      );
    }
    await facade.remove(id);
    return { ok: true };
  });
}

export const trayPlugin: CapabilityPlugin = {
  name: "tray",
  register: registerTrayPlugin,
};
