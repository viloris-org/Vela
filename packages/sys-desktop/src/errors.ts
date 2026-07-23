/**
 * Structured systems-layer errors (Host maps as needed to RPC).
 * Not capability.denied — these mean OS / backend failure after a grant.
 */

export type SystemsErrorCode =
  | "unsupported"
  | "backend_missing"
  | "spawn_failed"
  | "backend_failed"
  | "invalid_state";

export class SystemsError extends Error {
  readonly code: SystemsErrorCode;
  readonly platform?: string;
  readonly feature?: string;

  constructor(
    code: SystemsErrorCode,
    message: string,
    details?: {
      readonly platform?: string;
      readonly feature?: string;
      readonly cause?: unknown;
    },
  ) {
    super(message, details?.cause !== undefined ? { cause: details.cause } : undefined);
    this.name = "SystemsError";
    this.code = code;
    if (details?.platform !== undefined) this.platform = details.platform;
    if (details?.feature !== undefined) this.feature = details.feature;
  }
}
