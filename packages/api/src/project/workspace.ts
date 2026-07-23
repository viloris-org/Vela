/**
 * Optional monorepo workspace descriptor (`vela.workspace.json` at repo root).
 * Lists relative package **parent** directories to scan one level deep for
 * {@link VELA_PACKAGE_MARKER} (`vela.json`).
 *
 * See docs/app-package-layout.md.
 */

import { VELA_PACKAGE_MARKER } from "./package.ts";

/** Default parents when no workspace file exists (Vela monorepo convention). */
export const DEFAULT_PACKAGE_PARENTS = ["apps", "example"] as const;

/** Canonical workspace filename at monorepo root. */
export const VELA_WORKSPACE_MARKER = "vela.workspace.json";

export type VelaWorkspace = {
  readonly schemaVersion: 1;
  /**
   * Relative directory names under the monorepo root.
   * Each is scanned one level deep for `vela.json` package roots.
   */
  readonly packageParents: readonly string[];
};

export type ParseVelaWorkspaceResult =
  | { readonly ok: true; readonly workspace: VelaWorkspace }
  | { readonly ok: false; readonly error: string };

/**
 * Structural parse of workspace JSON.
 * Empty / missing packageParents is invalid; use {@link defaultVelaWorkspace}.
 */
export function parseVelaWorkspace(input: unknown): ParseVelaWorkspaceResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "vela.workspace.json must be an object" };
  }
  const obj = input as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    return { ok: false, error: "vela.workspace.json schemaVersion must be 1" };
  }

  if (!Array.isArray(obj.packageParents) || obj.packageParents.length === 0) {
    return {
      ok: false,
      error: "vela.workspace.json packageParents must be a non-empty string array",
    };
  }

  const packageParents: string[] = [];
  for (const p of obj.packageParents) {
    if (typeof p !== "string" || p.trim().length === 0) {
      return {
        ok: false,
        error: "vela.workspace.json packageParents entries must be non-empty strings",
      };
    }
    // Reject absolute / escape paths in the descriptor.
    const t = p.trim().replace(/\\/g, "/");
    if (t.startsWith("/") || t.includes("..") || t.includes(":")) {
      return {
        ok: false,
        error: `vela.workspace.json packageParents entry must be a relative path without ..: ${p}`,
      };
    }
    packageParents.push(t);
  }

  return {
    ok: true,
    workspace: { schemaVersion: 1, packageParents },
  };
}

export function defaultVelaWorkspace(): VelaWorkspace {
  return {
    schemaVersion: 1,
    packageParents: [...DEFAULT_PACKAGE_PARENTS],
  };
}

export function isVelaWorkspace(input: unknown): input is VelaWorkspace {
  return parseVelaWorkspace(input).ok;
}

/** Re-export for adapters that only import workspace. */
export { VELA_PACKAGE_MARKER };
