import { mkdir } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { HostSystemsFacade } from "@vela/api";
import { normalizeAppRelativePath } from "@vela/api";
import { SystemsError } from "../errors.ts";

export type CreateDesktopFsSysOptions = {
  /**
   * Absolute OS path of the app data sandbox root.
   * All relative call paths are resolved under this directory.
   */
  readonly root: string;
  /**
   * Create `root` (and parents) on first write if missing.
   * @default true
   */
  readonly createRoot?: boolean;
};

/**
 * Resolve an app-relative path under `root`. Throws SystemsError if escape.
 * Accepts already-normalized relative paths (plugin should normalize first).
 */
export function resolveUnderRoot(root: string, relativePath: string): string {
  const normalized = normalizeAppRelativePath(relativePath);
  if (!normalized.ok) {
    throw new SystemsError("invalid_state", `fs: ${normalized.reason}`, {
      feature: "fs",
    });
  }

  const rootAbs = resolve(root);
  const full = resolve(rootAbs, ...normalized.path.split("/"));
  const rootWithSep = rootAbs.endsWith(sep) ? rootAbs : rootAbs + sep;
  if (full !== rootAbs && !full.startsWith(rootWithSep)) {
    throw new SystemsError(
      "invalid_state",
      `fs: path escapes sandbox root: ${relativePath}`,
      { feature: "fs" },
    );
  }
  return full;
}

/**
 * Sandboxed desktop `HostSystemsFacade.fs` using the Host runtime filesystem
 * (Bun / Node). Paths on the facade are **app-relative** (plugin already
 * normalized); this layer maps them under `root`.
 */
export function createDesktopFsSys(
  options: CreateDesktopFsSysOptions,
): NonNullable<HostSystemsFacade["fs"]> {
  if (!options.root || options.root.length === 0) {
    throw new SystemsError("invalid_state", "fs: root is required", {
      feature: "fs",
    });
  }
  const rootAbs = resolve(options.root);
  const createRoot = options.createRoot ?? true;

  return {
    async readText(path) {
      const full = resolveUnderRoot(rootAbs, path);
      const file = Bun.file(full);
      if (!(await file.exists())) {
        throw new SystemsError("backend_failed", `fs.read: not found: ${path}`, {
          feature: "fs",
        });
      }
      return await file.text();
    },
    async writeText(path, data) {
      const full = resolveUnderRoot(rootAbs, path);
      if (createRoot) {
        await mkdir(dirname(full), { recursive: true });
      }
      await Bun.write(full, data);
    },
  };
}

/** Convenience for tests: join without I/O. */
export function joinAppPath(root: string, relativePath: string): string {
  return join(resolve(root), relativePath);
}
