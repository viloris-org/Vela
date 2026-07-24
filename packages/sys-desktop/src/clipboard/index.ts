import type { HostSystemsFacade, PlatformId } from "@vela/api";
import { SystemsError } from "../errors.ts";
import {
  detectDesktopPlatform,
  type DesktopPlatform,
  isDesktopPlatform,
} from "../platform.ts";
import { defaultRunCommand, type RunCommand } from "../run.ts";
import { createLinuxClipboardBackend } from "./linux.ts";
import { createMacosClipboardBackend } from "./macos.ts";
import { createWindowsClipboardBackend } from "./windows.ts";
import type { ClipboardBackend } from "./types.ts";

export type CreateDesktopClipboardSysOptions = {
  readonly platform?: DesktopPlatform | PlatformId | "auto";
  readonly run?: RunCommand;
  /** Inject a backend (tests). */
  readonly backend?: ClipboardBackend;
};

function createBackend(
  platform: DesktopPlatform,
  options: CreateDesktopClipboardSysOptions,
  run: RunCommand,
): ClipboardBackend {
  if (options.backend) return options.backend;
  const common = { platform, run };
  switch (platform) {
    case "linux":
      return createLinuxClipboardBackend(common);
    case "macos":
      return createMacosClipboardBackend(common);
    case "windows":
      return createWindowsClipboardBackend(common);
  }
}

/**
 * Real desktop `HostSystemsFacade.clipboard` for linux / macos / windows.
 */
export function createDesktopClipboardSys(
  options: CreateDesktopClipboardSysOptions = {},
): NonNullable<HostSystemsFacade["clipboard"]> {
  const resolved =
    options.platform === undefined || options.platform === "auto"
      ? detectDesktopPlatform()
      : options.platform;

  if (!isDesktopPlatform(resolved)) {
    throw new SystemsError(
      "unsupported",
      `clipboard systems facade requires desktop platform, got ${resolved}`,
      { feature: "clipboard", platform: String(resolved) },
    );
  }

  const run = options.run ?? defaultRunCommand;
  const backend = createBackend(resolved, options, run);

  return {
    async readText() {
      return await backend.readText();
    },
    async writeText(text: string) {
      await backend.writeText(text);
    },
  };
}

export type { ClipboardBackend } from "./types.ts";
export { createLinuxClipboardBackend } from "./linux.ts";
export { createMacosClipboardBackend } from "./macos.ts";
export { createWindowsClipboardBackend } from "./windows.ts";
