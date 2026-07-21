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
} from "./geometry.ts";

export type {
  HitPolicy,
  WindowInputMode,
  HitTargetKind,
  HitTarget,
  WebShapeUpdate,
  WebShapePointQuery,
} from "./hit/policy.ts";

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
