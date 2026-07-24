#pragma once

#include "window/window_host.h"

#include <functional>
#include <string>

namespace vela {

/**
 * WebView2 environment + controller.
 * Scaffold: ensureRuntime / attach report missing implementation or runtime.
 */
class WebView2Host {
 public:
  using MessageHandler = std::function<void(const std::string& json)>;

  /** Returns false if Evergreen runtime is missing or host is still a stub. */
  bool ensureRuntime();

  /** Create controller parented to hwnd and navigate to url. */
  bool attach(HWND hwnd, const std::string& url);

  void setMessageHandler(MessageHandler handler);

 private:
  MessageHandler on_message_;
};

}  // namespace vela
