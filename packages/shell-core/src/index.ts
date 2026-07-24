/**
 * @vela/shell-core — portable Shell policy + layer/hit state machine.
 * Implementations of AppKit/WebView2 paint live in hosts/; this package is pure TS.
 */

export { DOGFOOD_LAYER_IDS, PLAYGROUND_DOGFOOD_ID_LITERALS } from "./ids.ts";
export {
  ShellCoreError,
  layerNotFound,
  capabilityDenied,
  insertPermissionDenied,
} from "./errors.ts";
export {
  createShellCore,
  type ShellCore,
  type ShellCoreOptions,
} from "./shell-core.ts";
export {
  dogfoodBootstrapSpecs,
  applyDogfoodBootstrap,
} from "./bootstrap.ts";
export {
  createPreloadBridge,
  type CreatePreloadBridgeOptions,
} from "./bridge.ts";
export type { ShellEventHandler } from "./events.ts";
