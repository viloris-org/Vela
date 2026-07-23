import type { HostSystemsFacade } from "@vela/api";
import { SystemsError } from "../errors.ts";
import {
  detectDesktopPlatform,
  type DesktopPlatform,
  isDesktopPlatform,
} from "../platform.ts";
import { defaultRunCommand, type RunCommand } from "../run.ts";
import { createLinuxDialogBackend } from "./linux.ts";
import { createMacosDialogBackend } from "./macos.ts";
import { createWindowsDialogBackend } from "./windows.ts";
import type { DialogBackend } from "./types.ts";

export type CreateDesktopDialogSysOptions = {
  readonly platform?: DesktopPlatform | "auto";
  readonly run?: RunCommand;
  /** Inject a backend (tests). */
  readonly backend?: DialogBackend;
};

function createBackend(
  platform: DesktopPlatform,
  options: CreateDesktopDialogSysOptions,
  run: RunCommand,
): DialogBackend {
  if (options.backend) return options.backend;
  const common = { platform, run };
  switch (platform) {
    case "linux":
      return createLinuxDialogBackend(common);
    case "macos":
      return createMacosDialogBackend(common);
    case "windows":
      return createWindowsDialogBackend(common);
  }
}

/**
 * Real desktop `HostSystemsFacade.dialog` for linux / macos / windows.
 * Open/save return canceled results on user dismiss; do not throw for cancel.
 */
export function createDesktopDialogSys(
  options: CreateDesktopDialogSysOptions = {},
): NonNullable<HostSystemsFacade["dialog"]> {
  const resolved =
    options.platform === undefined || options.platform === "auto"
      ? detectDesktopPlatform()
      : options.platform;

  if (!isDesktopPlatform(resolved)) {
    throw new SystemsError(
      "unsupported",
      `dialog systems facade requires desktop platform, got ${resolved}`,
      { feature: "dialog", platform: String(resolved) },
    );
  }

  const run = options.run ?? defaultRunCommand;
  const backend = createBackend(resolved, options, run);

  return {
    open: (opts) => backend.open(opts ?? {}),
    save: (opts) => backend.save(opts ?? {}),
  };
}

export type { DialogBackend } from "./types.ts";
export { createLinuxDialogBackend } from "./linux.ts";
export { createMacosDialogBackend } from "./macos.ts";
export { createWindowsDialogBackend } from "./windows.ts";
export {
  zenityFileFilters,
  kdialogFilterString,
  winFormsFilterString,
  macosTypeList,
  normalizeExtensions,
} from "./filters.ts";
