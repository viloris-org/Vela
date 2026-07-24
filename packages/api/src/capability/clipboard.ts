/**
 * System clipboard contracts (T1 capability — no Layer).
 * App surface: `vela.call("clipboard.read" | "clipboard.write")`.
 */

/** Options for `clipboard.write`. */
export type ClipboardWriteOptions = {
  readonly text: string;
};

export type ClipboardWriteResult = {
  readonly ok: true;
};

/** Result of `clipboard.read` (no args required). */
export type ClipboardReadResult = {
  readonly text: string;
};

/** `vela.call` method names for the clipboard plugin. */
export const ClipboardMethods = {
  read: "clipboard.read",
  write: "clipboard.write",
} as const;

export type ClipboardMethod =
  (typeof ClipboardMethods)[keyof typeof ClipboardMethods];
