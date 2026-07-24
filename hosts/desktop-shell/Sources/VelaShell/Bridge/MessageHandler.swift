import AppKit
import Foundation
import WebKit

/// JSON bridge for window.vela message-pass (linux-shell protocol subset).
final class VelaMessageHandler: NSObject, WKScriptMessageHandler {
  weak var shell: ShellController?

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard message.name == "vela" else { return }
    shell?.handleBridgeMessage(message.body)
  }
}

extension ShellController {
  func handleBridgeMessage(_ body: Any) {
    let dict: [String: Any]
    if let d = body as? [String: Any] {
      dict = d
    } else if let s = body as? String,
              let data = s.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    {
      dict = obj
    } else {
      NSLog("[vela] bridge: unparseable message")
      return
    }

    let type = dict["type"] as? String ?? ""

    if type == "req" {
      handleRequest(dict)
      return
    }
    if type == "hit.setOpaqueRegions" {
      if let update = dict["update"] as? [String: Any] {
        applyOpaqueRegions(update)
      }
      return
    }
    if type == "hit.setMainOpaqueRegions" {
      if let regionObj = dict["region"] {
        let region = parseRegion(regionObj)
        _ = layerTree.applyWebShape(
          layerId: DogfoodLayerIds.mainWebview,
          region: region,
          generation: nil
        )
        NSLog("[vela] hit.setMainOpaqueRegions applied")
      }
      return
    }
  }

  private func handleRequest(_ dict: [String: Any]) {
    let id = dict["id"] as? String ?? ""
    let method = dict["method"] as? String ?? ""
    let args = dict["args"]

    switch method {
    case "call":
      reply(id: id, ok: false, error: [
        "code": "capability.denied",
        "message": "call is deny-all in desktop-shell MVP",
      ])
    case "layers.insert":
      handleLayerInsert(id: id, args: args)
    case "layers.update":
      handleLayerUpdate(id: id, args: args)
    case "layers.remove":
      handleLayerRemove(id: id, args: args)
    default:
      reply(id: id, ok: false, error: [
        "code": "method.unknown",
        "message": "unknown method \(method)",
      ])
    }
  }

  private func handleLayerInsert(id: String, args: Any?) {
    guard let spec = args as? [String: Any],
          let layerId = spec["id"] as? String
    else {
      reply(id: id, ok: false, error: ["code": "invalid", "message": "layers.insert needs id"])
      return
    }

    let kindStr = spec["kind"] as? String ?? "native"
    let kind = LayerKind(rawValue: kindStr) ?? .native
    let bounds = parseRect(spec["bounds"]) ?? VelaRect(x: 0, y: 0, width: contentSize.width, height: contentSize.height)
    let zIndex = (spec["zIndex"] as? Int) ?? (spec["zIndex"] as? Double).map { Int($0) } ?? 0
    let hitPolicy = parseHitPolicy(spec["hitPolicy"])

    let record = LayerRecord(
      id: layerId,
      kind: kind,
      bounds: bounds,
      zIndex: zIndex,
      hitPolicy: hitPolicy
    )
    _ = layerTree.upsert(record)

    if kind == .material {
      applyMaterialFromSpec(spec, bounds: bounds, zIndex: zIndex)
      // Loud degrade: true system Liquid Glass not wired in MVP.
      let degradeJS =
        ";window.__velaHostDispatch({type:'event',channel:'material.degraded'," +
        "payload:{material:'apple.material',degraded:true,reason:'mvp-visual-effect-only'}})"
      reply(id: id, ok: true, result: ["id": layerId], extraEval: degradeJS)
      return
    }

    reply(id: id, ok: true, result: ["id": layerId])
  }

  private func handleLayerUpdate(id: String, args: Any?) {
    guard let obj = args as? [String: Any],
          let layerId = obj["id"] as? String,
          var existing = layerTree.find(layerId)
    else {
      reply(id: id, ok: false, error: ["code": "not_found", "message": "layer not found"])
      return
    }
    let patch = obj["patch"] as? [String: Any] ?? [:]
    if let b = parseRect(patch["bounds"]) {
      existing.bounds = b
    }
    if let z = patch["zIndex"] as? Int {
      existing.zIndex = z
    } else if let z = patch["zIndex"] as? Double {
      existing.zIndex = Int(z)
    }
    if let vis = patch["visible"] as? Bool {
      existing.visible = vis
    }
    if let hp = patch["hitPolicy"] {
      existing.hitPolicy = parseHitPolicy(hp)
    }
    _ = layerTree.upsert(existing)

    if existing.kind == .material {
      applyMaterialFromSpec(patch, bounds: existing.bounds, zIndex: existing.zIndex)
    }
    reply(id: id, ok: true, result: NSNull())
  }

