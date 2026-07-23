/**
 * Portable Shell session probe — runtime display/compositor capabilities.
 *
 * Hosts map OS/toolkit specifics (Wayland globals, DWM, AppKit, …) into these
 * feature ids. App-facing `window.vela` must not expose raw protocol names.
 *
 * @see docs/linux-spike-architecture.md (Wayland → feature map)
 * @see docs/materials.md
 */

import type { PlatformId } from "../material/spec.ts";

/** How the Shell is talking to the display server. */
export type DisplayBackend =
  | "wayland"
  | "x11"
  | "win32"
  | "appkit"
  | "android"
  | "unknown";

/**
 * Portable session features. Prefer dotted semantic ids over vendor protocol
 * strings. Hosts may report a subset; absence means "not advertised / not
 * probed / unavailable".
 */
export type ShellSessionFeature =
  /** Compositor can blur content *behind the window surface*. */
  | "material.backdrop.window-behind"
  /** Live sample of sibling layers below a material rect (Liquid Glass class). */
  | "material.backdrop.layers-below"
  /** Host can snapshot lower layers and paint a blur approximation. */
  | "material.backdrop.snapshot"
  /** Window can set a non-rectangular (or empty) input region for OS pass-through. */
  | "window.input-region"
  /** Fractional scale protocol / equivalent DPI reporting. */
  | "window.fractional-scale"
  /** Per-surface alpha / translucent toplevel. */
  | "window.alpha"
  /** Server-side window decorations control (optional). */
  | "window.server-decoration"
  /** Idle inhibit (keep screen awake). */
  | "session.idle-inhibit"
  /** Activation tokens (xdg-activation class). */
  | "session.activation";

/**
 * Runtime probe result filled by the Shell (L3/L4), not by page JS.
 * Diagnostics may hold host-private strings (e.g. Wayland interface names)
 * for logs — never ship them as app contract types.
 */
export interface ShellSessionProbe {
  readonly platform: PlatformId;
  readonly displayBackend: DisplayBackend;
  readonly features: readonly ShellSessionFeature[];
  /**
   * Host-private notes (protocol names, toolkit backend, probe errors).
   * For diagnostics only; not part of the app-facing API surface.
   */
  readonly diagnostics?: readonly string[];
}

export function hasSessionFeature(
  probe: ShellSessionProbe | null | undefined,
  feature: ShellSessionFeature,
): boolean {
  if (!probe) return false;
  return probe.features.includes(feature);
}

/** Empty probe used in pure tests / headless self-test. */
export function emptySessionProbe(
  platform: PlatformId = "unknown",
  displayBackend: DisplayBackend = "unknown",
): ShellSessionProbe {
  return { platform, displayBackend, features: [] };
}
