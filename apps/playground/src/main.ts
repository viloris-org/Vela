/**
 * Phase 1 dogfood content.
 * Assumes host preload may inject window.vela (layers + hit).
 * Falls back to in-page mock for static browser serve.
 *
 * @see docs/macos-spike-architecture.md — Dogfood content (minimum)
 */
import type { Region, Rect, VelaPreloadBridge } from "@vela/api";
import { installMockVela, MAIN_LAYER_ID } from "./mock-vela.ts";

const TOOLBAR_LAYER_ID = "toolbar-material";

type HudEls = {
  mode: HTMLElement;
  hit: HTMLElement;
  gen: HTMLElement;
  log: HTMLElement;
};

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`missing #${id}`);
  }
  return el;
}

function clientRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return {
    x: r.left,
    y: r.top,
    width: r.width,
    height: r.height,
  };
}

/** Collect opaque hit regions: panel + toolbar chrome (not the hole). */
function collectOpaqueRegions(panelVisible: boolean): Region {
  const primitives: Region["primitives"][number][] = [];

  const toolbar = requireEl("toolbar-chrome");
  primitives.push({ type: "capsule", rect: clientRect(toolbar) });

  const hud = requireEl("hud");
  primitives.push({
    type: "roundedRect",
    rect: clientRect(hud),
    radius: 12,
  });

  if (panelVisible) {
    const panel = requireEl("panel");
    primitives.push({
      type: "roundedRect",
      rect: clientRect(panel),
      radius: 16,
    });
  }

  return { primitives };
}

function appendLog(logEl: HTMLElement, line: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  logEl.textContent = `[${stamp}] ${line}\n${logEl.textContent ?? ""}`.slice(
    0,
    1200,
  );
}

async function ensureMaterialToolbar(vela: VelaPreloadBridge): Promise<void> {
  const toolbar = requireEl("toolbar-chrome");
  const bounds = clientRect(toolbar);

  try {
    const result = await vela.layers.insert({
      id: TOOLBAR_LAYER_ID,
      kind: "material",
      material: "apple.liquidGlass",
      bounds,
      zIndex: 30,
      shape: { type: "capsule" },
      samples: { type: "layers-below" },
      variant: "regular",
      interactive: true,
      hitPolicy: { mode: "opaque" },
    });
    appendLog(
      requireEl("hud-log"),
      `layers.insert material ok id=${result.id}`,
    );
    // Hide CSS stand-in when native material layer is registered (host may still show CSS until wired)
    toolbar.dataset["nativeMaterial"] = "requested";
  } catch (err) {
    const note = document.createElement("div");
    note.className = "material-fallback-note";
    note.textContent =
      "Material layer insert unavailable — CSS toolbar stand-in";
    document.body.appendChild(note);
    appendLog(
      requireEl("hud-log"),
      `layers.insert material fallback: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function pushRegions(
  vela: VelaPreloadBridge,
  panelVisible: boolean,
  generation: { value: number },
): void {
  generation.value += 1;
  const region = collectOpaqueRegions(panelVisible);
  const genEl = requireEl("hud-gen");
  genEl.textContent = `generation: ${generation.value}`;

  vela.hit.setOpaqueRegions({
    layerId: MAIN_LAYER_ID,
    opaqueRegions: region,
    generation: generation.value,
  });
  vela.hit.setMainOpaqueRegions(region);
}

function wireUi(
  vela: VelaPreloadBridge,
  state: { panelVisible: boolean; generation: { value: number } },
): void {
  requireEl("btn-refresh-regions").addEventListener("click", () => {
    pushRegions(vela, state.panelVisible, state.generation);
  });

  requireEl("btn-toggle-panel").addEventListener("click", () => {
    state.panelVisible = !state.panelVisible;
    const panel = requireEl("panel");
    panel.style.display = state.panelVisible ? "" : "none";
    pushRegions(vela, state.panelVisible, state.generation);
  });

  requireEl("btn-panel-action").addEventListener("click", () => {
    appendLog(requireEl("hud-log"), "panel action click (web opaque region)");
  });

  window.addEventListener("resize", () => {
    pushRegions(vela, state.panelVisible, state.generation);
  });
}

function subscribeDebug(vela: VelaPreloadBridge, hud: HudEls): void {
  vela.events.subscribe("debug.hit", (payload) => {
    hud.hit.textContent = `last hit: ${JSON.stringify(payload)}`;
  });
  vela.events.subscribe("material.degraded", (payload) => {
    appendLog(hud.log, `material.degraded ${JSON.stringify(payload)}`);
  });
}

async function main(): Promise<void> {
  const hud: HudEls = {
    mode: requireEl("hud-mode"),
    hit: requireEl("hud-hit"),
    gen: requireEl("hud-gen"),
    log: requireEl("hud-log"),
  };

  const hostInjected = window.vela !== undefined;
  let vela: VelaPreloadBridge;

  if (hostInjected && window.vela) {
    vela = window.vela;
    hud.mode.textContent = `mode: host preload (vela ${vela.version})`;
  } else {
    vela = installMockVela({
      onLog: (line) => appendLog(hud.log, line),
      onGeneration: (gen) => {
        hud.gen.textContent = `generation: ${gen}`;
      },
      onHit: (text) => {
        hud.hit.textContent = `last hit: ${text}`;
      },
    });
    hud.mode.textContent = `mode: mock (${vela.version})`;
  }

  const state = {
    panelVisible: true,
    generation: { value: 0 },
  };

  subscribeDebug(vela, hud);
  wireUi(vela, state);
  await ensureMaterialToolbar(vela);
  pushRegions(vela, state.panelVisible, state.generation);

  appendLog(
    hud.log,
    hostInjected
      ? "ready — using host window.vela"
      : "ready — mock bridge; open in desktop-shell for real hit/material",
  );
}

void main();
