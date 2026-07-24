import type { DesktopPlatform } from "../platform.ts";
import type { RunCommand } from "../run.ts";

export type CreateShellBackendOptions = {
  readonly platform: DesktopPlatform;
  readonly run: RunCommand;
};

/** Platform-specific open-external implementation. */
export type ShellBackend = {
  readonly platform: DesktopPlatform;
  openExternal(url: string): Promise<void>;
};
