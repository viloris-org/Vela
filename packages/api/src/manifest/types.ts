import type {
  AppManifestCapabilities,
  CapabilityGrant,
  CapabilityScope,
  PermissionId,
} from "../capability/types.ts";
import type { Size } from "../geometry.ts";
import type { WindowChrome } from "../window/types.ts";

/**
 * On-disk app manifest contract (G-P1-6).
 * Serialization is JSON; hosts may accept TOML by converting to this shape first.
 * This is the schema TypeScript type + structural parse helpers — not a Zod dep.
 */

export type AppManifest = {
  /** Schema version for this document (v1). */
  readonly schemaVersion: 1;
  /** Human-readable app name. */
  readonly name: string;
  /** Semver or free-form version string. */
  readonly version?: string;
  /** Reverse-DNS or package id (e.g. com.example.vela.clock). */
  readonly identifier?: string;
  /** Profile name → capability grant (default-deny if omitted). */
  readonly capabilities?: AppManifestCapabilities;
  /** Default window / preload profile hints. */
  readonly windows?: readonly AppManifestWindow[];
  /** Web asset entry for packaging / custom schemes. */
  readonly entry?: AppManifestEntry;
};

export type AppManifestEntry = {
  /** Relative path under the app package (e.g. "dist/index.html"). */
  readonly web?: string;
  /** Intended production scheme (e.g. "app"). Host maps to app:// … */
  readonly scheme?: string;
};

export type AppManifestWindow = {
  readonly id?: string;
  readonly title?: string;
  readonly preloadProfile?: string;
  readonly size?: Size;
  readonly chrome?: WindowChrome;
  readonly transparent?: boolean;
};

export type ParseAppManifestResult =
  | { readonly ok: true; readonly manifest: AppManifest }
  | { readonly ok: false; readonly error: string };

const PERMISSION_ID_RE = /^[a-z][a-z0-9_-]*(:[a-z0-9_./-]+)+$/i;

/**
 * Structural parse of an unknown JSON value into AppManifest.
 * Does not resolve paths or load plugins.
 */
export function parseAppManifest(input: unknown): ParseAppManifestResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "manifest must be an object" };
  }
  const obj = input as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    return {
      ok: false,
      error: "manifest.schemaVersion must be 1",
    };
  }

  if (typeof obj.name !== "string" || obj.name.trim().length === 0) {
    return { ok: false, error: "manifest.name must be a non-empty string" };
  }

  let version: string | undefined;
  if (obj.version !== undefined) {
    if (typeof obj.version !== "string") {
      return { ok: false, error: "manifest.version must be a string" };
    }
    version = obj.version;
  }

  let identifier: string | undefined;
  if (obj.identifier !== undefined) {
    if (typeof obj.identifier !== "string") {
      return { ok: false, error: "manifest.identifier must be a string" };
    }
    identifier = obj.identifier;
  }

  let capabilities: AppManifestCapabilities | undefined;
  if (obj.capabilities !== undefined) {
    const caps = parseCapabilities(obj.capabilities);
    if (!caps.ok) {
      return caps;
    }
    capabilities = caps.value;
  }

  let windows: readonly AppManifestWindow[] | undefined;
  if (obj.windows !== undefined) {
    const w = parseWindows(obj.windows);
    if (!w.ok) {
      return w;
    }
    windows = w.value;
  }

  let entry: AppManifestEntry | undefined;
  if (obj.entry !== undefined) {
    const e = parseEntry(obj.entry);
    if (!e.ok) {
      return e;
    }
    entry = e.value;
  }

  const manifest: AppManifest = {
    schemaVersion: 1,
    name: obj.name,
    ...(version !== undefined ? { version } : {}),
    ...(identifier !== undefined ? { identifier } : {}),
    ...(capabilities !== undefined ? { capabilities } : {}),
    ...(windows !== undefined ? { windows } : {}),
    ...(entry !== undefined ? { entry } : {}),
  };

  return { ok: true, manifest };
}

export function isAppManifest(input: unknown): input is AppManifest {
  return parseAppManifest(input).ok;
}

type Ok<T> = { readonly ok: true; readonly value: T };
type Err = { readonly ok: false; readonly error: string };

function parseCapabilities(
  input: unknown,
): Ok<AppManifestCapabilities> | Err {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "manifest.capabilities must be an object" };
  }
  const out: Record<string, CapabilityGrant> = {};
  for (const [profile, grantRaw] of Object.entries(
    input as Record<string, unknown>,
  )) {
    if (profile.trim().length === 0) {
      return { ok: false, error: "capability profile name must be non-empty" };
    }
    const grant = parseGrant(grantRaw, profile);
    if (!grant.ok) {
      return grant;
    }
    out[profile] = grant.value;
  }
  return { ok: true, value: out };
}

