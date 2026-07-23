/**
 * System tray / status-item contracts (T1 capability — not a composition Layer).
 * Desktop-oriented; mobile hosts should return structured unsupported.
 * App surface: `vela.call("tray.*")` + `events.subscribe("tray.action", …)`.
 */

export type TrayMenuItem =
  | {
      readonly type: "item";
      readonly id: string;
      readonly label: string;
      readonly enabled?: boolean;
      readonly checked?: boolean;
    }
  | {
      readonly type: "separator";
    };

export type TrayCreateOptions = {
  /** Stable id; host generates when omitted. */
  readonly id?: string;
  readonly tooltip?: string;
  /** Hint only — path, asset id, or named icon. */
  readonly icon?: string;
  readonly menu?: readonly TrayMenuItem[];
};

export type TrayCreateResult = {
  readonly id: string;
};

export type TrayUpdateOptions = {
  readonly id: string;
  readonly tooltip?: string;
  readonly icon?: string;
  readonly menu?: readonly TrayMenuItem[];
};

export type TrayRemoveOptions = {
  readonly id: string;
};

/** Payload on channel `tray.action`. */
export type TrayActionEvent = {
  readonly id: string;
  readonly action: "click" | "double-click" | "menu" | "right-click";
  /** Present when `action === "menu"`. */
  readonly itemId?: string;
};

/** Well-known event channel for tray interactions. */
export const TrayEventChannels = {
  action: "tray.action",
} as const;

export type TrayEventChannel =
  (typeof TrayEventChannels)[keyof typeof TrayEventChannels];

/** `vela.call` method names for the tray plugin. */
export const TrayMethods = {
  create: "tray.create",
  update: "tray.update",
  remove: "tray.remove",
} as const;
