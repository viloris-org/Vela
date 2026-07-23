//! Portable Shell session probe + Wayland global → feature map.
//! Mirrors packages/api/src/session/features.ts and material/paint-plan.ts.
//! Raw protocol names stay here (L4); never surface on window.vela.

const std = @import("std");

pub const DisplayBackend = enum {
    wayland,
    x11,
    unknown,
};

pub const Feature = enum {
    material_backdrop_window_behind,
    material_backdrop_layers_below,
    material_backdrop_snapshot,
    window_input_region,
    window_fractional_scale,
    window_alpha,
    window_server_decoration,
    session_idle_inhibit,
    session_activation,

    pub fn id(self: Feature) []const u8 {
        return switch (self) {
            .material_backdrop_window_behind => "material.backdrop.window-behind",
            .material_backdrop_layers_below => "material.backdrop.layers-below",
            .material_backdrop_snapshot => "material.backdrop.snapshot",
            .window_input_region => "window.input-region",
            .window_fractional_scale => "window.fractional-scale",
            .window_alpha => "window.alpha",
            .window_server_decoration => "window.server-decoration",
            .session_idle_inhibit => "session.idle-inhibit",
            .session_activation => "session.activation",
        };
    }
};

pub const FeatureSet = struct {
    bits: u32 = 0,

    pub fn empty() FeatureSet {
        return .{};
    }

    pub fn has(self: FeatureSet, f: Feature) bool {
        return (self.bits & featureBit(f)) != 0;
    }

    pub fn set(self: *FeatureSet, f: Feature) void {
        self.bits |= featureBit(f);
    }

    pub fn merge(self: *FeatureSet, other: FeatureSet) void {
        self.bits |= other.bits;
    }

    fn featureBit(f: Feature) u32 {
        return @as(u32, 1) << @intFromEnum(f);
    }
};

pub const Probe = struct {
    backend: DisplayBackend = .unknown,
    features: FeatureSet = .{},
    /// Host-private diagnostic lines (protocol names, probe notes).
    diagnostics: []const []const u8 = &.{},
};

pub const MaterialPaintPath = enum {
    native_system,
    compositor_window_blur,
    snapshot_blur,
    translucent_chrome,
    css_fallback,

    pub fn name(self: MaterialPaintPath) []const u8 {
        return switch (self) {
            .native_system => "native-system",
            .compositor_window_blur => "compositor-window-blur",
            .snapshot_blur => "snapshot-blur",
            .translucent_chrome => "translucent-chrome",
            .css_fallback => "css-fallback",
        };
    }
};

pub const Samples = enum {
    layers_below,
    window_content,
    specific_layer,
};

pub const PaintPlan = struct {
    path: MaterialPaintPath,
    degraded: bool,
    reason: []const u8,
    effective: []const u8 = "gtk.blur",
};

/// Map a Wayland global interface name to zero or more portable features.
/// Pure / testable — no display connection required.
pub fn featuresForWaylandGlobal(interface_name: []const u8) FeatureSet {
    var set = FeatureSet.empty();

    // ext-background-effect-v1 — blur behind the surface (window-behind).
    // https://wayland.app/protocols/ext-background-effect-v1
    if (std.mem.eql(u8, interface_name, "ext_background_effect_manager_v1")) {
        set.set(.material_backdrop_window_behind);
        return set;
    }

    // KDE Plasma legacy blur (still common).
    if (std.mem.eql(u8, interface_name, "org_kde_kwin_blur_manager")) {
        set.set(.material_backdrop_window_behind);
        return set;
    }

    // Fractional scale (staging).
    if (std.mem.eql(u8, interface_name, "wp_fractional_scale_manager_v1")) {
        set.set(.window_fractional_scale);
        return set;
    }

    // Viewporter often pairs with scale/crop pipelines.
    if (std.mem.eql(u8, interface_name, "wp_viewporter")) {
        // Not a direct feature; leave empty. Host may log only.
        return set;
    }

    // Alpha modifier (per-surface alpha).
    if (std.mem.eql(u8, interface_name, "wp_alpha_modifier_v1")) {
        set.set(.window_alpha);
        return set;
    }

    // Idle inhibit.
    if (std.mem.eql(u8, interface_name, "zwp_idle_inhibit_manager_v1")) {
        set.set(.session_idle_inhibit);
        return set;
    }

    // Activation.
    if (std.mem.eql(u8, interface_name, "xdg_activation_v1")) {
        set.set(.session_activation);
        return set;
    }

    // Server decorations.
    if (std.mem.eql(u8, interface_name, "zxdg_decoration_manager_v1")) {
        set.set(.window_server_decoration);
        return set;
    }

    // Core wl_compositor always provides input regions on Wayland surfaces.
    if (std.mem.eql(u8, interface_name, "wl_compositor")) {
        set.set(.window_input_region);
        return set;
    }

    return set;
}

