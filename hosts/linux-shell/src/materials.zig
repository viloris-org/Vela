//! Material resolve for Linux — policy preference gtk.blur + paint honesty.
//! Paint path selection uses session.zig (Wayland/compositor probe).

const std = @import("std");
const session = @import("session.zig");

pub const ResolvedMaterial = struct {
    requested: []const u8,
    effective: []const u8,
    degraded: bool,
    reason: ?[]const u8,
};

pub const PaintResult = struct {
    requested: []const u8,
    effective: []const u8,
    degraded: bool,
    reason: ?[]const u8,
    path: session.MaterialPaintPath,
};

/// Mirror packages/api resolveMaterial for platform linux (preference only).
pub fn resolveMaterialLinux(requested: []const u8) ResolvedMaterial {
    if (std.mem.eql(u8, requested, "fallback.css")) {
        return .{
            .requested = requested,
            .effective = "fallback.css",
            .degraded = false,
            .reason = null,
        };
    }
    if (std.mem.eql(u8, requested, "gtk.blur")) {
        return .{
            .requested = requested,
            .effective = "gtk.blur",
            .degraded = false,
            .reason = null,
        };
    }
    return .{
        .requested = requested,
        .effective = "gtk.blur",
        .degraded = true,
        .reason = "Mapped foreign material → gtk.blur (best effort)",
    };
}

/// Plan paint for dogfood toolbar (default samples: layers-below).
pub fn planPaint(requested: []const u8, probe: session.Probe) PaintResult {
    const resolved = resolveMaterialLinux(requested);
    if (std.mem.eql(u8, resolved.effective, "fallback.css")) {
        return .{
            .requested = requested,
            .effective = "fallback.css",
            .degraded = resolved.degraded,
            .reason = resolved.reason orelse "CSS material fallback",
            .path = .css_fallback,
        };
    }

    const plan = session.planGtkBlurPaint(.layers_below, probe);
    // Preference resolve may already be degraded (foreign id map).
    const degraded = resolved.degraded or plan.degraded;
    const reason: ?[]const u8 = if (resolved.degraded and resolved.reason != null)
        resolved.reason
    else
        plan.reason;

    return .{
        .requested = requested,
        .effective = resolved.effective,
        .degraded = degraded,
        .reason = reason,
        .path = plan.path,
    };
}

/// Spike default when no display probe is available.
pub fn paintPlanGtkBlur() PaintResult {
    return planPaint("gtk.blur", .{});
}

/// Convert paint result to the simpler resolve record used by bridge state.
pub fn toResolved(paint: PaintResult) ResolvedMaterial {
    return .{
        .requested = paint.requested,
        .effective = paint.effective,
        .degraded = paint.degraded,
        .reason = paint.reason,
    };
}

test "linux maps apple glass" {
    const r = resolveMaterialLinux("apple.liquidGlass");
    try std.testing.expect(r.degraded);
    try std.testing.expectEqualStrings("gtk.blur", r.effective);
}

test "default paint is translucent degrade" {
    const paint = paintPlanGtkBlur();
    try std.testing.expect(paint.degraded);
    try std.testing.expect(paint.path == .translucent_chrome);
}

test "paint uses compositor path when probe has window-behind" {
    var probe: session.Probe = .{ .backend = .wayland };
    probe.features.set(.material_backdrop_window_behind);
    const paint = planPaint("gtk.blur", probe);
    try std.testing.expect(paint.path == .compositor_window_blur);
    try std.testing.expect(paint.degraded);
}
