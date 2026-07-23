//! Layer tree + web-shaped store for linux-shell.
//! Dogfood ids must match packages/shell-core DOGFOOD_LAYER_IDS.

const std = @import("std");
const geometry = @import("geometry.zig");

pub const max_layers = 16;
pub const max_id_len = 64;

pub const LayerKind = enum { webview, native, material, chrome, passthrough };

/// Note: cannot use enum tag `opaque` — reserved keyword in Zig.
pub const HitPolicyMode = enum { solid, transparent, mask, web_shaped, callback };

pub const HitPolicy = struct {
    mode: HitPolicyMode = .solid,
    /// Used when mode == mask
    mask_region: geometry.Region = .{},
};

pub const Layer = struct {
    id_buf: [max_id_len]u8 = undefined,
    id_len: usize = 0,
    kind: LayerKind = .native,
    bounds: geometry.Rect = .{ .x = 0, .y = 0, .width = 0, .height = 0 },
    z_index: i32 = 0,
    visible: bool = true,
    opacity: f64 = 1.0,
    hit_policy: HitPolicy = .{},
    alive: bool = false,

    pub fn id(self: *const Layer) []const u8 {
        return self.id_buf[0..self.id_len];
    }

    pub fn setId(self: *Layer, s: []const u8) !void {
        if (s.len > max_id_len) return error.Capacity;
        @memcpy(self.id_buf[0..s.len], s);
        self.id_len = s.len;
    }
};

pub const OpaqueEntry = struct {
    regions: geometry.Region = .{},
    last_generation: ?u64 = null,
    used: bool = false,
    layer_id_buf: [max_id_len]u8 = undefined,
    layer_id_len: usize = 0,
};

pub const LayerTree = struct {
    layers: [max_layers]Layer = [_]Layer{.{}} ** max_layers,
    shape_store: [max_layers]OpaqueEntry = [_]OpaqueEntry{.{}} ** max_layers,

    pub fn find(self: *LayerTree, id: []const u8) ?*Layer {
        for (&self.layers) |*layer| {
            if (layer.alive and std.mem.eql(u8, layer.id(), id)) return layer;
        }
        return null;
    }

    pub fn insert(self: *LayerTree, layer: Layer) !*Layer {
        if (self.find(layer.id())) |_| return error.AlreadyExists;
        for (&self.layers) |*slot| {
            if (!slot.alive) {
                slot.* = layer;
                slot.alive = true;
                return slot;
            }
        }
        return error.Capacity;
    }

    pub fn remove(self: *LayerTree, id: []const u8) bool {
        if (self.find(id)) |layer| {
            layer.alive = false;
            return true;
        }
        return false;
    }

    pub fn isGenerationStale(last: ?u64, incoming: ?u64) bool {
        if (incoming == null or last == null) return false;
        return incoming.? < last.?;
    }

    pub fn applyWebShape(
        self: *LayerTree,
        layer_id: []const u8,
        regions: geometry.Region,
        generation: ?u64,
    ) error{Stale}!void {
        var entry: ?*OpaqueEntry = null;
        for (&self.shape_store) |*e| {
            if (e.used and std.mem.eql(u8, e.layer_id_buf[0..e.layer_id_len], layer_id)) {
                entry = e;
                break;
            }
        }
        if (entry) |e| {
            if (isGenerationStale(e.last_generation, generation)) return error.Stale;
            e.regions = regions;
            if (generation) |g| e.last_generation = g;
            return;
        }
        for (&self.shape_store) |*e| {
            if (!e.used) {
                if (layer_id.len > max_id_len) return;
                @memcpy(e.layer_id_buf[0..layer_id.len], layer_id);
                e.layer_id_len = layer_id.len;
                e.regions = regions;
                e.last_generation = generation;
                e.used = true;
                return;
            }
        }
    }

    pub fn getShape(self: *const LayerTree, layer_id: []const u8) ?*const OpaqueEntry {
        for (&self.shape_store) |*e| {
            if (e.used and std.mem.eql(u8, e.layer_id_buf[0..e.layer_id_len], layer_id)) {
                return e;
            }
        }
        return null;
    }
};

pub const dogfood = struct {
    pub const underlay = "underlay-native";
    pub const main_webview = "main-webview";
    pub const toolbar_material = "toolbar-material";
};

pub fn bootstrapDogfood(tree: *LayerTree, content: geometry.Rect) !void {
    var underlay: Layer = .{
        .kind = .native,
        .bounds = content,
        .z_index = 5,
        .hit_policy = .{ .mode = .solid },
    };
    try underlay.setId(dogfood.underlay);
    _ = try tree.insert(underlay);

    var web: Layer = .{
        .kind = .webview,
        .bounds = content,
        .z_index = 10,
        .hit_policy = .{ .mode = .web_shaped },
    };
    try web.setId(dogfood.main_webview);
    _ = try tree.insert(web);

    const toolbar_h: f64 = 52;
    const inset_x: f64 = 16;
    const inset_y: f64 = 12;
    var toolbar: Layer = .{
        .kind = .material,
        .bounds = .{
            .x = content.x + inset_x,
            .y = content.y + inset_y,
            .width = @max(0, content.width - inset_x * 2),
            .height = toolbar_h,
        },
        .z_index = 30,
        .hit_policy = .{ .mode = .solid },
    };
    try toolbar.setId(dogfood.toolbar_material);
    _ = try tree.insert(toolbar);
}

test "stale generation" {
    try std.testing.expect(LayerTree.isGenerationStale(5, 4));
    try std.testing.expect(!LayerTree.isGenerationStale(5, 5));
    try std.testing.expect(!LayerTree.isGenerationStale(null, 1));
}
