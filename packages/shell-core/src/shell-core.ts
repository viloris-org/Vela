import type {
  ApplyWebShapeResult,
  HitTarget,
  InsertLayerSpec,
  Layer,
  LayerId,
  LayerPatch,
  LayerTreeSnapshot,
  PermissionId,
  PlatformId,
  Point,
  Rect,
  Region,
  ResolvedMaterial,
  VelaPreloadBridge,
  WebShapeUpdate,
  WindowId,
  WindowInputMode,
} from "@vela/api";
import {
  insertLayerPermissionsGranted,
  permissionsForInsertLayer,
  resolveHit,
  resolveMaterial,
} from "@vela/api";
import { DOGFOOD_LAYER_IDS } from "./ids.ts";
import { createEventBus, type ShellEventHandler } from "./events.ts";
import { insertPermissionDenied } from "./errors.ts";
import { createLayerTree } from "./layer-tree.ts";
import { createWebShapeStore } from "./web-shape-store.ts";

export type ShellCoreOptions = {
  readonly windowId?: WindowId;
  readonly platform?: PlatformId;
  readonly initialWindowMode?: WindowInputMode;
  readonly supportsLiquidGlass?: boolean;
  /**
   * Active profile permissions for page-facing layer inserts (`insertLayer`).
   * Default `[]` — default-deny for material / camera / other gated kinds.
   * Host-owned bootstrap should use `insertLayerPrivileged`.
   */
  readonly profilePermissions?: readonly PermissionId[];
};

export type ShellCore = {
  /**
   * Page / bridge insert path: enforces `permissionsForInsertLayer`
   * against the active profile grant.
   */
  insertLayer(spec: InsertLayerSpec): Layer;
  /**
   * Host / bootstrap insert path: skips capability gates
   * (dogfood stack, L4-owned underlays, chrome).
   */
  insertLayerPrivileged(spec: InsertLayerSpec): Layer;
  updateLayer(id: LayerId, patch: LayerPatch): Layer;
  removeLayer(id: LayerId): void;
  listLayers(): readonly Layer[];
  reorderLayer(id: LayerId, zIndex: number): Layer;

  setProfilePermissions(permissions: readonly PermissionId[]): void;
  getProfilePermissions(): readonly PermissionId[];

  setInputMode(mode: WindowInputMode): void;
  getInputMode(): WindowInputMode;

  setOpaqueRegions(update: WebShapeUpdate): ApplyWebShapeResult;
  setMainOpaqueRegions(region: Region): ApplyWebShapeResult;

  /** Pure hit query; does not mutate lastHit. */
  resolvePointer(point: Point): HitTarget;
  /** Resolve, store lastHit, emit debug.hit. */
  pointerDown(point: Point): HitTarget;
  lastHit(): HitTarget | undefined;

  snapshot(): LayerTreeSnapshot;
  subscribe(channel: string, handler: ShellEventHandler): () => void;

  /**
   * Resolve dogfood toolbar material for current platform options.
   * Emits material.degraded when the result is degraded.
   */
  resolveToolbarMaterial(requested?: ResolvedMaterial["requested"]): ResolvedMaterial;
};

export function createShellCore(options: ShellCoreOptions = {}): ShellCore {
  const windowId = options.windowId ?? "window-1";
  const platform = options.platform ?? "unknown";
  const supportsLiquidGlass = options.supportsLiquidGlass ?? false;

  const tree = createLayerTree();
  const regions = createWebShapeStore(DOGFOOD_LAYER_IDS.mainWebview);
  const bus = createEventBus();

  let windowMode: WindowInputMode = options.initialWindowMode ?? {
    mode: "normal",
  };
  let lastHitTarget: HitTarget | undefined;
  let snapshotGeneration = 0;
  let profilePermissions: readonly PermissionId[] =
    options.profilePermissions ?? [];

  function assertInsertAllowed(spec: InsertLayerSpec): void {
    const required = permissionsForInsertLayer(spec);
    if (!insertLayerPermissionsGranted(profilePermissions, required)) {
      throw insertPermissionDenied(required, spec.kind);
    }
  }

  const core: ShellCore = {
    insertLayer(spec) {
      assertInsertAllowed(spec);
      return tree.insert(spec);
    },
    insertLayerPrivileged(spec) {
      return tree.insert(spec);
    },
    updateLayer(id, patch) {
      return tree.update(id, patch);
    },
    removeLayer(id) {
      tree.remove(id);
    },
    listLayers() {
      return tree.list();
    },
    reorderLayer(id, zIndex) {
      return tree.reorder(id, zIndex);
    },

    setProfilePermissions(permissions) {
      profilePermissions = [...permissions];
    },
    getProfilePermissions() {
      return profilePermissions;
    },

    setInputMode(mode) {
      windowMode = mode;
    },
    getInputMode() {
      return windowMode;
    },

    setOpaqueRegions(update) {
      return regions.setOpaqueRegions(update);
    },
    setMainOpaqueRegions(region) {
      return regions.setMainOpaqueRegions(region);
    },

    resolvePointer(point) {
      return resolveHit(windowMode, tree.list(), regions.getStore(), point);
    },
    pointerDown(point) {
      const target = core.resolvePointer(point);
      lastHitTarget = target;
      bus.emit("debug.hit", target);
      return target;
    },
    lastHit() {
      return lastHitTarget;
    },

    snapshot() {
      snapshotGeneration += 1;
      return {
        windowId,
        generation: snapshotGeneration,
        layers: tree.list(),
        opaqueRegions: regions.snapshotEntries(),
      };
    },

    subscribe(channel, handler) {
      return bus.subscribe(channel, handler);
    },

    resolveToolbarMaterial(requested = "apple.liquidGlass") {
      const resolved = resolveMaterial(requested, platform, {
        supportsLiquidGlass,
      });
      if (resolved.degraded) {
        bus.emit("material.degraded", resolved);
      }
      return resolved;
    },
  };

  return core;
}

/** Re-export type for callers that only need the facade. */
export type { Rect, VelaPreloadBridge };
