/**
 * Shell / OS open-external contracts (T1 capability — no Layer).
 * App surface: `vela.call("shell.openExternal", { url })`.
 *
 * Opens a URL (or handler) with the system default application.
 * Default schemes are browser-safe only; hosts must not pass raw strings to the OS.
 */

/** Options for `shell.openExternal`. */
export type ShellOpenExternalOptions = {
  readonly url: string;
};

export type ShellOpenExternalResult = {
  readonly ok: true;
};

/** `vela.call` method names for the shell plugin. */
export const ShellMethods = {
  openExternal: "shell.openExternal",
} as const;

export type ShellMethod = (typeof ShellMethods)[keyof typeof ShellMethods];

/**
 * Schemes allowed by default for `shell.openExternal`.
 * Hosts may further restrict via capability URL scopes.
 */
export const DEFAULT_OPEN_EXTERNAL_SCHEMES = [
  "http:",
  "https:",
  "mailto:",
] as const;

export type ParseExternalUrlResult =
  | { readonly ok: true; readonly href: string; readonly protocol: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Parse and validate an absolute external URL for open-external.
 * Rejects empty strings, relative URLs, and non-allowlisted schemes
 * (`file:`, `javascript:`, `data:`, …).
 */
export function parseExternalUrl(
  url: string,
  allowedSchemes: readonly string[] = DEFAULT_OPEN_EXTERNAL_SCHEMES,
): ParseExternalUrlResult {
  if (typeof url !== "string") {
    return { ok: false, reason: "url must be a string" };
  }
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "url is empty" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "url is not a valid absolute URL" };
  }

  const protocol = parsed.protocol.toLowerCase();
  const allowed = allowedSchemes.map((s) => s.toLowerCase());
  if (!allowed.includes(protocol)) {
    return { ok: false, reason: `scheme not allowed: ${protocol}` };
  }

  return { ok: true, href: parsed.href, protocol };
}
