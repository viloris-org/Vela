import Foundation

/// Logical content coordinates: origin top-left, y down (matches @vela/api).
struct VelaPoint: Equatable {
  var x: Double
  var y: Double
}

struct VelaRect: Equatable {
  var x: Double
  var y: Double
  var width: Double
  var height: Double

  func contains(_ p: VelaPoint) -> Bool {
    p.x >= x && p.y >= y && p.x < x + width && p.y < y + height
  }

  static let zero = VelaRect(x: 0, y: 0, width: 0, height: 0)
}

enum VelaRegionPrimitive {
  case rect(VelaRect)
  case roundedRect(VelaRect, radius: Double)
  case capsule(VelaRect)
}

struct VelaRegion {
  var primitives: [VelaRegionPrimitive] = []

  func contains(_ p: VelaPoint) -> Bool {
    for prim in primitives {
      switch prim {
      case .rect(let r), .capsule(let r), .roundedRect(let r, _):
        if r.contains(p) { return true }
      }
    }
    return false
  }

  var isEmpty: Bool { primitives.isEmpty }
}
