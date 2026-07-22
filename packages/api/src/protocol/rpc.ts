/**
 * Typed RPC envelopes for Web ↔ Shell ↔ Bun (ADR 0002 D5).
 * Wire framing is host-defined; these are payload shapes only.
 */

export type VelaRpcChannel =
  | "call"
  | "layers"
  | "hit"
  | "window"
  | "shell";

export type VelaRpcErrorCode =
  | "capability.denied"
  | "schema.invalid"
  | "layer.not_found"
  | "unsupported.platform"
  | "generation.stale"
  | "internal";

export const VelaRpcErrorCodes = {
  capabilityDenied: "capability.denied",
  schemaInvalid: "schema.invalid",
  layerNotFound: "layer.not_found",
  unsupportedPlatform: "unsupported.platform",
  generationStale: "generation.stale",
  internal: "internal",
} as const satisfies Record<string, VelaRpcErrorCode>;

export type VelaRpcRequest = {
  readonly id: string;
  readonly channel: VelaRpcChannel;
  readonly method: string;
  readonly args?: unknown;
};

export type VelaRpcError = {
  readonly code: VelaRpcErrorCode | (string & {});
  readonly message: string;
  readonly details?: unknown;
};

export type VelaRpcResponse =
  | {
      readonly id: string;
      readonly ok: true;
      readonly result?: unknown;
    }
  | {
      readonly id: string;
      readonly ok: false;
      readonly error: VelaRpcError;
    };

export type VelaEvent = {
  readonly channel: string;
  readonly payload: unknown;
};

export function rpcOk(id: string, result?: unknown): VelaRpcResponse {
  if (result === undefined) {
    return { id, ok: true };
  }
  return { id, ok: true, result };
}

export function rpcErr(
  id: string,
  code: VelaRpcErrorCode | (string & {}),
  message: string,
  details?: unknown,
): VelaRpcResponse {
  if (details === undefined) {
    return { id, ok: false, error: { code, message } };
  }
  return { id, ok: false, error: { code, message, details } };
}
