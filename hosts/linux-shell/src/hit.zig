//! Mirror of packages/api resolveHit for linux-shell.
//! When this disagrees with pure TS tests, fix the host first.

const std = @import("std");
const geometry = @import("geometry.zig");
const layers = @import("layers.zig");

pub const HitTargetKind = enum {
    os_desktop,
    window_background,
    webview,
    native,
    material,
    chrome,
};

pub const HitTarget = struct {
    kind: HitTargetKind,
    layer_id: []const u8 = "",
    local_x: f64 = 0,
    local_y: f64 = 0,
};

pub const WindowInputMode = enum { normal, click_through };

fn layerHitKind(kind: layers.LayerKind) HitTargetKind {
    return switch (kind) {
        layers.LayerKind.webview => HitTargetKind.webview,
        layers.LayerKind.native => HitTargetKind.native,
        layers.LayerKind.material => HitTargetKind.material,
        layers.LayerKind.chrome => HitTargetKind.chrome,
        layers.LayerKind.passthrough => HitTargetKind.native,
    };
}

fn policyAccepts(
    tree: *const layers.LayerTree,
    layer: *const layers.Layer,
    point: geometry.Point,
) bool {
    const mode = layer.hit_policy.mode;
    if (mode == layers.HitPolicyMode.solid) return true;
    if (mode == layers.HitPolicyMode.transparent) return false;
    if (mode == layers.HitPolicyMode.mask) return geometry.regionContains(layer.hit_policy.mask_region, point);
    if (mode == layers.HitPolicyMode.web_shaped) {
        const entry = tree.getShape(layer.id()) orelse return false;
        return geometry.regionContains(entry.regions, point);
    }
    // callback — Phase 1L stub
    return false;
}

pub fn resolveHit(
    window_mode: WindowInputMode,
    tree: *const layers.LayerTree,
    point: geometry.Point,
) HitTarget {
    if (window_mode == .click_through) {
        return .{ .kind = .os_desktop, .local_x = point.x, .local_y = point.y };
    }

    // Collect candidates: visible, bounds contain point, sort z desc.
    var idxs: [layers.max_layers]usize = undefined;
    var n: usize = 0;
    for (tree.layers, 0..) |layer, i| {
        if (!layer.alive or !layer.visible) continue;
        if (!geometry.rectContains(layer.bounds, point)) continue;
        idxs[n] = i;
        n += 1;
    }

    // Sort by z_index descending (simple insertion)
    var a: usize = 1;
    while (a < n) : (a += 1) {
        var b = a;
        while (b > 0 and tree.layers[idxs[b - 1]].z_index < tree.layers[idxs[b]].z_index) {
            const tmp = idxs[b - 1];
            idxs[b - 1] = idxs[b];
            idxs[b] = tmp;
            b -= 1;
        }
    }

    var i: usize = 0;
    while (i < n) : (i += 1) {
        const layer = &tree.layers[idxs[i]];
        if (!policyAccepts(tree, layer, point)) continue;
        return .{
            .kind = layerHitKind(layer.kind),
            .layer_id = layer.id(),
            .local_x = point.x - layer.bounds.x,
            .local_y = point.y - layer.bounds.y,
        };
    }
    return .{ .kind = .window_background, .local_x = point.x, .local_y = point.y };
}

/// Map HitTarget to vela_gtk hit route: 1 underlay 2 web 3 material 0 none
pub fn hitRoute(target: HitTarget) i32 {
    return switch (target.kind) {
        HitTargetKind.native => 1,
        HitTargetKind.webview => 2,
        HitTargetKind.material, HitTargetKind.chrome => 3,
        else => 0,
    };
}

pub fn formatHit(target: HitTarget, buf: []u8) []const u8 {
    const kind_name: []const u8 = switch (target.kind) {
        HitTargetKind.os_desktop => "os-desktop",
        HitTargetKind.window_background => "window-background",
        HitTargetKind.webview => "webview",
        HitTargetKind.native => "native",
        HitTargetKind.material => "material",
        HitTargetKind.chrome => "chrome",
    };
    return std.fmt.bufPrint(
        buf,
        "lastHit: {s} id={s} ({d:.0},{d:.0})",
        .{ kind_name, target.layer_id, target.local_x, target.local_y },
    ) catch "lastHit: (fmt err)";
}

test "toolbar opaque wins over web" {
    var tree: layers.LayerTree = .{};
    try layers.bootstrapDogfood(&tree, .{ .x = 0, .y = 0, .width = 800, .height = 600 });
    const t = resolveHit(.normal, &tree, .{ .x = 400, .y = 30 });
    try std.testing.expect(t.kind == .material);
    try std.testing.expectEqualStrings(layers.dogfood.toolbar_material, t.layer_id);
}

test "empty web-shaped falls through to underlay" {
    var tree: layers.LayerTree = .{};
    try layers.bootstrapDogfood(&tree, .{ .x = 0, .y = 0, .width = 800, .height = 600 });
    const t = resolveHit(.normal, &tree, .{ .x = 400, .y = 300 });
    try std.testing.expect(t.kind == .native);
    try std.testing.expectEqualStrings(layers.dogfood.underlay, t.layer_id);
}
