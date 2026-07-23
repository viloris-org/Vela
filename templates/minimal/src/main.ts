/**
 * Minimal Vela App entry.
 * Uses host preload window.vela when present; otherwise installs an in-page mock.
 */
import type { VelaPreloadBridge } from "@vela/api";
import { installMockVela } from "./mock-vela.ts";

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function getBridge(): VelaPreloadBridge {
  if (window.vela) return window.vela;
  return installMockVela();
}

function main(): void {
  const bridge = getBridge();
  const status = requireEl("bridge-status");
  const version = requireEl("version");

  const isMock = bridge.version.endsWith("-mock");
  status.textContent = isMock
    ? "bridge: in-page mock (no host preload)"
    : "bridge: host preload window.vela";
  version.textContent = `vela.version = ${bridge.version}`;

  console.info("[minimal] ready", { version: bridge.version, mock: isMock });
}

main();
