import { VelaRpcErrorCodes } from "@vela/api";

export class ShellCoreError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ShellCoreError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function layerNotFound(id: string): ShellCoreError {
  return new ShellCoreError(
    VelaRpcErrorCodes.layerNotFound,
    `layer not found: ${id}`,
    { layerId: id },
  );
}

export function capabilityDenied(
  method: string,
  details?: {
    readonly permission?: string;
    readonly resource?: string;
  },
): ShellCoreError {
  return new ShellCoreError(
    VelaRpcErrorCodes.capabilityDenied,
    details?.permission !== undefined
      ? `capability denied: ${details.permission} (${method})`
      : `capability denied: ${method}`,
    { method, ...details },
  );
}

export function insertPermissionDenied(
  permissions: readonly string[],
  kind: string,
): ShellCoreError {
  return new ShellCoreError(
    VelaRpcErrorCodes.capabilityDenied,
    `capability denied: insert kind=${kind} requires ${permissions.join(", ")}`,
    { method: "layers.insert", permissions, kind },
  );
}
