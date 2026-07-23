/**
 * Minimal clock example for Vela App TS.
 * Uses host preload window.vela when present; falls back to an in-page mock.
 *
 * Demonstrates:
 * - digital clock UI in the WebView
 * - material layer insert for a glass card
 * - web-shaped opaque regions (card + status; outside is a hole)
 */
import type { Rect, Region, VelaPreloadBridge } from "@vela/api";
import { installMockVela, MAIN_LAYER_ID } from "./mock-vela.ts";

const MATERIAL_LAYER_ID = "clock-material";
const CARD_RADIUS = 28;
const STATUS_RADIUS = 12;

type Format = "12h" | "24h";

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

function appendLog(logEl: HTMLElement, line: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  logEl.textContent = `[${stamp}] ${line}\n${logEl.textContent ?? ""}`.slice(
    0,
    1000,
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Digits only; AM/PM lives in a separate smaller element so it never wraps. */
function formatTimeDigits(now: Date, format: Format): string {
  let hours = now.getHours();
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());
  if (format === "24h") {
    return `${pad2(hours)}:${minutes}:${seconds}`;
  }
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  return `${hours}:${minutes}:${seconds}`;
}

function formatAmPm(now: Date): "AM" | "PM" {
  return now.getHours() >= 12 ? "PM" : "AM";
}

function formatDate(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function collectOpaqueRegions(): Region {
  const card = requireEl("clock-card");
  const status = requireEl("status");
  return {
    primitives: [
      {
        type: "roundedRect",
        rect: clientRect(card),
        radius: CARD_RADIUS,
      },
      {
        type: "roundedRect",
        rect: clientRect(status),
        radius: STATUS_RADIUS,
      },
    ],
  };
}

/**
 * Push web-shaped opaque regions for the main WebView.
 * Prefer the generation-bearing API only (docs: setMainOpaqueRegions is a
 * convenience alias — calling both double-applies and confuses mock gen).
 */
function pushRegions(
  vela: VelaPreloadBridge,
  generation: { value: number },
): void {
  generation.value += 1;
  const region = collectOpaqueRegions();
  requireEl("status-gen").textContent = `generation: ${generation.value}`;

  vela.hit.setOpaqueRegions({
    layerId: MAIN_LAYER_ID,
    opaqueRegions: region,
    generation: generation.value,
  });
}

/**
 * Glass card sits *under* the WebView (z 8 < main-webview 10) so clock UI stays
 * hittable via web-shaped regions. Host paints material behind a transparent WebView.
 */
async function ensureMaterialCard(vela: VelaPreloadBridge): Promise<void> {
  const card = requireEl("clock-card");
  const bounds = clientRect(card);
  const logEl = requireEl("status-log");

  try {
    const result = await vela.layers.insert({
      id: MATERIAL_LAYER_ID,
      kind: "material",
      material: "apple.liquidGlass",
      bounds,
      // Between underlay (5) and main-webview (10): backdrop glass, not chrome-on-top.
      zIndex: 8,
      shape: { type: "roundedRect", radius: CARD_RADIUS },
      samples: { type: "layers-below" },
      variant: "regular",
      interactive: false,
      // Web owns card hits (web-shaped). Material is visual only.
      hitPolicy: { mode: "transparent" },
    });
    card.dataset["nativeMaterial"] = "requested";
    appendLog(logEl, `layers.insert material ok id=${result.id}`);
  } catch (err) {
    appendLog(
      logEl,
      `layers.insert material fallback: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function syncMaterialBounds(vela: VelaPreloadBridge): Promise<void> {
  const card = requireEl("clock-card");
  try {
    await vela.layers.update(MATERIAL_LAYER_ID, {
      bounds: clientRect(card),
    });
  } catch {
    // Host may not support update yet; insert already set initial bounds.
  }
}

/** After layout-affecting UI changes, re-push regions + material bounds. */
function syncLayout(
  vela: VelaPreloadBridge,
  generation: { value: number },
): void {
  // Two rAFs: first applies DOM/text changes, second reads settled boxes.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pushRegions(vela, generation);
      void syncMaterialBounds(vela);
    });
  });
}

function paintClock(format: Format): void {
  const now = new Date();
  requireEl("time").textContent = formatTimeDigits(now, format);
  const ampm = requireEl("ampm");
  if (format === "12h") {
    ampm.hidden = false;
    ampm.textContent = formatAmPm(now);
  } else {
    ampm.hidden = true;
    ampm.textContent = "";
  }
  requireEl("date").textContent = formatDate(now);
}

function startClock(format: { value: Format }): () => void {
  const tick = (): void => {
    paintClock(format.value);
  };

  tick();
  const id = window.setInterval(tick, 250);
  return () => window.clearInterval(id);
}

function wireUi(
  vela: VelaPreloadBridge,
  state: { format: { value: Format }; generation: { value: number } },
): void {
  const formatBtn = requireEl("btn-format");
  formatBtn.addEventListener("click", () => {
    state.format.value = state.format.value === "12h" ? "24h" : "12h";
    formatBtn.textContent = state.format.value === "12h" ? "12h" : "24h";
    formatBtn.setAttribute(
      "aria-pressed",
      state.format.value === "24h" ? "true" : "false",
    );
    // Immediate repaint (don't wait up to 250ms for the interval).
    paintClock(state.format.value);
    // 12h↔24h can change card width slightly; keep material + hit in sync.
    syncLayout(vela, state.generation);
    appendLog(
      requireEl("status-log"),
      `format → ${state.format.value}`,
    );
  });

  requireEl("btn-push-regions").addEventListener("click", () => {
    pushRegions(vela, state.generation);
    void syncMaterialBounds(vela);
    appendLog(requireEl("status-log"), "pushed opaque regions");
  });

  window.addEventListener("resize", () => {
    syncLayout(vela, state.generation);
  });
}

async function main(): Promise<void> {
  const modePill = requireEl("mode-pill");
  const logEl = requireEl("status-log");
  // Host preload injects window.vela before document scripts run.
  const hostInjected = window.vela !== undefined;

  let vela: VelaPreloadBridge;
  if (hostInjected && window.vela) {
    vela = window.vela;
    modePill.textContent = `host ${vela.version}`;
    // Native underlay is painted by the Shell; hide the CSS stand-in.
    requireEl("underlay-sim").style.display = "none";
    document.documentElement.dataset["velaHost"] = "1";
  } else {
    vela = installMockVela({
      onLog: (line) => appendLog(logEl, line),
      onGeneration: (gen) => {
        requireEl("status-gen").textContent = `generation: ${gen}`;
      },
    });
    modePill.textContent = `mock ${vela.version}`;
  }

  const state = {
    format: { value: "24h" as Format },
    generation: { value: 0 },
  };

  requireEl("btn-format").textContent = "24h";
  requireEl("btn-format").setAttribute("aria-pressed", "true");

  vela.events.subscribe("material.degraded", (payload) => {
    appendLog(logEl, `material.degraded ${JSON.stringify(payload)}`);
  });

  wireUi(vela, state);
  startClock(state.format);

  // Layout must settle once so card bounds match host logical coords.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  await ensureMaterialCard(vela);
  pushRegions(vela, state.generation);

  appendLog(
    logEl,
    hostInjected
      ? "ready — host window.vela (material + web-shaped hit)"
      : "ready — mock only; use linux-shell --url for host path",
  );
}

void main();
