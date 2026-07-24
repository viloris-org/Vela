import {
  ShellMethods,
  type ShellOpenExternalResult,
  type VelaPreloadBridge,
} from "@vela/api";

/**
 * Thin App-side wrappers over `window.vela.call`.
 * No privilege — fails if preload bridge is absent.
 */
export function getVelaBridge(): VelaPreloadBridge {
  const vela = globalThis.window?.vela;
  if (vela === undefined) {
    throw new Error(
      "window.vela is not available (not running under Vela preload)",
    );
  }
  return vela;
}

export async function openExternal(
  url: string,
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<ShellOpenExternalResult> {
  return (await bridge.call(ShellMethods.openExternal, {
    url,
  })) as ShellOpenExternalResult;
}
