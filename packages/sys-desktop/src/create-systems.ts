import type { HostEventBus, HostSystemsFacade, PlatformId } from "@vela/api";
import {
  detectDesktopPlatform,
  type DesktopPlatform,
  isDesktopPlatform,
} from "./platform.ts";
import {
  createDesktopNotifySys,
  type CreateDesktopNotifySysOptions,
} from "./notify/index.ts";
import {
  createDesktopTraySys,
  type CreateDesktopTraySysOptions,
  type DesktopTraySys,
} from "./tray/index.ts";
import {
  createDesktopDialogSys,
  type CreateDesktopDialogSysOptions,
} from "./dialog/index.ts";
import {
  createDesktopClipboardSys,
  type CreateDesktopClipboardSysOptions,
} from "./clipboard/index.ts";
import {
  createDesktopFsSys,
  type CreateDesktopFsSysOptions,
} from "./fs/index.ts";
import {
  createDesktopShellSys,
  type CreateDesktopShellSysOptions,
} from "./shell/index.ts";
import type { RunCommand } from "./run.ts";

export type CreateDesktopSystemsOptions = {
  readonly platform?: DesktopPlatform | PlatformId | "auto";
  readonly run?: RunCommand;
  readonly events?: HostEventBus;
  readonly appName?: string;
  readonly notify?: CreateDesktopNotifySysOptions;
  readonly tray?: CreateDesktopTraySysOptions;
  readonly dialog?: CreateDesktopDialogSysOptions;
  readonly clipboard?: CreateDesktopClipboardSysOptions;
  readonly shell?: CreateDesktopShellSysOptions;
  /**
   * When set, inject sandboxed `sys.fs` under this app-data root.
   * Omit to leave `sys.fs` undefined (plugin fails closed until configured).
   */
  readonly fs?: CreateDesktopFsSysOptions;
  /**
   * Default tray mode. Use `memory` in CI/headless; `helper` for real icons.
   * @default "helper"
   */
  readonly trayMode?: "helper" | "memory";
};

export type DesktopSystems = {
  readonly platform: DesktopPlatform;
  readonly sys: Pick<
    HostSystemsFacade,
    "notify" | "tray" | "dialog" | "clipboard" | "fs" | "shell"
  >;
  readonly tray: DesktopTraySys;
  dispose(): Promise<void>;
};

/**
 * Build HostAPI.sys pieces for the three desktop platforms
 * (notify + tray + dialog + clipboard + shell; optional sandboxed fs).
 */
export function createDesktopSystems(
  options: CreateDesktopSystemsOptions = {},
): DesktopSystems {
  const raw =
    options.platform === undefined || options.platform === "auto"
      ? detectDesktopPlatform()
      : options.platform;

  if (!isDesktopPlatform(raw)) {
    throw new Error(
      `createDesktopSystems: not a desktop platform (${String(raw)})`,
    );
  }

  const platform = raw;
  const run = options.run;
  const events = options.events;
  const trayMode = options.trayMode ?? options.tray?.mode ?? "helper";

  const notify = createDesktopNotifySys({
    platform,
    ...(run !== undefined ? { run } : {}),
    ...(events !== undefined ? { events } : {}),
    ...(options.appName !== undefined ? { appName: options.appName } : {}),
    ...options.notify,
  });

  const tray = createDesktopTraySys({
    platform,
    ...(run !== undefined ? { run } : {}),
    ...(events !== undefined ? { events } : {}),
    mode: trayMode,
    ...options.tray,
  });

  const dialog = createDesktopDialogSys({
    platform,
    ...(run !== undefined ? { run } : {}),
    ...options.dialog,
  });

  const clipboard = createDesktopClipboardSys({
    platform,
    ...(run !== undefined ? { run } : {}),
    ...options.clipboard,
  });

  const shell = createDesktopShellSys({
    platform,
    ...(run !== undefined ? { run } : {}),
    ...options.shell,
  });

  const fs =
    options.fs !== undefined ? createDesktopFsSys(options.fs) : undefined;

  return {
    platform,
    sys: {
      notify,
      tray,
      dialog,
      clipboard,
      shell,
      ...(fs !== undefined ? { fs } : {}),
    },
    tray,
    async dispose() {
      await tray.dispose();
    },
  };
}
