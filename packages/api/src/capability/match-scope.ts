import type { CapabilityScope } from "./types.ts";

/**
 * Minimal path-scope matcher for capability grants.
 * Supports `*` (one segment) and `**` (any suffix including `/`).
 * Patterns are matched against the full resource path string (not OS-resolved).
 */
export function matchPathPattern(pattern: string, path: string): boolean {
  if (pattern === path) {
    return true;
  }
  if (pattern === "**" || pattern === "*") {
    return path.length > 0 || pattern === "**";
  }

  const regex = pathPatternToRegExp(pattern);
  return regex.test(path);
}

/**
 * Minimal URL-scope matcher.
 * `*` matches any characters except `/` within a path segment;
 * `**` matches any suffix (including query if present in the resource string).
 */
export function matchUrlPattern(pattern: string, url: string): boolean {
  if (pattern === url) {
    return true;
  }
  const regex = pathPatternToRegExp(pattern);
  return regex.test(url);
}

export function matchScope(
  scope: CapabilityScope,
  resource: string,
): boolean {
  if (scope.type === "path") {
    return matchPathPattern(scope.pattern, resource);
  }
  return matchUrlPattern(scope.pattern, resource);
}

/**
 * True when the grant's scopes (if any) permit `resource`.
 * Empty / missing scopes → no resource restriction.
 * When scopes exist and resource is provided → at least one scope must match.
 */
export function scopesAllowResource(
  scopes: readonly CapabilityScope[] | undefined,
  resource: string | undefined,
): boolean {
  if (scopes === undefined || scopes.length === 0) {
    return true;
  }
  if (resource === undefined || resource.length === 0) {
    // Scoped grant but no resource: deny — force handlers to pass a resource.
    return false;
  }
  return scopes.some((scope) => matchScope(scope, resource));
}

function pathPatternToRegExp(pattern: string): RegExp {
  let source = "^";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === "*" && pattern[i + 1] === "*") {
      source += ".*";
      i += 1;
      continue;
    }
    if (ch === "*") {
      source += "[^/]*";
      continue;
    }
    if (/[.+?^${}()|[\]\\]/.test(ch)) {
      source += `\\${ch}`;
      continue;
    }
    source += ch;
  }
  source += "$";
  return new RegExp(source);
}
