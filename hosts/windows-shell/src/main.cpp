// vela-windows-shell — Phase 4 Windows composition Shell entry (scaffold).
// Real HWND + WebView2 path lands in window_host / webview2_host.

#include "bridge/message_bridge.h"
#include "webview/webview2_host.h"
#include "window/window_host.h"

#include <cstdio>
#include <cstring>
#include <string>

namespace {

constexpr const char* kVersion = "0.0.1";

void printUsage() {
  std::fprintf(
      stdout,
      "vela-windows-shell %s\n"
      "\n"
      "Usage:\n"
      "  vela-windows-shell [--url URL] [--version] [--help]\n"
      "\n"
      "Options:\n"
      "  --url URL     Navigate main WebView2 (default: http://127.0.0.1:5174)\n"
      "  --version     Print version and exit\n"
      "  --help        Show this help\n"
      "\n"
      "Status: scaffold. Full WebView2 composition host is not built yet.\n"
      "See hosts/windows-shell/README.md (C++/WinRT + WebView2).\n"
      "Dogfood without a native Shell: bun run vela -- dev --browser\n"
      "\n",
      kVersion);
}

}  // namespace

int main(int argc, char** argv) {
  std::string url = "http://127.0.0.1:5174";

  for (int i = 1; i < argc; ++i) {
    const char* a = argv[i];
    if (std::strcmp(a, "--help") == 0 || std::strcmp(a, "-h") == 0) {
      printUsage();
      return 0;
    }
    if (std::strcmp(a, "--version") == 0 || std::strcmp(a, "-V") == 0) {
      std::puts(kVersion);
      return 0;
    }
    if (std::strcmp(a, "--url") == 0) {
      if (i + 1 >= argc) {
        std::fputs("--url expects a URL\n", stderr);
        return 2;
      }
      url = argv[++i];
      continue;
    }
    if (std::strncmp(a, "--url=", 6) == 0) {
      url = a + 6;
      continue;
    }
    std::fprintf(stderr, "Unknown argument: %s\n", a);
    printUsage();
    return 2;
  }

  vela::WindowHost window;
  if (!window.create(960, 640, L"Vela Windows Shell")) {
    std::fputs(
        "[vela] ERROR: failed to create window host (scaffold stub).\n",
        stderr);
    return 1;
  }

  vela::WebView2Host webview;
  if (!webview.ensureRuntime()) {
    // W3: loud failure when WebView2 is missing — never silent blank success.
    std::fputs(
        "[vela] ERROR: WebView2 Runtime not available (or host not fully "
        "implemented).\n"
        "  Install the Evergreen WebView2 Runtime, then rebuild with WebView2 "
        "SDK linked.\n"
        "  See hosts/windows-shell/README.md\n"
        "  Fallback: bun run vela -- dev --browser\n",
        stderr);
    return 1;
  }

  if (!webview.attach(window.hwnd(), url)) {
    std::fputs("[vela] ERROR: WebView2 attach failed.\n", stderr);
    return 1;
  }

  vela::MessageBridge bridge;
  webview.setMessageHandler([&](const std::string& json) {
    bridge.handleIncoming(json);
  });

  std::fprintf(stdout, "[vela] windows-shell %s url=%s\n", kVersion, url.c_str());
  return window.runMessageLoop();
}
