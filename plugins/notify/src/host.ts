import {
  BuiltinPermissions,
  CapabilityDeniedError,
  NotifyMethods,
  type CapabilityHost,
  type CapabilityPlugin,
  type NotifyCloseOptions,
  type NotifyShowOptions,
  type NotifyShowResult,
} from "@vela/api";
import { registerNotifyPermissions } from "./permissions.ts";

function asRecord(args: unknown): Record<string, unknown> {
  if (args !== null && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

function parseShowOptions(args: unknown): NotifyShowOptions {
  const o = asRecord(args);
  const title = o.title;
  if (typeof title !== "string" || title.length === 0) {
    throw new Error("notify.show: title must be a non-empty string");
  }
  return {
    title,
    ...(typeof o.body === "string" ? { body: o.body } : {}),
    ...(typeof o.id === "string" && o.id.length > 0 ? { id: o.id } : {}),
    ...(typeof o.icon === "string" ? { icon: o.icon } : {}),
    ...(typeof o.silent === "boolean" ? { silent: o.silent } : {}),
  };
}

function parseCloseOptions(args: unknown): NotifyCloseOptions {
  const o = asRecord(args);
  const id = o.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("notify.close: id must be a non-empty string");
  }
  return { id };
}

/**
 * Register `notify.show` / `notify.close` on a CapabilityHost.
 * Requires injected `host.api.sys.notify` for real delivery.
 */
export function registerNotifyPlugin(host: CapabilityHost): void {
  registerNotifyPermissions();

  host.handle(NotifyMethods.show, async (args, ctx): Promise<NotifyShowResult> => {
    ctx.require(BuiltinPermissions.NotifyShow);
    const options = parseShowOptions(args);
    const facade = host.api.sys?.notify;
    if (facade === undefined) {
      throw new CapabilityDeniedError(
        "notify.show: host systems facade missing (sys.notify)",
        {
          permission: BuiltinPermissions.NotifyShow,
          method: NotifyMethods.show,
        },
      );
    }
    return await facade.show(options);
  });

  host.handle(NotifyMethods.close, async (args, ctx): Promise<{ ok: true }> => {
    ctx.require(BuiltinPermissions.NotifyShow);
    const { id } = parseCloseOptions(args);
    const facade = host.api.sys?.notify;
    if (facade === undefined || facade.close === undefined) {
      throw new CapabilityDeniedError(
        "notify.close: host systems facade missing (sys.notify.close)",
        {
          permission: BuiltinPermissions.NotifyShow,
          method: NotifyMethods.close,
        },
      );
    }
    await facade.close(id);
    return { ok: true };
  });
}

export const notifyPlugin: CapabilityPlugin = {
  name: "notify",
  register: registerNotifyPlugin,
};
