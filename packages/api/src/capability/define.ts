import type {
  CapabilityDefinition,
  PermissionId,
} from "./types.ts";

const definitions = new Map<PermissionId, CapabilityDefinition>();

export function defineCapability(
  def: CapabilityDefinition,
): CapabilityDefinition {
  if (!def.id) {
    throw new Error("defineCapability: id is required");
  }
  if (definitions.has(def.id)) {
    throw new Error(`defineCapability: duplicate id "${def.id}"`);
  }
  definitions.set(def.id, def);
  return def;
}

export function getCapability(
  id: PermissionId,
): CapabilityDefinition | undefined {
  return definitions.get(id);
}

export function listCapabilities(): readonly CapabilityDefinition[] {
  return [...definitions.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

export function __resetCapabilityRegistryForTests(): void {
  definitions.clear();
}

/** Built-in capability catalog (host should register on startup). */
export function registerBuiltinCapabilities(): void {
  const builtins: CapabilityDefinition[] = [
    {
      id: "fs:app-read",
      description: "Read files under the app data sandbox",
      risk: "medium",
    },
    {
      id: "fs:app-write",
      description: "Write files under the app data sandbox",
      risk: "medium",
    },
    {
      id: "clipboard:read",
      description: "Read the system clipboard",
      risk: "medium",
    },
    {
      id: "clipboard:write",
      description: "Write the system clipboard",
      risk: "low",
    },
    {
      id: "notify:show",
      description: "Show user notifications",
      risk: "low",
    },
    {
      id: "tray:manage",
      description: "Create, update, and remove system tray icons and menus",
      risk: "low",
      platforms: ["macos", "windows", "linux"],
    },
    {
      id: "dialog:open",
      description: "Open file / folder picker dialogs",
      risk: "medium",
    },
    {
      id: "dialog:save",
      description: "Save file dialogs",
      risk: "medium",
    },
    {
      id: "window:material",
      description: "Insert system material layers (glass, mica, …)",
      risk: "low",
    },
    {
      id: "camera:preview",
      description: "Show live camera preview native layer",
      risk: "high",
      platforms: ["macos", "ios", "windows", "linux", "android"],
    },
    {
      id: "camera:capture",
      description: "Capture still frames from the camera",
      risk: "high",
    },
    {
      id: "native:load-unsigned",
      description: "Load unsigned native component modules",
      risk: "critical",
    },
    {
      id: "shell:open-external",
      description: "Open URLs / paths with the system handler",
      risk: "high",
    },
  ];

  for (const def of builtins) {
    if (!definitions.has(def.id)) {
      definitions.set(def.id, def);
    }
  }
}