  private func handleLayerRemove(id: String, args: Any?) {
    let layerId: String?
    if let s = args as? String {
      layerId = s
    } else if let obj = args as? [String: Any] {
      layerId = obj["id"] as? String
    } else {
      layerId = nil
    }
    guard let lid = layerId else {
      reply(id: id, ok: false, error: ["code": "invalid", "message": "layers.remove needs id"])
      return
    }
    _ = layerTree.remove(lid)
    if lid == materialLayerId {
      materialHost.isHidden = true
      materialLayerId = nil
    }
    reply(id: id, ok: true, result: NSNull())
  }

  private func applyOpaqueRegions(_ update: [String: Any]) {
    let layerId = update["layerId"] as? String ?? DogfoodLayerIds.mainWebview
    let region = parseRegion(update["opaqueRegions"] ?? update["region"])
    let gen: UInt64?
    if let g = update["generation"] as? UInt64 {
      gen = g
    } else if let g = update["generation"] as? Int {
      gen = UInt64(g)
    } else if let g = update["generation"] as? Double {
      gen = UInt64(g)
    } else {
      gen = nil
    }
    let ok = layerTree.applyWebShape(layerId: layerId, region: region, generation: gen)
    if !ok {
      NSLog("[vela] hit.setOpaqueRegions dropped stale generation for \(layerId)")
    }
  }

  private func applyMaterialFromSpec(_ spec: [String: Any], bounds: VelaRect, zIndex: Int) {
    materialLayerId = (spec["id"] as? String) ?? materialLayerId ?? DogfoodLayerIds.toolbarMaterial
    materialHost.applyLogicalBounds(bounds)
    materialHost.isHidden = false
    if let shape = spec["shape"] as? [String: Any] {
      if let type = shape["type"] as? String, type == "capsule" {
        materialHost.cornerRadius = max(bounds.height, bounds.width) / 2
      } else if let r = shape["radius"] as? Double {
        materialHost.cornerRadius = CGFloat(r)
      } else if let r = shape["radius"] as? Int {
        materialHost.cornerRadius = CGFloat(r)
      }
    }
    restackMaterial(aboveWeb: zIndex > (layerTree.find(DogfoodLayerIds.mainWebview)?.zIndex ?? 10))
    NSLog(
      "[vela] material host bounds=(%.1f,%.1f,%.1f,%.1f) degraded=true reason=mvp-visual-effect-only",
      bounds.x, bounds.y, bounds.width, bounds.height
    )
  }

  private func restackMaterial(aboveWeb: Bool) {
    materialHost.removeFromSuperview()
    if aboveWeb {
      rootView.addSubview(materialHost, positioned: .above, relativeTo: webView)
    } else {
      rootView.addSubview(materialHost, positioned: .below, relativeTo: webView)
    }
  }

  func reply(id: String, ok: Bool, result: Any? = nil, error: [String: Any]? = nil, extraEval: String = "") {
    var payload: [String: Any] = ["type": "res", "id": id, "ok": ok]
    if ok {
      payload["result"] = result ?? NSNull()
    } else {
      payload["error"] = error ?? ["code": "error", "message": "failed"]
    }
    guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
          let json = String(data: data, encoding: .utf8)
    else { return }
    let js = "window.__velaHostDispatch(\(json))" + extraEval
    webView.evaluateJavaScript(js, completionHandler: nil)
  }

  // MARK: - JSON helpers

  private func parseRect(_ value: Any?) -> VelaRect? {
    guard let obj = value as? [String: Any] else { return nil }
    let x = num(obj["x"])
    let y = num(obj["y"])
    let w = num(obj["width"])
    let h = num(obj["height"])
    return VelaRect(x: x, y: y, width: w, height: h)
  }

  private func parseHitPolicy(_ value: Any?) -> HitPolicy {
    guard let obj = value as? [String: Any],
          let mode = obj["mode"] as? String
    else {
      return HitPolicy(mode: .solid)
    }
    switch mode {
    case "transparent":
      return HitPolicy(mode: .transparent)
    case "web-shaped", "web_shaped":
      return HitPolicy(mode: .webShaped)
    case "opaque", "solid":
      return HitPolicy(mode: .solid)
    case "mask":
      return HitPolicy(mode: .mask)
    default:
      return HitPolicy(mode: .solid)
    }
  }

  private func parseRegion(_ value: Any?) -> VelaRegion {
    var region = VelaRegion()
    guard let obj = value as? [String: Any],
          let prims = obj["primitives"] as? [Any]
    else { return region }
    for item in prims {
      guard let p = item as? [String: Any],
            let type = p["type"] as? String,
            let rect = parseRect(p["rect"])
      else { continue }
      switch type {
      case "rect":
        region.primitives.append(.rect(rect))
      case "capsule":
        region.primitives.append(.capsule(rect))
      case "roundedRect":
        let rad = num(p["radius"])
        region.primitives.append(.roundedRect(rect, radius: rad))
      default:
        break
      }
    }
    return region
  }

  private func num(_ value: Any?) -> Double {
    if let d = value as? Double { return d }
    if let i = value as? Int { return Double(i) }
    if let n = value as? NSNumber { return n.doubleValue }
    return 0
  }
}
