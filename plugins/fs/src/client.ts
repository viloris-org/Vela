import {
  FsMethods,
  type FsReadResult,
  type FsWriteResult,
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

export async function readAppFile(
  path: string,
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<FsReadResult> {
  return (await bridge.call(FsMethods.read, { path })) as FsReadResult;
}

export async function writeAppFile(
  path: string,
  data: string,
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<FsWriteResult> {
  return (await bridge.call(FsMethods.write, { path, data })) as FsWriteResult;
}
