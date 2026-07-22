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

function formatTime(now: Date, format: Format): string {
  let hours = now.getHours();
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());
  if (format === "24h") {
    return `${pad2(hours)}:${minutes}:${seconds}`;
  }
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  return `${hours}:${minutes}:${seconds} ${ampm}`;
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
  vela.hit.setMainOpaqueRegions(region);
}

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
      zIndex: 20,
      shape: { type: "roundedRect", radius: CARD_RADIUS },
      samples: { type: "layers-below" },
      variant: "regular",
      interactive: true,
      hitPolicy: { mode: "opaque" },
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

function startClock(
  format: { value: Format },
  onTick?: () => void,
): () => void {
  const timeEl = requireEl("time");
  const dateEl = requireEl("date");

  const tick = (): void => {
    const now = new Date();
    timeEl.textContent = formatTime(now, format.value);
    dateEl.textContent = formatDate(now);
    onTick?.();
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
    appendLog(
      requireEl("status-log"),
      `format → ${state.format.value}`,
    );
  });

  requireEl("btn-push-regions").addEventListener("click", () => {
    pushRegions(vela, state.generation);
    appendLog(requireEl("status-log"), "pushed opaque regions");
  });

  window.addEventListener("resize", () => {
    pushRegions(vela, state.generation);
  });
}

async function main(): Promise<void> {
  const modePill = requireEl("mode-pill");
  const logEl = requireEl("status-log");
  const hostInjected = window.vela !== undefined;

  let vela: VelaPreloadBridge;
  if (hostInjected && window.vela) {
    vela = window.vela;
    modePill.textContent = `host ${vela.version}`;
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
  await ensureMaterialCard(vela);
  pushRegions(vela, state.generation);

  appendLog(
    logEl,
    hostInjected
      ? "ready — using host window.vela"
      : "ready — mock bridge; open in a Vela host for real material/hit",
  );
}

void main();
