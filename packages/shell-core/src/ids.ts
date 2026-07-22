/**
 * Stable layer ids for Phase 1 dogfood stack.
 * Playground web content duplicates these string literals (no host dependency).
 * Tests pin the literals so host and web stay aligned.
 */
export const DOGFOOD_LAYER_IDS = {
  underlay: "underlay-native",
  mainWebview: "main-webview",
  toolbarMaterial: "toolbar-material",
} as const;

/** String literals the playground app uses today — keep in lockstep. */
export const PLAYGROUND_DOGFOOD_ID_LITERALS = {
  mainWebview: "main-webview",
  toolbarMaterial: "toolbar-material",
} as const;
