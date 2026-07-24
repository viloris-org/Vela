/**
 * @vela/api — shared contracts for composition, hit-testing, materials, capabilities.
 * Implementations live in hosts/ and plugins/; this package is types + pure helpers.
 */

export type {
  Point,
  Size,
  Rect,
  CornerRadius,
  Shape,
  RegionPrimitive,
  Region,
} from "./geometry.ts";
export {
  regionFromRect,
  regionFromRoundedRect,
  regionUnion,
  rectContains,
  regionPrimitiveContains,
  regionContains,
} from "./geometry.ts";
export {
  appKitPointToLogical,
  logicalPointToAppKit,
  appKitRectToLogical,
  logicalRectToAppKit,
} from "./coordinates.ts";

export type {
  HitPolicy,
  WindowInputMode,
  HitTargetKind,
  HitTarget,
  WebShapeUpdate,
  WebShapePointQuery,
} from "./hit/policy.ts";
export type {
  OpaqueRegionEntry,
  OpaqueRegionStore,
  ApplyWebShapeResult,
  ResolveHitOptions,
} from "./hit/resolve-hit.ts";
export {
  createEmptyOpaqueRegionStore,
  isGenerationStale,
  applyWebShapeUpdate,
  resolveHit,
} from "./hit/resolve-hit.ts";
export {
  EMPTY_REGION,
  defaultWebViewHitPolicy,
  isWebShapedAccepting,
} from "./hit/web-shaped-defaults.ts";

export type {
  MaterialId,
  MaterialVariant,
  BackdropSource,
  Color,
  MaterialLayerSpec,
  MaterialContentRef,
  ResolvedMaterial,
  PlatformId,
} from "./material/spec.ts";
export { resolveMaterial } from "./material/spec.ts";
export type {
  MaterialPaintPath,
  MaterialPaintPlan,
  PlanMaterialPaintOptions,
} from "./material/paint-plan.ts";
export { planMaterialPaint } from "./material/paint-plan.ts";

export type {
  DisplayBackend,
  ShellSessionFeature,
  ShellSessionProbe,
} from "./session/features.ts";
export {
  hasSessionFeature,
  emptySessionProbe,
} from "./session/features.ts";

export type {
  LayerId,
  LayerKind,
  LayerBase,
  LayerTransform,
  WebViewLayer,
  NativeLayer,
  MaterialLayer,
  ChromeLayer,
  PassthroughLayer,
  Layer,
  InsertLayerSpec,
  InsertWebViewLayerSpec,
  InsertNativeLayerSpec,
  InsertMaterialLayerSpec,
  InsertChromeLayerSpec,
  InsertPassthroughLayerSpec,
  LayerPatch,
} from "./layer/types.ts";
export { defaultHitPolicyForKind } from "./layer/types.ts";
export type {
  SnapshotOpaqueRegion,
  LayerTreeSnapshot,
} from "./layer/snapshot.ts";
export { toOpaqueRegionStore } from "./layer/snapshot.ts";

export type {
  PermissionId,
  BuiltinPermissionId,
  CapabilityGrant,
  CapabilityScope,
  AppManifestCapabilities,
  CapabilityCheckRequest,
  CapabilityCheckResult,
  CapabilityDefinition,
} from "./capability/types.ts";
export { BuiltinPermissions } from "./capability/types.ts";
export {
  defineCapability,
  getCapability,
  listCapabilities,
  registerBuiltinCapabilities,
  __resetCapabilityRegistryForTests,
} from "./capability/define.ts";
export {
  matchPathPattern,
  matchUrlPattern,
  matchScope,
  scopesAllowResource,
} from "./capability/match-scope.ts";
export {
  checkCapability,
  grantForProfile,
  checkProfileCapability,
} from "./capability/check.ts";
export {
  permissionsForInsertLayer,
  insertLayerPermissionsGranted,
} from "./capability/layer-gates.ts";
export type {
  HostEventBus,
  HostSystemsFacade,
  HostAPI,
  CallContext,
  CallHandler,
  CapabilityHost,
  CapabilityPlugin,
} from "./capability/host.ts";
export { CapabilityDeniedError } from "./capability/host.ts";

export type {
  NotifyShowOptions,
  NotifyShowResult,
  NotifyCloseOptions,
  NotifyActionEvent,
  NotifyEventChannel,
} from "./capability/notify.ts";
export { NotifyEventChannels, NotifyMethods } from "./capability/notify.ts";

export type {
  TrayMenuItem,
  TrayCreateOptions,
  TrayCreateResult,
  TrayUpdateOptions,
  TrayRemoveOptions,
  TrayActionEvent,
  TrayEventChannel,
} from "./capability/tray.ts";
export { TrayEventChannels, TrayMethods } from "./capability/tray.ts";

export type {
  DialogFilter,
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
  DialogMethod,
} from "./capability/dialog.ts";
export { DialogMethods } from "./capability/dialog.ts";

export type {
  FsReadOptions,
  FsReadResult,
  FsWriteOptions,
  FsWriteResult,
  FsMethod,
  NormalizeAppPathResult,
} from "./capability/fs.ts";
export { FsMethods, normalizeAppRelativePath } from "./capability/fs.ts";

export type {
  ClipboardWriteOptions,
  ClipboardWriteResult,
  ClipboardReadResult,
  ClipboardMethod,
} from "./capability/clipboard.ts";
export { ClipboardMethods } from "./capability/clipboard.ts";

export type {
  ShellOpenExternalOptions,
  ShellOpenExternalResult,
  ShellMethod,
  ParseExternalUrlResult,
} from "./capability/shell.ts";
export {
  ShellMethods,
  DEFAULT_OPEN_EXTERNAL_SCHEMES,
  parseExternalUrl,
} from "./capability/shell.ts";

export type {
  AppManifest,
  AppManifestEntry,
  AppManifestWindow,
  ParseAppManifestResult,
} from "./manifest/types.ts";
export { parseAppManifest, isAppManifest } from "./manifest/types.ts";

export type {
  VelaPackage,
  VelaPackageKind,
  VelaPackageDev,
  VelaPackageEntry,
  ParseVelaPackageResult,
} from "./project/package.ts";
export {
  VELA_PACKAGE_MARKER,
  parseVelaPackage,
  isVelaPackage,
} from "./project/package.ts";
export type {
  VelaWorkspace,
  ParseVelaWorkspaceResult,
} from "./project/workspace.ts";
export {
  VELA_WORKSPACE_MARKER,
  DEFAULT_PACKAGE_PARENTS,
  parseVelaWorkspace,
  defaultVelaWorkspace,
  isVelaWorkspace,
} from "./project/workspace.ts";

export type {
  PropsSchema,
  NativeEventMap,
  NativeSurfaceHandle,
  NativeComponentHost,
  NativeComponentFactory,
  ExternalNativeModule,
} from "./component/define.ts";
export {
  defineNativeComponent,
  getNativeComponent,
  listNativeComponents,
  __resetNativeComponentRegistryForTests,
} from "./component/define.ts";

export type {
  WindowId,
  WindowChrome,
  CreateWindowOptions,
  WindowState,
  VelaWindow,
  CreateAppOptions,
  VelaApp,
} from "./window/types.ts";

export type { VelaPreloadBridge } from "./protocol/bridge.ts";

export type {
  VelaRpcChannel,
  VelaRpcErrorCode,
  VelaRpcRequest,
  VelaRpcError,
  VelaRpcResponse,
  VelaEvent,
} from "./protocol/rpc.ts";
export { VelaRpcErrorCodes, rpcOk, rpcErr } from "./protocol/rpc.ts";
