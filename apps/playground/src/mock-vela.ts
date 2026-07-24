/**
 * In-page mock when host preload has not injected window.vela.
 * Logs bridge calls and draws region overlays for layout review.
 * Optional capability grants exercise allow/deny for clipboard, fs, shell,
 * notify, and material insert gates.
 */
import type {
  InsertLayerSpec,
  LayerId,
  LayerPatch,
  Region,
  VelaPreloadBridge,
  WebShapeUpdate,
} from "@vela/api";
import {
  BuiltinPermissions,
  ClipboardMethods,
  FsMethods,
  NotifyMethods,
  ShellMethods,
  insertLayerPermissionsGranted,
  normalizeAppRelativePath,
  parseExternalUrl,
  permissionsForInsertLayer,
} from "@vela/api";

export type MockHudSink = {
  onLog: (line: string) => void;
  onGeneration: (gen: number) => void;
  onHit: (text: string) => void;
};

export type MockCapabilityController = {
  /** Current grant set (mutable for dogfood toggles). */
  permissions: Set<string>;
  grant(permission: string): void;
  revoke(permission: string): void;
  has(permission: string): boolean;
};

const MAIN_LAYER_ID = "main-webview";

function clearOverlays(): void {
  for (const el of document.querySelectorAll(".mock-region-overlay")) {
    el.remove();
  }
}

