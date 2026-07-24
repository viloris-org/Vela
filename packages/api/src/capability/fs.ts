/**
 * App-sandbox filesystem contracts (T1 capability — no Layer).
 * App surface: `vela.call("fs.read" | "fs.write")`.
 *
 * Paths in call args are **app-relative** (posix-style). Hosts map them under
 * an app data root after capability + scope checks. Absolute OS paths are not
 * accepted on the App → Host call surface for `fs:app-*`.
 */

/** Options for `fs.read`. */
export type FsReadOptions = {
  /** App-relative path (e.g. `notes/todo.txt`). */
  readonly path: string;
};

export type FsReadResult = {
  readonly data: string;
};

/** Options for `fs.write`. */
export type FsWriteOptions = {
  readonly path: string;
  readonly data: string;
};

export type FsWriteResult = {
  readonly ok: true;
};

/** `vela.call` method names for the fs plugin. */
export const FsMethods = {
  read: "fs.read",
  write: "fs.write",
} as const;

export type FsMethod = (typeof FsMethods)[keyof typeof FsMethods];

export type NormalizeAppPathResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Normalize an app-relative path for scope checks and sandbox resolution.
 *
 * - Rejects empty, null bytes, absolute paths, Windows drive paths, and escapes via `..`
 * - Collapses `.` / redundant `/`; returns posix relative form (no leading `./`)
 * - Does not touch the filesystem
 */
export function normalizeAppRelativePath(input: string): NormalizeAppPathResult {
  if (typeof input !== "string") {
    return { ok: false, reason: "path must be a string" };
  }
  if (input.length === 0) {
    return { ok: false, reason: "path must be non-empty" };
  }
  if (input.includes("\0")) {
    return { ok: false, reason: "path must not contain null bytes" };
  }

  // Logical App surface: forward slashes only (Windows callers still use `/`).
  let raw = input.replaceAll("\\", "/");

  if (raw.startsWith("/") || raw.startsWith("~")) {
    return {
      ok: false,
      reason: "path must be app-relative (absolute paths are not allowed)",
    };
  }
  // Windows drive / UNC style
  if (/^[a-zA-Z]:/.test(raw) || raw.startsWith("//")) {
    return {
      ok: false,
      reason: "path must be app-relative (drive/UNC paths are not allowed)",
    };
  }

  const parts = raw.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (out.length === 0) {
        return {
          ok: false,
          reason: "path escapes app sandbox via ..",
        };
      }
      out.pop();
      continue;
    }
    out.push(part);
  }

  if (out.length === 0) {
    return { ok: false, reason: "path resolves to empty (sandbox root is not a file)" };
  }

  return { ok: true, path: out.join("/") };
}
