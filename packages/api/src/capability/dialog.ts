/**
 * File / folder picker and save dialogs (T1 capability — no Layer).
 * Desktop-oriented; mobile hosts should return structured unsupported.
 * App surface: `vela.call("dialog.open" | "dialog.save", …)`.
 */

/** Named extension group for open/save filters. */
export type DialogFilter = {
  readonly name: string;
  /** Extensions without leading dots, e.g. `["png", "jpg"]`. Use `["*"]` for all. */
  readonly extensions: readonly string[];
};

/** Options for `dialog.open` (file or directory picker). */
export type DialogOpenOptions = {
  readonly title?: string;
  /** Starting directory or pre-selected file path (platform-dependent). */
  readonly defaultPath?: string;
  readonly filters?: readonly DialogFilter[];
  /** Allow multiple file selection (ignored when `directory` is true on some hosts). */
  readonly multiple?: boolean;
  /** Open as a directory/folder picker. */
  readonly directory?: boolean;
};

export type DialogOpenResult = {
  /** `true` when the user cancelled the dialog. */
  readonly canceled: boolean;
  /** Absolute paths selected (empty when canceled). Single-select is 0 or 1 entry. */
  readonly paths: readonly string[];
};

/** Options for `dialog.save` (save-as path picker; does not write the file). */
export type DialogSaveOptions = {
  readonly title?: string;
  /** Starting directory and/or suggested full path. */
  readonly defaultPath?: string;
  readonly filters?: readonly DialogFilter[];
  /**
   * Suggested file name when `defaultPath` is a directory or omitted.
   * Hosts may merge with `defaultPath` when both are set.
   */
  readonly defaultName?: string;
};

export type DialogSaveResult = {
  readonly canceled: boolean;
  /** Absolute path chosen by the user, or `null` when canceled. */
  readonly path: string | null;
};

/** `vela.call` method names for the dialog plugin. */
export const DialogMethods = {
  open: "dialog.open",
  save: "dialog.save",
} as const;

export type DialogMethod =
  (typeof DialogMethods)[keyof typeof DialogMethods];
