import Foundation

/// Dogfood layer ids — keep in lockstep with packages/shell-core DOGFOOD_LAYER_IDS.
enum DogfoodLayerIds {
  static let underlay = "underlay-native"
  static let mainWebview = "main-webview"
  static let toolbarMaterial = "toolbar-material"
}

enum LayerKind: String {
  case webview
  case native
  case material
  case chrome
  case passthrough
}

enum HitPolicyMode: String {
  case solid
  case opaque
  case transparent
  case webShaped = "web-shaped"
  case mask
  case callback
}

struct HitPolicy {
  var mode: HitPolicyMode = .solid
  var maskRegion: VelaRegion = VelaRegion()
}

struct LayerRecord {
  var id: String
  var kind: LayerKind
  var bounds: VelaRect
  var zIndex: Int
  var visible: Bool = true
  var opacity: Double = 1.0
  var hitPolicy: HitPolicy = HitPolicy()
}

struct OpaqueRegionEntry {
  var regions: VelaRegion = VelaRegion()
  var lastGeneration: UInt64?
}

/// In-memory layer tree + web-shaped store. Mirrors @vela/shell-core policy surface (subset).
final class LayerTree {
  private(set) var layers: [LayerRecord] = []
  private var shapeStore: [String: OpaqueRegionEntry] = [:]

  func find(_ id: String) -> LayerRecord? {
    layers.first { $0.id == id }
  }

  @discardableResult
  func upsert(_ layer: LayerRecord) -> LayerRecord {
    if let i = layers.firstIndex(where: { $0.id == layer.id }) {
      layers[i] = layer
      return layers[i]
    }
    layers.append(layer)
    return layer
  }

  @discardableResult
  func remove(_ id: String) -> Bool {
    let before = layers.count
    layers.removeAll { $0.id == id }
    shapeStore.removeValue(forKey: id)
    return layers.count < before
  }

  func listSortedByZDescending() -> [LayerRecord] {
    layers.filter(\.visible).sorted { $0.zIndex > $1.zIndex }
  }

  /// Apply web-shaped opaque regions; drop stale generations.
  @discardableResult
  func applyWebShape(layerId: String, region: VelaRegion, generation: UInt64?) -> Bool {
    var entry = shapeStore[layerId] ?? OpaqueRegionEntry()
    if let gen = generation, let last = entry.lastGeneration, gen < last {
      return false // stale
    }
    entry.regions = region
    if let gen = generation {
      entry.lastGeneration = gen
    }
    shapeStore[layerId] = entry
    return true
  }

  func shape(for layerId: String) -> OpaqueRegionEntry? {
    shapeStore[layerId]
  }

  /// Bootstrap underlay + main webview (apps insert material). Matches linux-shell minimal boot.
  func bootstrapMinimal(content: VelaRect) {
    layers.removeAll()
    shapeStore.removeAll()
    upsert(
      LayerRecord(
        id: DogfoodLayerIds.underlay,
        kind: .native,
        bounds: content,
        zIndex: 5,
        hitPolicy: HitPolicy(mode: .solid)
      )
    )
    upsert(
      LayerRecord(
        id: DogfoodLayerIds.mainWebview,
        kind: .webview,
        bounds: content,
        zIndex: 10,
        hitPolicy: HitPolicy(mode: .webShaped)
      )
    )
  }
}
