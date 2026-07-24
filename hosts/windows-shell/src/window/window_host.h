#pragma once

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#else
// Non-Windows edit hosts (Linux CI): opaque placeholders so sources stay readable.
using HWND = void*;
using BOOL = int;
#endif

#include <cstddef>

namespace vela {

/** HWND create/show/close + message loop. Scaffold until DPI + DWM land. */
class WindowHost {
 public:
  WindowHost() = default;
  ~WindowHost();

  WindowHost(const WindowHost&) = delete;
  WindowHost& operator=(const WindowHost&) = delete;

  bool create(int width, int height, const wchar_t* title);
  HWND hwnd() const { return hwnd_; }
  int runMessageLoop();

 private:
  HWND hwnd_ = nullptr;
};

}  // namespace vela
