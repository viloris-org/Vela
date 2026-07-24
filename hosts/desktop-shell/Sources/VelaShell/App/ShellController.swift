import AppKit
import WebKit

/// Owns NSWindow, sibling layer views, layer tree, and bridge.
final class ShellController: NSObject, NSWindowDelegate {
  static let version = "0.0.1"

  let layerTree = LayerTree()
  private(set) var window: NSWindow!
  private(set) var rootView: HitRootView!
  private(set) var underlayView: NSView!
  private(set) var webView: WKWebView!
  private(set) var materialHost: MaterialHostView!
  private let messageHandler = VelaMessageHandler()

  var contentSize: VelaRect = VelaRect(x: 0, y: 0, width: 960, height: 640)
  var materialLayerId: String?
  var lastHitLabel: String = "—"

  private let initialURL: URL
  private let debugLabel = NSTextField(labelWithString: "hit: —")

  init(url: URL) {
    self.initialURL = url
    super.init()
    messageHandler.shell = self
  }

  func show() {
    let rect = NSRect(x: 0, y: 0, width: contentSize.width, height: contentSize.height)
    window = NSWindow(
      contentRect: rect,
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "Vela Desktop Shell"
    window.delegate = self
    window.isReleasedWhenClosed = false
    window.center()

    rootView = HitRootView(frame: rect)
    rootView.wantsLayer = true
    rootView.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
    rootView.onPointerDown = { [weak self] point in
      self?.handlePointerDown(point)
    }

    // Underlay (sibling)
    underlayView = NSView(frame: rootView.bounds)
    underlayView.wantsLayer = true
    underlayView.layer?.backgroundColor = NSColor(calibratedRed: 0.12, green: 0.35, blue: 0.55, alpha: 1).cgColor
    underlayView.autoresizingMask = [.width, .height]

    // Material host (sibling; hidden until insert)
    materialHost = MaterialHostView(frame: .zero)

    // WebView (sibling)
    let preload = loadPreloadSource()
    webView = MainWebViewFactory.make(preloadSource: preload, messageHandler: messageHandler)
    webView.autoresizingMask = [.width, .height]
    webView.frame = rootView.bounds

    rootView.addSubview(underlayView)
    rootView.addSubview(materialHost)
    rootView.addSubview(webView)

    debugLabel.font = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)
    debugLabel.textColor = .white
    debugLabel.backgroundColor = NSColor.black.withAlphaComponent(0.55)
    debugLabel.drawsBackground = true
    debugLabel.frame = NSRect(x: 8, y: 8, width: 400, height: 18)
    debugLabel.autoresizingMask = [.maxXMargin, .maxYMargin]
    rootView.addSubview(debugLabel)

    window.contentView = rootView
    layerTree.bootstrapMinimal(content: contentSize)

    let scale = window.backingScaleFactor
    NSLog(
      "[vela] desktop-shell %@ starting url=%@ scaleFactor=%.2f",
      ShellController.version,
      initialURL.absoluteString,
      scale
    )

    window.makeKeyAndOrderFront(nil)
    webView.load(URLRequest(url: initialURL))
  }

  private func handlePointerDown(_ point: VelaPoint) {
    let target = ResolveHit.resolve(
      layers: layerTree.layers,
      shapeStore: { [weak self] id in self?.layerTree.shape(for: id) },
      point: point
    )
    lastHitLabel = ResolveHit.format(target)
    debugLabel.stringValue = String(format: "hit: %@ (%.0f,%.0f)", lastHitLabel, point.x, point.y)
    NSLog("[vela] pointerDown (%.1f,%.1f) → %@", point.x, point.y, lastHitLabel)
  }

  private func loadPreloadSource() -> String {
    if let url = Bundle.module.url(forResource: "preload", withExtension: "js"),
       let src = try? String(contentsOf: url, encoding: .utf8)
    {
      return src
    }
    NSLog("[vela] WARNING: preload.js missing from bundle; bridge will not install")
    return "console.error('[vela] preload missing');"
  }

  func windowWillClose(_ notification: Notification) {
    NSApp.terminate(nil)
  }

  func windowDidResize(_ notification: Notification) {
    guard let content = window.contentView else { return }
    let b = content.bounds
    contentSize = VelaRect(x: 0, y: 0, width: Double(b.width), height: Double(b.height))
    underlayView.frame = content.bounds
    webView.frame = content.bounds
    // Layer tree bounds not fully reflowed in MVP (documented).
  }
}
