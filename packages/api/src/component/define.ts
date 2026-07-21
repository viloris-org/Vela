import type { PlatformId } from "../material/spec.ts";
import type { HitPolicy } from "../hit/policy.ts";
import type { PermissionId } from "../capability/types.ts";
import type { Rect, Region } from "../geometry.ts";

/**
 * Schema placeholder — hosts may plug Zod/Valibot at runtime.
 * Kept structural so @vela/api has zero required runtime deps.
 */
export type PropsSchema<T = unknown> = {
  readonly parse: (input: unknown) => T;
  readonly jsonSchema?: unknown;
};

export type NativeEventMap = Record<string, unknown>;

export interface NativeSurfaceHandle {
  readonly id: string;
}

export interface NativeComponentHost {
  readonly platform: PlatformId;
  /** Logical → physical scale for the window. */
  readonly scaleFactor: number;
}

export interface NativeComponentFactory<
  TProps = unknown,
  TEvents extends NativeEventMap = NativeEventMap,
> {
  readonly name: string;
  readonly permissions: readonly PermissionId[];
  readonly platforms: readonly PlatformId[];
  readonly propsSchema?: PropsSchema<TProps>;
  readonly events?: readonly (keyof TEvents & string)[];
  readonly defaultHitPolicy?: HitPolicy;

  create(
    host: NativeComponentHost,
    props: TProps,
  ): NativeSurfaceHandle | Promise<NativeSurfaceHandle>;

  update?(
    surface: NativeSurfaceHandle,
    props: TProps,
  ): void | Promise<void>;

  setBounds(
    surface: NativeSurfaceHandle,
    bounds: Rect,
  ): void | Promise<void>;

  setHitRegion?(
    surface: NativeSurfaceHandle,
    region: Region | null,
  ): void | Promise<void>;

  invoke?(
    surface: NativeSurfaceHandle,
    method: string,
    args: unknown,
  ): unknown | Promise<unknown>;

  destroy(surface: NativeSurfaceHandle): void | Promise<void>;
}

const registry = new Map<string, NativeComponentFactory>();

/**
 * Register a native component implementation (Shell / plugin side).
 * Web code never calls this; it only mounts by `name`.
 */
export function defineNativeComponent<
  TProps = unknown,
  TEvents extends NativeEventMap = NativeEventMap,
>(
  factory: NativeComponentFactory<TProps, TEvents>,
): NativeComponentFactory<TProps, TEvents> {
  if (!factory.name || factory.name.includes(" ")) {
    throw new Error(
      `defineNativeComponent: invalid name "${String(factory.name)}"`,
    );
  }
  if (registry.has(factory.name)) {
    throw new Error(
      `defineNativeComponent: duplicate component "${factory.name}"`,
    );
  }
  registry.set(
    factory.name,
    factory as NativeComponentFactory,
  );
  return factory;
}

export function getNativeComponent(
  name: string,
): NativeComponentFactory | undefined {
  return registry.get(name);
}

export function listNativeComponents(): readonly string[] {
  return [...registry.keys()].sort();
}

/** Test helper — clears process-local registry. */
export function __resetNativeComponentRegistryForTests(): void {
  registry.clear();
}

/** Descriptor for signed external modules (Swift framework, etc.). */
export interface ExternalNativeModule {
  readonly componentName: string;
  /** e.g. @rpath/MyVelaSurfaces.framework */
  readonly libraryPath: string;
  /** ObjC/Swift factory symbol or class name. */
  readonly factory: string;
  readonly permissions: readonly PermissionId[];
  readonly platforms: readonly PlatformId[];
  /** Require code signature / allowlist entry. */
  readonly requiresSignature: boolean;
}
