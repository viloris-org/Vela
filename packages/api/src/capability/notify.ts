/**
 * Desktop / OS notification contracts (T1 capability — no Layer).
 * App surface: `vela.call("notify.*")` + `events.subscribe("notify.action", …)`.
 */

/** Options for `notify.show`. */
export type NotifyShowOptions = {
  readonly title: string;
  readonly body?: string;
  /** Stable id for replace / close; host generates when omitted. */
  readonly id?: string;
  /** Hint only — hosts may ignore or map to a platform icon. */
  readonly icon?: string;
  /** Prefer silent delivery when the OS supports it. */
  readonly silent?: boolean;
};

export type NotifyShowResult = {
  readonly id: string;
};

export type NotifyCloseOptions = {
  readonly id: string;
};

/** Payload on channel `notify.action`. */
export type NotifyActionEvent = {
  readonly id: string;
  readonly action: "click" | "close" | "action";
  /** Present when `action === "action"` (button id). */
  readonly actionId?: string;
};

/** Well-known event channel for notification interactions. */
export const NotifyEventChannels = {
  action: "notify.action",
} as const;

export type NotifyEventChannel =
  (typeof NotifyEventChannels)[keyof typeof NotifyEventChannels];

/** `vela.call` method names for the notify plugin. */
export const NotifyMethods = {
  show: "notify.show",
  close: "notify.close",
} as const;
