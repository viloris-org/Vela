/**
 * @vela/host-core — portable privileged Host call router.
 * No OS I/O: systems facades are injected; page never imports this package.
 */

export {
  createCapabilityHost,
  type CreateCapabilityHostOptions,
  type CapabilityHostRuntime,
  type InvokeCallOptions,
} from "./capability-host.ts";
