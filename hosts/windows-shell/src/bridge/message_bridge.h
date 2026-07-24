#pragma once

#include <string>

namespace vela {

/**
 * JSON bridge for window.vela message-pass.
 * Wire shape matches linux-shell / desktop-shell:
 *   { type: "req"|"res"|"event", ... }
 *   hit.setOpaqueRegions / hit.setMainOpaqueRegions
 */
class MessageBridge {
 public:
  void handleIncoming(const std::string& json);

  /** Host → page: evaluate window.__velaHostDispatch(...). */
  using EvalJs = void (*)(void* userdata, const char* script);
  void setEvalJs(EvalJs fn, void* userdata);

 private:
  EvalJs eval_js_ = nullptr;
  void* eval_userdata_ = nullptr;
};

}  // namespace vela
