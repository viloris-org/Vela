/**
 * Pure material paint-path planner.
 *
 * `resolveMaterial` answers "which MaterialId should we claim on this OS?".
 * `planMaterialPaint` answers "how will the Shell actually paint it given a
 * runtime session probe?" — including honest degrade reasons.
 */

import type { ShellSessionProbe } from "../session/features.ts";
import { hasSessionFeature } from "../session/features.ts";
import type {
  BackdropSource,
  MaterialId,
  PlatformId,
  ResolvedMaterial,
} from "./spec.ts";
import { resolveMaterial } from "./spec.ts";

/**
 * How the Shell paints a material layer after resolve + session probe.
 * Paths are portable; protocol names stay in host diagnostics.
 */
export type MaterialPaintPath =
  /** OS system material (Liquid Glass, Mica, Acrylic, …). */
  | "native-system"
  /** Compositor blurs content behind the window surface. */
  | "compositor-window-blur"
  /** Snapshot of layers below + blur filter (not live glass). */
  | "snapshot-blur"
  /** Translucent solid/chrome with no sampling. */
  | "translucent-chrome"
  /** Explicit CSS fallback material. */
  | "css-fallback";

export interface MaterialPaintPlan {
  readonly requested: MaterialId;
  readonly effective: MaterialId;
  readonly platform: PlatformId;
  readonly path: MaterialPaintPath;
  readonly degraded: boolean;
  readonly reason?: string;
  /** Session resolve used as input (preference only). */
  readonly resolved: ResolvedMaterial;
}

export interface PlanMaterialPaintOptions {
  readonly supportsLiquidGlass?: boolean;
  readonly samples?: BackdropSource;
  readonly session?: ShellSessionProbe | null;
}

function plan(
  requested: MaterialId,
  effective: MaterialId,
  platform: PlatformId,
  path: MaterialPaintPath,
  degraded: boolean,
  resolved: ResolvedMaterial,
  reason?: string | undefined,
): MaterialPaintPlan {
  if (reason !== undefined) {
    return { requested, effective, platform, path, degraded, reason, resolved };
  }
  return { requested, effective, platform, path, degraded, resolved };
}

/**
 * Plan paint path for a material request.
 * Prefer calling after the host has filled `ShellSessionProbe`.
 */
export function planMaterialPaint(
  requested: MaterialId,
  platform: PlatformId,
  options?: PlanMaterialPaintOptions,
): MaterialPaintPlan {
  const resolveOpts =
    options?.supportsLiquidGlass === undefined
      ? undefined
      : { supportsLiquidGlass: options.supportsLiquidGlass };
  const resolved = resolveMaterial(requested, platform, resolveOpts);
  const samples: BackdropSource = options?.samples ?? { type: "layers-below" };
  const session = options?.session ?? null;

  if (resolved.effective === "fallback.css") {
    return plan(
      requested,
      "fallback.css",
      platform,
      "css-fallback",
      resolved.degraded,
      resolved,
      resolved.reason ?? "CSS material fallback",
    );
  }

  if (platform === "macos" || platform === "ios") {
    if (
      resolved.effective === "apple.liquidGlass" ||
      resolved.effective === "apple.material"
    ) {
      return plan(
        requested,
        resolved.effective,
        platform,
        "native-system",
        resolved.degraded,
        resolved,
        resolved.reason,
      );
    }
  }

  if (platform === "windows") {
    if (
      resolved.effective === "win.mica" ||
      resolved.effective === "win.acrylic" ||
      resolved.effective === "win.smoke"
    ) {
      return plan(
        requested,
        resolved.effective,
        platform,
        "native-system",
        resolved.degraded,
        resolved,
        resolved.reason,
      );
    }
  }

  if (platform === "linux") {
    return planLinuxPaint(requested, resolved, samples, session);
  }

  return plan(
    requested,
    resolved.effective,
    platform,
    "css-fallback",
    true,
    resolved,
    resolved.reason ?? "No system material paint path",
  );
}

function planLinuxPaint(
  requested: MaterialId,
  resolved: ResolvedMaterial,
  samples: BackdropSource,
  session: ShellSessionProbe | null,
): MaterialPaintPlan {
  const effective: MaterialId =
    resolved.effective === "gtk.blur" ? "gtk.blur" : resolved.effective;

  // True layers-below live glass (rare on Linux desktop).
  if (
    samples.type === "layers-below" &&
    hasSessionFeature(session, "material.backdrop.layers-below")
  ) {
    return plan(
      requested,
      effective,
      "linux",
      "native-system",
      resolved.degraded,
      resolved,
      resolved.reason,
    );
  }

  // Host snapshot blur of layers below.
  if (
    samples.type === "layers-below" &&
    hasSessionFeature(session, "material.backdrop.snapshot")
  ) {
    return plan(
      requested,
      effective,
      "linux",
      "snapshot-blur",
      true,
      resolved,
      "snapshot-blur: layers-below approximated by host snapshot (not live glass)",
    );
  }

  // Compositor window-behind blur (ext-background-effect-v1, KDE blur, …).
  // Maps only when samples policy is window-content, or when layers-below is
  // unavailable and we accept compositor-behind as a degraded substitute.
  const canWindowBehind = hasSessionFeature(
    session,
    "material.backdrop.window-behind",
  );

  if (canWindowBehind && samples.type === "window-content") {
    return plan(
      requested,
      effective,
      "linux",
      "compositor-window-blur",
      resolved.degraded,
      resolved,
      resolved.reason ?? "compositor-window-blur",
    );
  }

  if (canWindowBehind && samples.type === "layers-below") {
    return plan(
      requested,
      effective,
      "linux",
      "compositor-window-blur",
      true,
      resolved,
      "compositor-window-blur: samples layers-below unavailable; using window-behind blur",
    );
  }

  if (canWindowBehind && samples.type === "layer") {
    return plan(
      requested,
      effective,
      "linux",
      "compositor-window-blur",
      true,
      resolved,
      "compositor-window-blur: specific-layer sampling unavailable; using window-behind blur",
    );
  }

  return plan(
    requested,
    effective,
    "linux",
    "translucent-chrome",
    true,
    resolved,
    "no-backdrop-blur: translucent host chrome (no compositor/snapshot path)",
  );
}
