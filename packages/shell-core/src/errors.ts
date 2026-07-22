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

export function capabilityDenied(method: string): ShellCoreError {
  return new ShellCoreError(
    VelaRpcErrorCodes.capabilityDenied,
    `capability denied: ${method}`,
    { method },
  );
}
