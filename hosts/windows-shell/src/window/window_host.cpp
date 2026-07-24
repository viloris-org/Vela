#include "window/window_host.h"

#include <cstdio>

namespace vela {

WindowHost::~WindowHost() {
#ifdef _WIN32
  if (hwnd_) {
    DestroyWindow(hwnd_);
    hwnd_ = nullptr;
  }
#endif
}

bool WindowHost::create(int width, int height, const wchar_t* title) {
  (void)width;
  (void)height;
  (void)title;
#ifdef _WIN32
  // Scaffold: real RegisterClassExW + CreateWindowExW lands with WebView2 MVP.
  // Returning false forces main to report incomplete host loudly.
  std::fputs(
      "[vela] window_host: HWND path not implemented (scaffold).\n",
      stderr);
  return false;
#else
  std::fputs(
      "[vela] window_host: not built for this OS (Windows host only).\n",
      stderr);
  return false;
#endif
}

int WindowHost::runMessageLoop() {
#ifdef _WIN32
  MSG msg;
  while (GetMessage(&msg, nullptr, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessage(&msg);
  }
  return static_cast<int>(msg.wParam);
#else
  return 1;
#endif
}

}  // namespace vela
