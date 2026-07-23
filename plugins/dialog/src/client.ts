import {
  DialogMethods,
  type DialogOpenOptions,
  type DialogOpenResult,
  type DialogSaveOptions,
  type DialogSaveResult,
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

export async function openDialog(
  options: DialogOpenOptions = {},
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<DialogOpenResult> {
  return (await bridge.call(DialogMethods.open, options)) as DialogOpenResult;
}

export async function saveDialog(
  options: DialogSaveOptions = {},
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<DialogSaveResult> {
  return (await bridge.call(DialogMethods.save, options)) as DialogSaveResult;
}