function parseGrant(input: unknown, profile: string): Ok<CapabilityGrant> | Err {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      error: `capabilities.${profile} must be an object`,
    };
  }
  const obj = input as Record<string, unknown>;
  if (!Array.isArray(obj.permissions)) {
    return {
      ok: false,
      error: `capabilities.${profile}.permissions must be an array`,
    };
  }
  const permissions: PermissionId[] = [];
  for (const p of obj.permissions) {
    if (typeof p !== "string" || !PERMISSION_ID_RE.test(p)) {
      return {
        ok: false,
        error: `capabilities.${profile}: invalid permission id "${String(p)}"`,
      };
    }
    permissions.push(p);
  }

  let scopes: CapabilityScope[] | undefined;
  if (obj.scopes !== undefined) {
    if (!Array.isArray(obj.scopes)) {
      return {
        ok: false,
        error: `capabilities.${profile}.scopes must be an array`,
      };
    }
    scopes = [];
    for (const s of obj.scopes) {
      const scope = parseScope(s, profile);
      if (!scope.ok) {
        return scope;
      }
      scopes.push(scope.value);
    }
  }

  const grant: CapabilityGrant =
    scopes === undefined
      ? { permissions }
      : { permissions, scopes };
  return { ok: true, value: grant };
}

function parseScope(input: unknown, profile: string): Ok<CapabilityScope> | Err {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      error: `capabilities.${profile}.scopes entries must be objects`,
    };
  }
  const obj = input as Record<string, unknown>;
  if (obj.type !== "path" && obj.type !== "url") {
    return {
      ok: false,
      error: `capabilities.${profile}.scopes: type must be "path" or "url"`,
    };
  }
  if (typeof obj.pattern !== "string" || obj.pattern.length === 0) {
    return {
      ok: false,
      error: `capabilities.${profile}.scopes: pattern must be a non-empty string`,
    };
  }
  return {
    ok: true,
    value: { type: obj.type, pattern: obj.pattern },
  };
}

function parseWindows(
  input: unknown,
): Ok<readonly AppManifestWindow[]> | Err {
  if (!Array.isArray(input)) {
    return { ok: false, error: "manifest.windows must be an array" };
  }
  const out: AppManifestWindow[] = [];
  for (const item of input) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "manifest.windows entries must be objects" };
    }
    const obj = item as Record<string, unknown>;
    const partial: {
      id?: string;
      title?: string;
      preloadProfile?: string;
      size?: Size;
      chrome?: WindowChrome;
      transparent?: boolean;
    } = {};
    if (obj.id !== undefined) {
      if (typeof obj.id !== "string") {
        return { ok: false, error: "window.id must be a string" };
      }
      partial.id = obj.id;
    }
    if (obj.title !== undefined) {
      if (typeof obj.title !== "string") {
        return { ok: false, error: "window.title must be a string" };
      }
      partial.title = obj.title;
    }
    if (obj.preloadProfile !== undefined) {
      if (typeof obj.preloadProfile !== "string") {
        return { ok: false, error: "window.preloadProfile must be a string" };
      }
      partial.preloadProfile = obj.preloadProfile;
    }
    if (obj.size !== undefined) {
      if (
        obj.size === null ||
        typeof obj.size !== "object" ||
        Array.isArray(obj.size)
      ) {
        return { ok: false, error: "window.size must be { width, height }" };
      }
      const size = obj.size as Record<string, unknown>;
      if (typeof size.width !== "number" || typeof size.height !== "number") {
        return {
          ok: false,
          error: "window.size.width/height must be numbers",
        };
      }
      partial.size = { width: size.width, height: size.height };
    }
    if (obj.chrome !== undefined) {
      if (
        obj.chrome !== "system" &&
        obj.chrome !== "custom" &&
        obj.chrome !== "none"
      ) {
        return {
          ok: false,
          error: 'window.chrome must be "system" | "custom" | "none"',
        };
      }
      partial.chrome = obj.chrome;
    }
    if (obj.transparent !== undefined) {
      if (typeof obj.transparent !== "boolean") {
        return { ok: false, error: "window.transparent must be a boolean" };
      }
      partial.transparent = obj.transparent;
    }
    out.push(partial);
  }
  return { ok: true, value: out };
}

function parseEntry(input: unknown): Ok<AppManifestEntry> | Err {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "manifest.entry must be an object" };
  }
  const obj = input as Record<string, unknown>;
  const partial: { web?: string; scheme?: string } = {};
  if (obj.web !== undefined) {
    if (typeof obj.web !== "string") {
      return { ok: false, error: "entry.web must be a string" };
    }
    partial.web = obj.web;
  }
  if (obj.scheme !== undefined) {
    if (typeof obj.scheme !== "string") {
      return { ok: false, error: "entry.scheme must be a string" };
    }
    partial.scheme = obj.scheme;
  }
  return { ok: true, value: partial };
}
