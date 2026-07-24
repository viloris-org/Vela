# hosts/windows-shell — Phase 4 Windows composition Shell (scaffold)
#
# Full WebView2 + WinRT wiring lands on a Windows machine with VS + WebView2 SDK.
# This skeleton produces a console stub so paths and product name stay stable.
#
#   cmake -B build -G "Visual Studio 17 2022" -A x64
#   cmake --build build --config Release

cmake_minimum_required(VERSION 3.20)
project(vela-windows-shell LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(vela-windows-shell
  src/main.cpp
  src/window/window_host.cpp
  src/webview/webview2_host.cpp
  src/bridge/message_bridge.cpp
)

target_include_directories(vela-windows-shell PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/src
)

if(WIN32)
  target_compile_definitions(vela-windows-shell PRIVATE VELA_WINDOWS=1 UNICODE _UNICODE)
  # TODO(Phase 4): link WebView2Loader, dwmapi, windowsapp (WinRT)
endif()

# Install layout hint (optional)
install(TARGETS vela-windows-shell RUNTIME DESTINATION bin)
