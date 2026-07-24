import AppKit

/// Content root: owns sibling layers (underlay, webview, material).
/// MVP: does not yet sole-own hitTest policy; pointer logging uses ResolveHit.
final class HitRootView: NSView {
  var onPointerDown: ((VelaPoint) -> Void)?

  override var isFlipped: Bool { true } // top-left origin, y down

  override func mouseDown(with event: NSEvent) {
    let p = convert(event.locationInWindow, from: nil)
    onPointerDown?(VelaPoint(x: Double(p.x), y: Double(p.y)))
    super.mouseDown(with: event)
  }

  override func layout() {
    super.layout()
    // Keep siblings filling bounds unless they have explicit frames set by controller.
  }
}
