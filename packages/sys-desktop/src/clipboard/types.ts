import type { DesktopPlatform } from "../platform.ts";
import type { RunCommand } from "../run.ts";

export type ClipboardBackend = {
  readonly platform: DesktopPlatform;
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
};

export type CreateClipboardBackendOptions = {
  readonly platform: DesktopPlatform;
  readonly run: RunCommand;
};
