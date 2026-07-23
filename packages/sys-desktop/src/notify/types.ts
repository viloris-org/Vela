import type {
  HostEventBus,
  NotifyShowOptions,
  NotifyShowResult,
} from "@vela/api";
import type { DesktopPlatform } from "../platform.ts";
import type { RunCommand } from "../run.ts";

export type NotifyBackend = {
  readonly platform: DesktopPlatform;
  show(options: NotifyShowOptions & { readonly id: string }): Promise<NotifyShowResult>;
  close(id: string): Promise<void>;
};

export type CreateNotifyBackendOptions = {
  readonly platform: DesktopPlatform;
  readonly run: RunCommand;
  readonly events?: HostEventBus;
  readonly appName?: string;
};
