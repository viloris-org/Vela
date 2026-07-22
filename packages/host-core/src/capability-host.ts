import {
  CapabilityDeniedError,
  checkCapability,
  rpcErr,
  rpcOk,
  VelaRpcErrorCodes,
  type AppManifestCapabilities,
  type CallContext,
  type CallHandler,
  type CapabilityGrant,
  type CapabilityHost,
  type HostAPI,
  type PermissionId,
  type VelaRpcResponse,
  type WindowId,
} from "@vela/api";

export type CreateCapabilityHostOptions = {
  readonly api: HostAPI;
  /**
   * App-level profile → grant map (from AppManifest.capabilities).
   * Missing map or profile ⇒ default deny.
   */
  readonly capabilities?: AppManifestCapabilities;
  /** Default preload profile when invoke does not specify one. */
  readonly defaultProfile?: string;
};

export type InvokeCallOptions = {
  readonly method: string;
  readonly args?: unknown;
  readonly profile?: string;
  readonly windowId?: WindowId;
  /** Correlation id for RPC envelope helpers. */
  readonly requestId?: string;
};

export type CapabilityHostRuntime = CapabilityHost & {
  /**
   * Dispatch a `vela.call` to a registered handler with capability context.
   * Throws CapabilityDeniedError or other handler errors.
   */
  invoke(options: InvokeCallOptions): Promise<unknown>;

  /**
   * Same as invoke, but returns a VelaRpcResponse envelope (never throws for deny).
   * Handler throws other than CapabilityDeniedError map to `internal`.
   */
  invokeRpc(options: InvokeCallOptions): Promise<VelaRpcResponse>;

  /** Active capability map (mutable for tests / late bind). */
  setCapabilities(capabilities: AppManifestCapabilities | undefined): void;

  getGrant(profile?: string): CapabilityGrant | undefined;
};

/**
 * In-process CapabilityHost: register handlers, enforce grants on invoke.
 * Systems I/O is only available via `options.api.sys` (injected by runtime host).
 */
export function createCapabilityHost(
  options: CreateCapabilityHostOptions,
): CapabilityHostRuntime {
  const handlers = new Map<string, CallHandler>();
  let capabilities = options.capabilities;
  const defaultProfile = options.defaultProfile ?? "default";
  const api = options.api;

  function getGrant(profile?: string): CapabilityGrant | undefined {
    if (capabilities === undefined) {
      return undefined;
    }
    const key = profile ?? defaultProfile;
    return capabilities[key];
  }

  function makeContext(
    method: string,
    profile: string,
    windowId: WindowId | undefined,
  ): CallContext {
    const grant = getGrant(profile);
    return {
      method,
      profile,
      ...(windowId !== undefined ? { windowId } : {}),
      grant,
      check(permission: PermissionId, resource?: string) {
        return checkCapability(
          grant,
          resource === undefined
            ? { permission, profile }
            : { permission, profile, resource },
        );
      },
      require(permission: PermissionId, resource?: string) {
        const result = this.check(permission, resource);
        if (!result.allowed) {
          throw new CapabilityDeniedError(
            result.reason ?? `capability denied: ${permission}`,
            {
              permission,
              method,
              ...(resource !== undefined ? { resource } : {}),
            },
          );
        }
      },
    };
  }

  const host: CapabilityHostRuntime = {
    api,

    handle(method: string, handler: CallHandler): void {
      if (!method || method.includes(" ")) {
        throw new Error(`CapabilityHost.handle: invalid method "${method}"`);
      }
      if (handlers.has(method)) {
        throw new Error(
          `CapabilityHost.handle: duplicate method "${method}"`,
        );
      }
      handlers.set(method, handler);
    },

    listMethods() {
      return [...handlers.keys()].sort();
    },

    setCapabilities(next) {
      capabilities = next;
    },

    getGrant,

    async invoke(options: InvokeCallOptions): Promise<unknown> {
      const method = options.method;
      const handler = handlers.get(method);
      if (handler === undefined) {
        throw new CapabilityDeniedError(
          `no handler registered for method: ${method}`,
          { method },
        );
      }
      const profile = options.profile ?? defaultProfile;
      const ctx = makeContext(method, profile, options.windowId);
      return await handler(options.args, ctx);
    },

    async invokeRpc(options: InvokeCallOptions): Promise<VelaRpcResponse> {
      const id = options.requestId ?? "0";
      try {
        const result = await host.invoke(options);
        return rpcOk(id, result);
      } catch (err) {
        if (err instanceof CapabilityDeniedError) {
          return rpcErr(id, VelaRpcErrorCodes.capabilityDenied, err.message, {
            permission: err.permission,
            method: err.method ?? options.method,
            resource: err.resource,
            reason: err.reason,
          });
        }
        const message =
          err instanceof Error ? err.message : "internal host error";
        return rpcErr(id, VelaRpcErrorCodes.internal, message);
      }
    },
  };

  return host;
}
