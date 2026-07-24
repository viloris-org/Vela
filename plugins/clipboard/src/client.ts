import {
  ClipboardMethods,
  type ClipboardReadResult,
  type ClipboardWriteResult,
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

export async function readClipboard(
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<ClipboardReadResult> {
  return (await bridge.call(ClipboardMethods.read)) as ClipboardReadResult;
}

export async function writeClipboard(
  text: string,
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<ClipboardWriteResult> {
  return (await bridge.call(ClipboardMethods.write, {
    text,
  })) as ClipboardWriteResult;
}
