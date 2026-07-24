import type { InsertLayerSpec, Rect } from "@vela/api";
import { DOGFOOD_LAYER_IDS } from "./ids.ts";
import type { ShellCore } from "./shell-core.ts";

const TOOLBAR_HEIGHT = 52;
const TOOLBAR_INSET_X = 16;
const TOOLBAR_INSET_Y = 12;

/**
 * Phase 1 dogfood stack: underlay + main webview + capsule material toolbar.
 * Bounds are logical content coords (origin top-left, y down).
 */
export function dogfoodBootstrapSpecs(
  contentBounds: Rect,
): readonly InsertLayerSpec[] {
  const toolbarWidth = Math.max(0, contentBounds.width - TOOLBAR_INSET_X * 2);
  const toolbar: InsertLayerSpec = {
    id: DOGFOOD_LAYER_IDS.toolbarMaterial,
    kind: "material",
    material: "apple.liquidGlass",
    bounds: {
      x: contentBounds.x + TOOLBAR_INSET_X,
      y: contentBounds.y + TOOLBAR_INSET_Y,
      width: toolbarWidth,
      height: TOOLBAR_HEIGHT,
    },
    zIndex: 30,
    shape: { type: "capsule" },
    samples: { type: "layers-below" },
    variant: "regular",
    interactive: true,
    hitPolicy: { mode: "opaque" },
  };

  return [
    {
      id: DOGFOOD_LAYER_IDS.underlay,
      kind: "native",
      component: "dogfood.underlay",
      bounds: contentBounds,
      zIndex: 5,
      hitPolicy: { mode: "opaque" },
    },
    {
      id: DOGFOOD_LAYER_IDS.mainWebview,
      kind: "webview",
      bounds: contentBounds,
      zIndex: 10,
      // defaultHitPolicyForKind → web-shaped; empty until page reports
    },
    toolbar,
  ];
}

export function applyDogfoodBootstrap(
  core: ShellCore,
  contentBounds: Rect,
): void {
  // Host-owned stack: privileged insert (material toolbar is not page-granted).
  for (const spec of dogfoodBootstrapSpecs(contentBounds)) {
    core.insertLayerPrivileged(spec);
  }
  // Resolve material path for diagnostics (degrade on non-glass platforms).
  core.resolveToolbarMaterial("apple.liquidGlass");
}
