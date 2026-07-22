import type {
  InsertLayerSpec,
  Layer,
  LayerId,
  LayerPatch,
} from "@vela/api";
import { defaultHitPolicyForKind } from "@vela/api";
import { layerNotFound } from "./errors.ts";

export type LayerTree = {
  insert(spec: InsertLayerSpec): Layer;
  update(id: LayerId, patch: LayerPatch): Layer;
  remove(id: LayerId): void;
  list(): readonly Layer[];
  reorder(id: LayerId, zIndex: number): Layer;
  get(id: LayerId): Layer | undefined;
};

function nextAutoId(counter: { value: number }): LayerId {
  counter.value += 1;
  return `layer-${counter.value}`;
}

function materialize(spec: InsertLayerSpec, id: LayerId): Layer {
  const visible = spec.visible ?? true;
  const opacity = spec.opacity ?? 1;
  const hitPolicy = spec.hitPolicy ?? defaultHitPolicyForKind(spec.kind);
  const base = {
    id,
    bounds: spec.bounds,
    zIndex: spec.zIndex,
    visible,
    opacity,
    hitPolicy,
    ...(spec.clip !== undefined ? { clip: spec.clip } : {}),
  };

  switch (spec.kind) {
    case "webview":
      return {
        ...base,
        kind: "webview",
        ...(spec.url !== undefined ? { url: spec.url } : {}),
        ...(spec.preloadProfile !== undefined
          ? { preloadProfile: spec.preloadProfile }
          : {}),
        ...(spec.capabilities !== undefined
          ? { capabilities: spec.capabilities }
          : {}),
      };
    case "native":
      return {
        ...base,
        kind: "native",
        component: spec.component,
        ...(spec.props !== undefined ? { props: spec.props } : {}),
      };
    case "material":
      return {
        ...base,
        kind: "material",
        material: spec.material,
        shape: spec.shape ?? { type: "rect" },
        samples: spec.samples ?? { type: "layers-below" },
        variant: spec.variant ?? "regular",
        interactive: spec.interactive ?? true,
        ...(spec.tint !== undefined ? { tint: spec.tint } : {}),
      };
    case "chrome":
      return {
        ...base,
        kind: "chrome",
        role: spec.role,
      };
    case "passthrough":
      return {
        ...base,
        kind: "passthrough",
      };
  }
}

function applyPatch(layer: Layer, patch: LayerPatch): Layer {
  const nextBase = {
    ...layer,
    ...(patch.bounds !== undefined ? { bounds: patch.bounds } : {}),
    ...(patch.zIndex !== undefined ? { zIndex: patch.zIndex } : {}),
    ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
    ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
    ...(patch.hitPolicy !== undefined ? { hitPolicy: patch.hitPolicy } : {}),
  };

  let withClip: Layer;
  if (patch.clip === null) {
    const { clip: _drop, ...rest } = nextBase;
    withClip = rest as Layer;
  } else if (patch.clip !== undefined) {
    withClip = { ...nextBase, clip: patch.clip } as Layer;
  } else {
    withClip = nextBase as Layer;
  }

  if (withClip.kind === "webview" && patch.url !== undefined) {
    return { ...withClip, url: patch.url };
  }
  if (withClip.kind === "native" && patch.props !== undefined) {
    return { ...withClip, props: patch.props };
  }
  return withClip;
}

export function createLayerTree(): LayerTree {
  const layers = new Map<LayerId, Layer>();
  const autoId = { value: 0 };

  return {
    insert(spec) {
      const id = spec.id ?? nextAutoId(autoId);
      if (layers.has(id)) {
        throw new Error(`layer already exists: ${id}`);
      }
      const layer = materialize(spec, id);
      layers.set(id, layer);
      return layer;
    },
    update(id, patch) {
      const prev = layers.get(id);
      if (prev === undefined) {
        throw layerNotFound(id);
      }
      const next = applyPatch(prev, patch);
      layers.set(id, next);
      return next;
    },
    remove(id) {
      if (!layers.delete(id)) {
        throw layerNotFound(id);
      }
    },
    list() {
      return [...layers.values()].sort((a, b) => a.zIndex - b.zIndex);
    },
    reorder(id, zIndex) {
      return this.update(id, { zIndex });
    },
    get(id) {
      return layers.get(id);
    },
  };
}
