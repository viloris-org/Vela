import type {
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
} from "@vela/api";
import type { DesktopPlatform } from "../platform.ts";
import type { RunCommand } from "../run.ts";

export type DialogBackend = {
  readonly platform: DesktopPlatform;
  open(options: DialogOpenOptions): Promise<DialogOpenResult>;
  save(options: DialogSaveOptions): Promise<DialogSaveResult>;
};

export type CreateDialogBackendOptions = {
  readonly platform: DesktopPlatform;
  readonly run: RunCommand;
};
