import {
  NotifyMethods,
  type NotifyCloseOptions,
  type NotifyShowOptions,
  type NotifyShowResult,
  type VelaPreloadBridge,
} from "@vela/api";

/**
 * Thin App-side wrappers over `window.vela.call`.
 * No privilege — fails if preload bridge is absent.
 */
export function getVelaBridge(): VelaPreloadBridge {
  const vela = globalThis.window?.vela;
  if (vela === undefined) {
    throw new Error("window.vela is not available (not running under Vela preload)");
  }
  return vela;
}

export async function showNotification(
  options: NotifyShowOptions,
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<NotifyShowResult> {
  return (await bridge.call(NotifyMethods.show, options)) as NotifyShowResult;
}

export async function closeNotification(
  options: NotifyCloseOptions,
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<void> {
  await bridge.call(NotifyMethods.close, options);
}
