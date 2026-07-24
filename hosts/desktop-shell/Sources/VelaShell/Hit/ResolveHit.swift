import Foundation

enum HitTargetKind: String {
  case layer
  case windowBackground = "window-background"
  case osDesktop = "os-desktop"
}

struct HitTarget {
  var kind: HitTargetKind
  var layerId: String?
  var localPoint: VelaPoint
}

/// Minimal Swift mirror of packages/api resolveHit (MVP subset).
enum ResolveHit {
  static func resolve(
    layers: [LayerRecord],
    shapeStore: (String) -> OpaqueRegionEntry?,
    point: VelaPoint
  ) -> HitTarget {
    let sorted = layers.filter(\.visible).sorted { $0.zIndex > $1.zIndex }
    for layer in sorted {
      guard layer.bounds.contains(point) else { continue }
      if policyAccepts(layer: layer, shape: shapeStore(layer.id), point: point) {
        return HitTarget(kind: .layer, layerId: layer.id, localPoint: point)
      }
    }
    return HitTarget(kind: .windowBackground, layerId: nil, localPoint: point)
  }

  private static func policyAccepts(
    layer: LayerRecord,
    shape: OpaqueRegionEntry?,
    point: VelaPoint
  ) -> Bool {
    switch layer.hitPolicy.mode {
    case .solid, .opaque:
      return true
    case .transparent:
      return false
    case .webShaped:
      guard let entry = shape else { return false }
      if entry.regions.isEmpty { return false }
      return entry.regions.contains(point)
    case .mask:
      return layer.hitPolicy.maskRegion.contains(point)
    case .callback:
      return false
    }
  }

  static func format(_ target: HitTarget) -> String {
    switch target.kind {
    case .layer:
      return "layer:\(target.layerId ?? "?")"
    case .windowBackground:
      return "window-background"
    case .osDesktop:
      return "os-desktop"
    }
  }
}
