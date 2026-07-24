#include "webview/webview2_host.h"

#include <cstdio>

namespace vela {

bool WebView2Host::ensureRuntime() {
  // TODO(Phase 4): GetAvailableCoreWebView2BrowserVersionString / create env.
  // Until linked, treat as unavailable so main prints W3-style diagnostics.
  std::fputs(
      "[vela] webview2_host: ensureRuntime scaffold — link WebView2 SDK on "
      "Windows to implement.\n",
      stderr);
  return false;
}

bool WebView2Host::attach(HWND hwnd, const std::string& url) {
  (void)hwnd;
  (void)url;
  std::fputs("[vela] webview2_host: attach not implemented (scaffold).\n", stderr);
  return false;
}

void WebView2Host::setMessageHandler(MessageHandler handler) {
  on_message_ = std::move(handler);
}

}  // namespace vela