function drawRegionOverlays(region: Region): void {
  clearOverlays();
  for (const prim of region.primitives) {
    const box = document.createElement("div");
    box.className = "mock-region-overlay";
    if (prim.type === "circle") {
      const d = prim.radius * 2;
      box.style.left = `${prim.center.x - prim.radius}px`;
      box.style.top = `${prim.center.y - prim.radius}px`;
      box.style.width = `${d}px`;
      box.style.height = `${d}px`;
      box.style.borderRadius = "50%";
      box.dataset["kind"] = "circle";
    } else {
      const rect = prim.rect;
      box.style.left = `${rect.x}px`;
      box.style.top = `${rect.y}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      if (prim.type === "capsule") {
        box.dataset["kind"] = "capsule";
      } else if (prim.type === "roundedRect") {
        const r =
          typeof prim.radius === "number"
            ? prim.radius
            : Math.max(
                prim.radius.topLeft,
                prim.radius.topRight,
                prim.radius.bottomRight,
                prim.radius.bottomLeft,
              );
        box.style.borderRadius = `${r}px`;
        box.dataset["kind"] = "roundedRect";
      } else {
        box.dataset["kind"] = "rect";
      }
    }
    document.body.appendChild(box);
  }
}

export function installMockVela(
  hud: MockHudSink,
  options?: {
    /** Initial permissions (default: none — default-deny). */
    readonly permissions?: readonly string[];
  },
): VelaPreloadBridge & { readonly mockCaps: MockCapabilityController } {
  let generation = 0;
  const layers = new Map<LayerId, InsertLayerSpec>();
  const permissions = new Set(options?.permissions ?? []);
  const files = new Map<string, string>();
  let clipboardText = "";
  const openedUrls: string[] = [];
  let notifySeq = 0;

  const mockCaps: MockCapabilityController = {
    permissions,
    grant(permission) {
      permissions.add(permission);
    },
    revoke(permission) {
      permissions.delete(permission);
    },
    has(permission) {
      return permissions.has(permission);
    },
  };

  const log = (msg: string): void => {
    console.info(`[vela mock] ${msg}`);
    hud.onLog(msg);
  };

  function requirePerm(permission: string, method: string): void {
    if (!permissions.has(permission)) {
      throw new Error(`mock: capability denied: ${permission} (${method})`);
    }
  }

  function asRecord(args: unknown): Record<string, unknown> {
    if (args !== null && typeof args === "object" && !Array.isArray(args)) {
      return args as Record<string, unknown>;
    }
    return {};
  }

  const bridge: VelaPreloadBridge & { mockCaps: MockCapabilityController } = {
    version: "0.0.1-mock",
    mockCaps,

    async call(method: string, args?: unknown): Promise<unknown> {
      const o = asRecord(args);

      if (method === ClipboardMethods.write) {
        requirePerm(BuiltinPermissions.ClipboardWrite, method);
        if (typeof o.text !== "string") {
          throw new Error("clipboard.write: text must be a string");
        }
        clipboardText = o.text;
        log(`call(${method}) → ok`);
        return { ok: true };
      }
      if (method === ClipboardMethods.read) {
        requirePerm(BuiltinPermissions.ClipboardRead, method);
        log(`call(${method}) → ok`);
        return { text: clipboardText };
      }
      if (method === FsMethods.read) {
        if (typeof o.path !== "string") {
          throw new Error("fs.read: path must be a string");
        }
        const norm = normalizeAppRelativePath(o.path);
        if (!norm.ok) throw new Error(`fs.read: ${norm.reason}`);
        requirePerm(BuiltinPermissions.FsAppRead, method);
        const data = files.get(norm.path);
        if (data === undefined) {
          throw new Error(`fs.read: not found: ${norm.path}`);
        }
        log(`call(${method}, ${norm.path}) → ok`);
        return { data };
      }
      if (method === FsMethods.write) {
        if (typeof o.path !== "string") {
          throw new Error("fs.write: path must be a string");
        }
        if (typeof o.data !== "string") {
          throw new Error("fs.write: data must be a string");
        }
        const norm = normalizeAppRelativePath(o.path);
        if (!norm.ok) throw new Error(`fs.write: ${norm.reason}`);
        requirePerm(BuiltinPermissions.FsAppWrite, method);
        files.set(norm.path, o.data);
        log(`call(${method}, ${norm.path}) → ok`);
        return { ok: true };
      }
      if (method === ShellMethods.openExternal) {
        if (typeof o.url !== "string") {
          throw new Error("shell.openExternal: url must be a string");
        }
        const parsed = parseExternalUrl(o.url);
        if (!parsed.ok) {
          throw new Error(`shell.openExternal: ${parsed.reason}`);
        }
        requirePerm(BuiltinPermissions.ShellOpenExternal, method);
        openedUrls.push(parsed.href);
        log(`call(${method}, ${parsed.href}) → ok (mock, not OS)`);
        return { ok: true };
      }
      if (method === NotifyMethods.show) {
        requirePerm(BuiltinPermissions.NotifyShow, method);
        if (typeof o.title !== "string" || o.title.length === 0) {
          throw new Error("notify.show: title must be a non-empty string");
        }
        notifySeq += 1;
        const id =
          typeof o.id === "string" && o.id.length > 0
            ? o.id
            : `mock-notify-${notifySeq}`;
        log(`call(${method}, title=${o.title}) → id=${id}`);
        return { id };
      }

      log(`call(${method}, ${JSON.stringify(args ?? null)}) → deny-all stub`);
      throw new Error(`mock: capability denied: ${method}`);
    },

    layers: {
      async insert(spec: InsertLayerSpec): Promise<{ readonly id: LayerId }> {
        const required = permissionsForInsertLayer(spec);
        const granted = [...permissions];
        if (!insertLayerPermissionsGranted(granted, required)) {
          throw new Error(
            `mock: capability denied: insert kind=${spec.kind} requires ${required.join(", ") || "(none)"}`,
          );
        }
        const id = spec.id ?? `layer-${layers.size + 1}`;
        layers.set(id, spec);
        log(`layers.insert kind=${spec.kind} id=${id}`);
        return { id };
      },
      async update(id: LayerId, patch: LayerPatch): Promise<void> {
        log(`layers.update id=${id} keys=${Object.keys(patch).join(",")}`);
      },
      async remove(id: LayerId): Promise<void> {
        layers.delete(id);
        log(`layers.remove id=${id}`);
      },
    },

    hit: {
      setOpaqueRegions(update: WebShapeUpdate): void {
        if (update.generation !== undefined) {
          generation = update.generation;
          hud.onGeneration(generation);
        }
        const n = update.opaqueRegions.primitives.length;
        log(
          `hit.setOpaqueRegions layerId=${update.layerId} primitives=${n} gen=${update.generation ?? "—"}`,
        );
        drawRegionOverlays(update.opaqueRegions);
      },
      setMainOpaqueRegions(region: Region): void {
        generation += 1;
        hud.onGeneration(generation);
        log(
          `hit.setMainOpaqueRegions primitives=${region.primitives.length} gen=${generation} (layer=${MAIN_LAYER_ID})`,
        );
        drawRegionOverlays(region);
      },
    },

    events: {
      subscribe(
        channel: string,
        handler: (payload: unknown) => void,
      ): () => void {
        log(`events.subscribe channel=${channel}`);
        // Simulate a material.degraded notice in mock mode
        if (channel === "material.degraded") {
          queueMicrotask(() => {
            handler({
              material: "apple.liquidGlass",
              degraded: true,
              reason: "mock: no native material host",
            });
          });
        }
        if (channel === "debug.hit") {
          // Click tracking in mock approximates last target via data-hit
          const onPointer = (ev: PointerEvent): void => {
            const target = (ev.target as HTMLElement | null)?.closest?.(
              "[data-hit]",
            ) as HTMLElement | null;
            const kind = target?.dataset["hit"] ?? "hole/underlay";
            const text = `kind=webview-mock hit=${kind} @(${ev.clientX | 0},${ev.clientY | 0})`;
            hud.onHit(text);
            handler({
              kind: "webview",
              localPoint: { x: ev.clientX, y: ev.clientY },
              mockHit: kind,
            });
          };
          window.addEventListener("pointerdown", onPointer);
          return () => window.removeEventListener("pointerdown", onPointer);
        }
        return () => {
          log(`events.unsubscribe channel=${channel}`);
        };
      },
    },
  };

  Object.defineProperty(window, "vela", {
    value: bridge,
    configurable: true,
    writable: false,
  });

  log("installed mock window.vela (browser layout review)");
  return bridge;
}

export { MAIN_LAYER_ID };
