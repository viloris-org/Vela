import { scopesAllowResource } from "./match-scope.ts";
import type {
  CapabilityCheckRequest,
  CapabilityCheckResult,
  CapabilityGrant,
  PermissionId,
} from "./types.ts";

/**
 * Pure capability check against a profile grant.
 * Default deny: missing grant, missing permission, or scope miss → not allowed.
 * Hosts must call this (or an equivalent) before any privileged `call` / insert.
 */
export function checkCapability(
  grant: CapabilityGrant | undefined,
  request: CapabilityCheckRequest,
): CapabilityCheckResult {
  if (grant === undefined) {
    return denied("no capability grant for profile", request);
  }

  if (!grant.permissions.includes(request.permission)) {
    return denied(
      `permission not granted: ${request.permission}`,
      request,
    );
  }

  if (!scopesAllowResource(grant.scopes, request.resource)) {
    if (request.resource === undefined || request.resource.length === 0) {
      return denied(
        `permission ${request.permission} is scoped; resource required`,
        request,
      );
    }
    return denied(
      `resource out of scope for ${request.permission}: ${request.resource}`,
      request,
    );
  }

  return { allowed: true };
}

/** Resolve a named profile grant from an app capability map. */
export function grantForProfile(
  capabilities: Readonly<Record<string, CapabilityGrant>> | undefined,
  profile: string | undefined,
): CapabilityGrant | undefined {
  if (capabilities === undefined) {
    return undefined;
  }
  const key = profile ?? "default";
  return capabilities[key];
}

/**
 * Convenience: check a permission against a capabilities map + profile name.
 */
export function checkProfileCapability(
  capabilities: Readonly<Record<string, CapabilityGrant>> | undefined,
  profile: string | undefined,
  permission: PermissionId,
  resource?: string,
): CapabilityCheckResult {
  const grant = grantForProfile(capabilities, profile);
  const request: CapabilityCheckRequest =
    resource === undefined
      ? { permission, ...(profile !== undefined ? { profile } : {}) }
      : {
          permission,
          resource,
          ...(profile !== undefined ? { profile } : {}),
        };
  return checkCapability(grant, request);
}

function denied(
  reason: string,
  request: CapabilityCheckRequest,
): CapabilityCheckResult {
  return {
    allowed: false,
    reason,
  };
}
