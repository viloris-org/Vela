import type { HostSystemsFacade, PlatformId } from "@vela/api";
import { SystemsError } from "../errors.ts";
import {
  detectDesktopPlatform,
  type DesktopPlatform,
  isDesktopPlatform,
} from "../platform.ts";
import { defaultRunCommand, type RunCommand } from "../run.ts";
import { createLinuxShellBackend } from "./linux.ts";
import { createMacosShellBackend } from "./macos.ts";
import { createWindowsShellBackend } from "./windows.ts";
import type { ShellBackend } from "./types.ts";

export type CreateDesktopShellSysOptions = {
  readonly platform?: DesktopPlatform | PlatformId | "auto";
  readonly run?: RunCommand;
  /** Inject a backend (tests). */
  readonly backend?: ShellBackend;
};

function createBackend(
  platform: DesktopPlatform,
  options: CreateDesktopShellSysOptions,
  run: RunCommand,
): ShellBackend {
  if (options.backend) return options.backend;
  const common = { platform, run };
  switch (platform) {
    case "linux":
      return createLinuxShellBackend(common);
    case "macos":
      return createMacosShellBackend(common);
    case "windows":
      return createWindowsShellBackend(common);
  }
}

/**
 * Real desktop `HostSystemsFacade.shell` for linux / macos / windows.
 * Callers must validate URL schemes before invoking (plugin layer does this).
 */
export function createDesktopShellSys(
  options: CreateDesktopShellSysOptions = {},
): NonNullable<HostSystemsFacade["shell"]> {
  const resolved =
    options.platform === undefined || options.platform === "auto"
      ? detectDesktopPlatform()
      : options.platform;

  if (!isDesktopPlatform(resolved)) {
    throw new SystemsError(
      "unsupported",
      `shell systems facade requires desktop platform, got ${resolved}`,
      { feature: "shell", platform: String(resolved) },
    );
  }

  const run = options.run ?? defaultRunCommand;
  const backend = createBackend(resolved, options, run);

  return {
    async openExternal(url: string) {
      await backend.openExternal(url);
    },
  };
}

export type { ShellBackend } from "./types.ts";
export { createLinuxShellBackend } from "./linux.ts";
export { createMacosShellBackend } from "./macos.ts";
export { createWindowsShellBackend } from "./windows.ts";
