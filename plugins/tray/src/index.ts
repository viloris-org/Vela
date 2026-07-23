export { registerTrayPermissions, TrayPermissions } from "./permissions.ts";
export { registerTrayPlugin, trayPlugin } from "./host.ts";
export {
  createTray,
  updateTray,
  removeTray,
  getVelaBridge,
} from "./client.ts";
export { createMockTraySys, type MockTrayState } from "./mock-sys.ts";
