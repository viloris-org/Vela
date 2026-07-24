import AppKit

/// MVP material host: translucent fill + optional visual effect (always report degraded for Liquid Glass).
final class MaterialHostView: NSView {
  private let effectView: NSVisualEffectView = {
    let v = NSVisualEffectView()
    v.material = .hudWindow
    v.blendingMode = .behindWindow
    v.state = .active
    v.wantsLayer = true
    v.layer?.cornerRadius = 16
    v.layer?.masksToBounds = true
    return v
  }()

  private let fillView: NSView = {
    let v = NSView()
    v.wantsLayer = true
    v.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.18).cgColor
    v.layer?.cornerRadius = 16
    v.layer?.masksToBounds = true
    return v
  }()

  var cornerRadius: CGFloat = 16 {
    didSet {
      effectView.layer?.cornerRadius = cornerRadius
      fillView.layer?.cornerRadius = cornerRadius
    }
  }

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    wantsLayer = true
    isHidden = true
    addSubview(effectView)
    addSubview(fillView)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override var isFlipped: Bool { true }

  override func layout() {
    super.layout()
    effectView.frame = bounds
    fillView.frame = bounds
  }

  /// Apply logical content bounds (top-left origin). Parent must be flipped.
  func applyLogicalBounds(_ rect: VelaRect) {
    frame = NSRect(x: rect.x, y: rect.y, width: rect.width, height: rect.height)
    isHidden = rect.width <= 0 || rect.height <= 0
  }
}
