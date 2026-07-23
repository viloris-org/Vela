/**
 * On-disk Vela **App package** root descriptor (`vela.json`).
 *
 * Presence of a valid `vela.json` marks a directory as a Vela App package root.
 * See docs/app-package-layout.md (file-tree SoT).
 *
 * This is separate from {@link AppManifest} (`vela.manifest.json` / packaging
 * capabilities). Instant CLI and adapters locate packages via this file.
 */

export type VelaPackageKind = "app";

export type VelaPackageDev = {
  /** Preferred instant-mode HTTP port. */
  readonly port?: number;
  /**
   * package.json script name to run for instant content serve.
   * Default: `"serve"`.
   */
  readonly script?: string;
};

export type VelaPackageEntry = {
  /**
   * Relative path under the package root for the web entry
   * (e.g. `"index.html"` or `"dist/index.html"`).
   */
  readonly web?: string;
  /** Intended production scheme (e.g. `"app"`). */
  readonly scheme?: string;
};

/**
 * Package root marker document (`vela.json`).
 * Directory containing this file is a Vela App package root.
 */
export type VelaPackage = {
  readonly schemaVersion: 1;
  /**
   * Stable short id for CLI (`--app`) and tooling.
   * Must match `/^[a-z][a-z0-9_-]*$/i` when set.
   */
  readonly id: string;
  /** Human-readable display name. */
  readonly name?: string;
  /** Package kind. Default: `"app"`. */
  readonly kind?: VelaPackageKind;
  /** Instant-mode / dogfood hints (not a shipping runtime contract). */
  readonly dev?: VelaPackageDev;
  /** Web entry hints (align with AppManifest.entry when both exist). */
  readonly entry?: VelaPackageEntry;
  /** Reverse-DNS or package identifier (optional; packaging). */
  readonly identifier?: string;
  /** Semver or free-form version. */
  readonly version?: string;
};

export type ParseVelaPackageResult =
  | { readonly ok: true; readonly package: VelaPackage }
  | { readonly ok: false; readonly error: string };

/** Canonical marker filename at package root. */
export const VELA_PACKAGE_MARKER = "vela.json";

const ID_RE = /^[a-z][a-z0-9_-]*$/i;

/**
 * Structural parse of unknown JSON into {@link VelaPackage}.
 * Does not touch the filesystem.
 */
export function parseVelaPackage(input: unknown): ParseVelaPackageResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "vela.json must be an object" };
  }
  const obj = input as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    return { ok: false, error: "vela.json schemaVersion must be 1" };
  }

  if (typeof obj.id !== "string" || !ID_RE.test(obj.id.trim())) {
    return {
      ok: false,
      error: 'vela.json id must match /^[a-z][a-z0-9_-]*$/i',
    };
  }
  const id = obj.id.trim();

  let name: string | undefined;
  if (obj.name !== undefined) {
    if (typeof obj.name !== "string" || obj.name.trim().length === 0) {
      return { ok: false, error: "vela.json name must be a non-empty string" };
    }
    name = obj.name.trim();
  }

  let kind: VelaPackageKind | undefined;
  if (obj.kind !== undefined) {
    if (obj.kind !== "app") {
      return { ok: false, error: 'vela.json kind must be "app" when set' };
    }
    kind = "app";
  }

  let dev: VelaPackageDev | undefined;
  if (obj.dev !== undefined) {
    const d = parseDev(obj.dev);
    if (!d.ok) return d;
    dev = d.value;
  }

  let entry: VelaPackageEntry | undefined;
  if (obj.entry !== undefined) {
    const e = parseEntry(obj.entry);
    if (!e.ok) return e;
    entry = e.value;
  }

  let identifier: string | undefined;
  if (obj.identifier !== undefined) {
    if (typeof obj.identifier !== "string") {
      return { ok: false, error: "vela.json identifier must be a string" };
    }
    identifier = obj.identifier;
  }

  let version: string | undefined;
  if (obj.version !== undefined) {
    if (typeof obj.version !== "string") {
      return { ok: false, error: "vela.json version must be a string" };
    }
    version = obj.version;
  }

  const pkg: VelaPackage = {
    schemaVersion: 1,
    id,
    ...(name !== undefined ? { name } : {}),
    ...(kind !== undefined ? { kind } : {}),
    ...(dev !== undefined ? { dev } : {}),
    ...(entry !== undefined ? { entry } : {}),
    ...(identifier !== undefined ? { identifier } : {}),
    ...(version !== undefined ? { version } : {}),
  };

  return { ok: true, package: pkg };
}

export function isVelaPackage(input: unknown): input is VelaPackage {
  return parseVelaPackage(input).ok;
}

type Ok<T> = { readonly ok: true; readonly value: T };
type Err = { readonly ok: false; readonly error: string };

function parseDev(input: unknown): Ok<VelaPackageDev> | Err {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "vela.json dev must be an object" };
  }
  const obj = input as Record<string, unknown>;
  const partial: { port?: number; script?: string } = {};
  if (obj.port !== undefined) {
    if (typeof obj.port !== "number" || !Number.isFinite(obj.port) || obj.port <= 0) {
      return { ok: false, error: "vela.json dev.port must be a positive number" };
    }
    partial.port = Math.floor(obj.port);
  }
  if (obj.script !== undefined) {
    if (typeof obj.script !== "string" || obj.script.trim().length === 0) {
      return { ok: false, error: "vela.json dev.script must be a non-empty string" };
    }
    partial.script = obj.script.trim();
  }
  return { ok: true, value: partial };
}

function parseEntry(input: unknown): Ok<VelaPackageEntry> | Err {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "vela.json entry must be an object" };
  }
  const obj = input as Record<string, unknown>;
  const partial: { web?: string; scheme?: string } = {};
  if (obj.web !== undefined) {
    if (typeof obj.web !== "string") {
      return { ok: false, error: "vela.json entry.web must be a string" };
    }
    partial.web = obj.web;
  }
  if (obj.scheme !== undefined) {
    if (typeof obj.scheme !== "string") {
      return { ok: false, error: "vela.json entry.scheme must be a string" };
    }
    partial.scheme = obj.scheme;
  }
  return { ok: true, value: partial };
}
