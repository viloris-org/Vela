import {
  TrayMethods,
  type TrayCreateOptions,
  type TrayCreateResult,
  type TrayRemoveOptions,
  type TrayUpdateOptions,
  type VelaPreloadBridge,
} from "@vela/api";

export function getVelaBridge(): VelaPreloadBridge {
  const vela = globalThis.window?.vela;
  if (vela === undefined) {
    throw new Error("window.vela is not available (not running under Vela preload)");
  }
  return vela;
}

export async function createTray(
  options: TrayCreateOptions = {},
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<TrayCreateResult> {
  return (await bridge.call(TrayMethods.create, options)) as TrayCreateResult;
}

export async function updateTray(
  options: TrayUpdateOptions,
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<void> {
  await bridge.call(TrayMethods.update, options);
}

export async function removeTray(
  options: TrayRemoveOptions,
  bridge: VelaPreloadBridge = getVelaBridge(),
): Promise<void> {
  await bridge.call(TrayMethods.remove, options);
}