/// Merge features for a list of advertised Wayland globals.
pub fn featuresFromWaylandGlobals(names: []const []const u8) FeatureSet {
    var set = FeatureSet.empty();
    for (names) |n| {
        set.merge(featuresForWaylandGlobal(n));
    }
    // On any Wayland session, compositor input region is available via core.
    // Probe code should also inject wl_compositor; this is a safety net when
    // the host only lists extension globals.
    if (names.len > 0) {
        set.set(.window_input_region);
    }
    return set;
}

/// Plan gtk.blur paint given samples policy + session probe.
pub fn planGtkBlurPaint(samples: Samples, probe: Probe) PaintPlan {
    if (probe.features.has(.material_backdrop_layers_below) and samples == .layers_below) {
        return .{
            .path = .native_system,
            .degraded = false,
            .reason = "layers-below live sampling",
        };
    }

    if (probe.features.has(.material_backdrop_snapshot) and samples == .layers_below) {
        return .{
            .path = .snapshot_blur,
            .degraded = true,
            .reason = "snapshot-blur: layers-below approximated by host snapshot (not live glass)",
        };
    }

    if (probe.features.has(.material_backdrop_window_behind)) {
        return switch (samples) {
            .window_content => .{
                .path = .compositor_window_blur,
                .degraded = false,
                .reason = "compositor-window-blur",
            },
            .layers_below => .{
                .path = .compositor_window_blur,
                .degraded = true,
                .reason = "compositor-window-blur: samples layers-below unavailable; using window-behind blur",
            },
            .specific_layer => .{
                .path = .compositor_window_blur,
                .degraded = true,
                .reason = "compositor-window-blur: specific-layer sampling unavailable; using window-behind blur",
            },
        };
    }

    return .{
        .path = .translucent_chrome,
        .degraded = true,
        .reason = "no-backdrop-blur: translucent host chrome (no compositor/snapshot path)",
    };
}

/// Known globals we query via gdk_wayland_display_query_registry.
pub const probed_wayland_globals = [_][]const u8{
    "wl_compositor",
    "ext_background_effect_manager_v1",
    "org_kde_kwin_blur_manager",
    "wp_fractional_scale_manager_v1",
    "wp_viewporter",
    "wp_alpha_modifier_v1",
    "zwp_idle_inhibit_manager_v1",
    "xdg_activation_v1",
    "zxdg_decoration_manager_v1",
};

test "maps ext-background-effect to window-behind" {
    const set = featuresForWaylandGlobal("ext_background_effect_manager_v1");
    try std.testing.expect(set.has(.material_backdrop_window_behind));
    try std.testing.expect(!set.has(.material_backdrop_layers_below));
}

test "maps kde blur and fractional scale" {
    const kde = featuresForWaylandGlobal("org_kde_kwin_blur_manager");
    try std.testing.expect(kde.has(.material_backdrop_window_behind));
    const fs = featuresForWaylandGlobal("wp_fractional_scale_manager_v1");
    try std.testing.expect(fs.has(.window_fractional_scale));
}

test "paint plan translucent without features" {
    const plan = planGtkBlurPaint(.layers_below, .{});
    try std.testing.expect(plan.degraded);
    try std.testing.expect(plan.path == .translucent_chrome);
}

test "paint plan compositor when window-behind present" {
    var probe: Probe = .{ .backend = .wayland };
    probe.features.set(.material_backdrop_window_behind);
    const plan = planGtkBlurPaint(.layers_below, probe);
    try std.testing.expect(plan.path == .compositor_window_blur);
    try std.testing.expect(plan.degraded);
}

test "paint plan window-content not degraded when behind available" {
    var probe: Probe = .{ .backend = .wayland };
    probe.features.set(.material_backdrop_window_behind);
    const plan = planGtkBlurPaint(.window_content, probe);
    try std.testing.expect(plan.path == .compositor_window_blur);
    try std.testing.expect(!plan.degraded);
}
