import type { PlatformId } from "../material/spec.ts";
import type { WindowId } from "../window/types.ts";
import type {
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
} from "./dialog.ts";
import type {
  NotifyShowOptions,
  NotifyShowResult,
} from "./notify.ts";
import type {
  TrayCreateOptions,
  TrayCreateResult,
  TrayUpdateOptions,
} from "./tray.ts";
import type {
  CapabilityCheckResult,
  CapabilityGrant,
  PermissionId,
} from "./types.ts";

/**
 * Host plugin registration surface (G-P1-9 / G-P1-11).
 * Implementations live in `@vela/host-core` or a runtime host; this module is types only.
 *
 * App page never imports these types at runtime privilege — only Host TS plugins do.
 */

/** Host → App push channel (wired to preload `events.subscribe`). */
export interface HostEventBus {
  emit(channel: string, payload: unknown): void;
  subscribe(
    channel: string,
    handler: (payload: unknown) => void,
  ): () => void;
}

/** Whitelisted facades injected into Host TS (no ambient Node / DOM). */
export interface HostSystemsFacade {
  readonly clipboard?: {
    readText(): Promise<string>;
    writeText(text: string): Promise<void>;
  };
  readonly notify?: {
    show(options: NotifyShowOptions): Promise<NotifyShowResult>;
    close?(id: string): Promise<void>;
  };
  readonly tray?: {
    create(options: TrayCreateOptions): Promise<TrayCreateResult>;
    update(id: string, patch: Omit<TrayUpdateOptions, "id">): Promise<void>;
    remove(id: string): Promise<void>;
  };
  readonly fs?: {
    readText(path: string): Promise<string>;
    writeText(path: string, data: string): Promise<void>;
  };
  readonly dialog?: {
    open(options?: DialogOpenOptions): Promise<DialogOpenResult>;
    save(options?: DialogSaveOptions): Promise<DialogSaveResult>;
  };
  readonly shell?: {
    openExternal(url: string): Promise<void>;
  };
}

/**
 * Stable HostAPI whitelist (ADR 0007 D5).
 * Runtimes inject concrete facades; plugins must not assume ambient `fs` / `process`.
 */
export interface HostAPI {
  readonly platform: PlatformId;
  /** Optional systems facades (T0/T1). Missing members → handler must fail closed. */
  readonly sys?: HostSystemsFacade;
  /**
   * Optional event bus for OS → App notifications (tray click, notify action, …).
   * Runtime host wires this to preload `window.vela.events`.
   */
  readonly events?: HostEventBus;
}

export interface CallContext {
  readonly method: string;
  readonly profile: string;
  readonly windowId?: WindowId;
  /** Active grant snapshot for this call (may be undefined = deny-all profile). */
  readonly grant: CapabilityGrant | undefined;

  /**
   * Check permission without throwing.
   * Prefer `require` in handlers for fail-closed control flow.
   */
  check(
    permission: PermissionId,
    resource?: string,
  ): CapabilityCheckResult;

  /**
   * Throw a structured capability error if the permission is not granted.
   * Hosts map this to `capability.denied` RPC responses.
   */
  require(permission: PermissionId, resource?: string): void;
}

export type CallHandler = (
  args: unknown,
  ctx: CallContext,
) => unknown | Promise<unknown>;

/**
 * Registration API used by capability plugins (`register(host)`).
 * Mirrors ADR 0006 sketch: `host.handle("clipboard.write", …)`.
 */
export interface CapabilityHost {
  readonly api: HostAPI;

  /** Register a `vela.call` method. Duplicate method names throw. */
  handle(method: string, handler: CallHandler): void;

  /** List registered method names (sorted). */
  listMethods(): readonly string[];
}

/**
 * Capability plugin module shape (Host TS).
 * Desktop reference runtime: Bun; other backends may load the same source.
 */
export interface CapabilityPlugin {
  readonly name?: string;
  register(host: CapabilityHost): void | Promise<void>;
}

/**
 * Error thrown by `ctx.require` / host dispatch on deny.
 * Carries RPC-compatible code for envelope mapping.
 */
export class CapabilityDeniedError extends Error {
  readonly code = "capability.denied" as const;
  readonly permission?: PermissionId;
  readonly method?: string;
  readonly resource?: string;
  readonly reason: string;

  constructor(
    reason: string,
    details?: {
      readonly permission?: PermissionId;
      readonly method?: string;
      readonly resource?: string;
    },
  ) {
    super(reason);
    this.name = "CapabilityDeniedError";
    this.reason = reason;
    if (details?.permission !== undefined) {
      this.permission = details.permission;
    }
    if (details?.method !== undefined) {
      this.method = details.method;
    }
    if (details?.resource !== undefined) {
      this.resource = details.resource;
    }
  }
}
