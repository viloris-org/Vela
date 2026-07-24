#include "bridge/message_bridge.h"

#include <cstdio>

namespace vela {

void MessageBridge::setEvalJs(EvalJs fn, void* userdata) {
  eval_js_ = fn;
  eval_userdata_ = userdata;
}

void MessageBridge::handleIncoming(const std::string& json) {
  // Scaffold: log only. Full parse/dispatch mirrors hosts/linux-shell bridge.zig.
  std::fprintf(stderr, "[vela] bridge (scaffold) received %zu bytes\n", json.size());
  (void)eval_js_;
  (void)eval_userdata_;
}

}  // namespace vela
