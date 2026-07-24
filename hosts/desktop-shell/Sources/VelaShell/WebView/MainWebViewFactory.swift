import AppKit
import WebKit

enum MainWebViewFactory {
  static func make(
    preloadSource: String,
    messageHandler: WKScriptMessageHandler
  ) -> WKWebView {
    let config = WKWebViewConfiguration()
    let controller = config.userContentController

    let userScript = WKUserScript(
      source: preloadSource,
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    controller.addUserScript(userScript)
    controller.add(messageHandler, name: "vela")

    // Transparent page background so underlay can show through.
    config.preferences.setValue(true, forKey: "developerExtrasEnabled")

    let webView = WKWebView(frame: .zero, configuration: config)
    webView.setValue(false, forKey: "drawsBackground")
    if #available(macOS 12.0, *) {
      webView.underPageBackgroundColor = .clear
    }
    webView.wantsLayer = true
    webView.layer?.backgroundColor = NSColor.clear.cgColor
    return webView
  }
}
