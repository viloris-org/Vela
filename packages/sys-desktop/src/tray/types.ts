import type {
  HostEventBus,
  TrayCreateOptions,
  TrayCreateResult,
  TrayMenuItem,
  TrayUpdateOptions,
} from "@vela/api";
import type { DesktopPlatform } from "../platform.ts";
import type { RunCommand } from "../run.ts";

export type TrayBackend = {
  readonly platform: DesktopPlatform;
  create(options: TrayCreateOptions & { readonly id: string }): Promise<TrayCreateResult>;
  update(id: string, patch: Omit<TrayUpdateOptions, "id">): Promise<void>;
  remove(id: string): Promise<void>;
  /** Optional cleanup when Host shuts down. */
  dispose?(): Promise<void>;
};

export type CreateTrayBackendOptions = {
  readonly platform: DesktopPlatform;
  readonly run: RunCommand;
  readonly events?: HostEventBus;
  /** Override helper script paths (tests). */
  readonly helperPath?: string;
  /**
   * When true, use in-process memory backend (no OS icon).
   * Default false for real desktop adaptation.
   */
  readonly memoryOnly?: boolean;
};

export type TrayHelperRequest =
  | {
      readonly type: "req";
      readonly id: number;
      readonly op: "create";
      readonly trayId: string;
      readonly tooltip?: string;
      readonly icon?: string;
      readonly menu?: readonly TrayMenuItem[];
    }
  | {
      readonly type: "req";
      readonly id: number;
      readonly op: "update";
      readonly trayId: string;
      readonly tooltip?: string;
      readonly icon?: string;
      readonly menu?: readonly TrayMenuItem[];
    }
  | {
      readonly type: "req";
      readonly id: number;
      readonly op: "remove";
      readonly trayId: string;
    }
  | {
      readonly type: "req";
      readonly id: number;
      readonly op: "quit";
    };
