import type {
  HostEventBus,
  HostSystemsFacade,
  NotifyShowOptions,
  NotifyShowResult,
} from "@vela/api";
import { SystemsError } from "../errors.ts";
import {
  detectDesktopPlatform,
  type DesktopPlatform,
  isDesktopPlatform,
} from "../platform.ts";
import { defaultRunCommand, type RunCommand } from "../run.ts";
import { createLinuxNotifyBackend } from "./linux.ts";
import { createMacosNotifyBackend } from "./macos.ts";
import { createWindowsNotifyBackend } from "./windows.ts";
import type { NotifyBackend } from "./types.ts";

export type CreateDesktopNotifySysOptions = {
  readonly platform?: DesktopPlatform | "auto";
  readonly run?: RunCommand;
  readonly events?: HostEventBus;
  readonly appName?: string;
  /** Prefix for auto-generated notification ids. */
  readonly idPrefix?: string;
  /** Inject a backend (tests). */
  readonly backend?: NotifyBackend;
};

function createBackend(
  platform: DesktopPlatform,
  options: CreateDesktopNotifySysOptions,
  run: RunCommand,
): NotifyBackend {
  if (options.backend) return options.backend;
  const common = {
    platform,
    run,
    ...(options.events !== undefined ? { events: options.events } : {}),
    ...(options.appName !== undefined ? { appName: options.appName } : {}),
  };
  switch (platform) {
    case "linux":
      return createLinuxNotifyBackend(common);
    case "macos":
      return createMacosNotifyBackend(common);
    case "windows":
      return createWindowsNotifyBackend(common);
  }
}

/**
 * Real desktop `HostSystemsFacade.notify` for linux / macos / windows.
 */
export function createDesktopNotifySys(
  options: CreateDesktopNotifySysOptions = {},
): NonNullable<HostSystemsFacade["notify"]> {
  const resolved =
    options.platform === undefined || options.platform === "auto"
      ? detectDesktopPlatform()
      : options.platform;

  if (!isDesktopPlatform(resolved)) {
    throw new SystemsError(
      "unsupported",
      `notify systems facade requires desktop platform, got ${resolved}`,
      { feature: "notify", platform: String(resolved) },
    );
  }

  const run = options.run ?? defaultRunCommand;
  const backend = createBackend(resolved, options, run);
  let seq = 0;
  const prefix = options.idPrefix ?? "notify";

  return {
    async show(opts: NotifyShowOptions): Promise<NotifyShowResult> {
      const id = opts.id ?? `${prefix}-${++seq}`;
      return await backend.show({ ...opts, id });
    },
    async close(id: string): Promise<void> {
      await backend.close(id);
    },
  };
}

export type { NotifyBackend } from "./types.ts";
export { createLinuxNotifyBackend } from "./linux.ts";
export { createMacosNotifyBackend } from "./macos.ts";
export { createWindowsNotifyBackend } from "./windows.ts";
