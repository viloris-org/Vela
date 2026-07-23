//! Material resolve for Linux — policy preference gtk.blur + paint honesty.

const std = @import("std");

pub const ResolvedMaterial = struct {
    requested: []const u8,
    effective: []const u8,
    degraded: bool,
    reason: ?[]const u8,
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

/// Spike paint path: no live layers-below compositor glass.
pub fn paintPlanGtkBlur() ResolvedMaterial {
    return .{
        .requested = "gtk.blur",
        .effective = "gtk.blur",
        .degraded = true,
        .reason = "no-backdrop-blur: translucent host chrome (Tier 2 spike)",
    };
}

test "linux maps apple glass" {
    const r = resolveMaterialLinux("apple.liquidGlass");
    try std.testing.expect(r.degraded);
    try std.testing.expectEqualStrings("gtk.blur", r.effective);
}
