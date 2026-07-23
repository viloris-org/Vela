//! JSON bridge handlers for window.vela message-pass.

const std = @import("std");
const geometry = @import("geometry.zig");
const layers = @import("layers.zig");
const materials = @import("materials.zig");

pub const ShellState = struct {
    tree: layers.LayerTree = .{},
    allocator: std.mem.Allocator,
    last_material: ?materials.ResolvedMaterial = null,
    reply_buf: [4096]u8 = undefined,
    body_buf: [512]u8 = undefined,

    pub fn init(allocator: std.mem.Allocator) ShellState {
        return .{ .allocator = allocator };
    }
};

pub const BridgeResult = struct {
    eval_js: ?[]const u8 = null,
    material_bounds: ?geometry.Rect = null,
    material_visible: ?bool = null,
    log: ?[]const u8 = null,
};

fn jsonFloat(v: std.json.Value) f64 {
    return switch (v) {
        .float => |f| f,
        .integer => |i| @floatFromInt(i),
        else => 0,
    };
}

fn parseRect(obj: std.json.ObjectMap) ?geometry.Rect {
    const x = obj.get("x") orelse return null;
    const y = obj.get("y") orelse return null;
    const w = obj.get("width") orelse return null;
    const h = obj.get("height") orelse return null;
    return .{
        .x = jsonFloat(x),
        .y = jsonFloat(y),
        .width = jsonFloat(w),
        .height = jsonFloat(h),
    };
}

fn parseRegion(value: std.json.Value) geometry.Region {
    var region: geometry.Region = .{};
    const obj = switch (value) {
        .object => |o| o,
        else => return region,
    };
    const prims = obj.get("primitives") orelse return region;
    const arr = switch (prims) {
        .array => |a| a,
        else => return region,
    };
    for (arr.items) |item| {
        const pobj = switch (item) {
            .object => |o| o,
            else => continue,
        };
        const type_v = pobj.get("type") orelse continue;
        const type_s = switch (type_v) {
            .string => |s| s,
            else => continue,
        };
        const rect_val = pobj.get("rect") orelse continue;
        const rect_obj = switch (rect_val) {
            .object => |o| o,
            else => continue,
        };
        const rect = parseRect(rect_obj) orelse continue;
        if (std.mem.eql(u8, type_s, "rect")) {
            region.append(.{ .rect = rect }) catch {};
        } else if (std.mem.eql(u8, type_s, "capsule")) {
            region.append(.{ .capsule = rect }) catch {};
        } else if (std.mem.eql(u8, type_s, "roundedRect")) {
            const rad: f64 = if (pobj.get("radius")) |rv| jsonFloat(rv) else 0;
            region.append(.{ .rounded_rect = .{ .rect = rect, .radius = rad } }) catch {};
        }
    }
    return region;
}

fn makeReply(state: *ShellState, id: []const u8, ok: bool, body: []const u8) []const u8 {
    if (ok) {
        return std.fmt.bufPrint(
            &state.reply_buf,
            "window.__velaHostDispatch({{type:'res',id:'{s}',ok:true,result:{s}}})",
            .{ id, body },
        ) catch "void 0";
    }
    return std.fmt.bufPrint(
        &state.reply_buf,
        "window.__velaHostDispatch({{type:'res',id:'{s}',ok:false,error:{s}}})",
        .{ id, body },
    ) catch "void 0";
}

fn upsertLayer(tree: *layers.LayerTree, layer: layers.Layer) !void {
    if (tree.find(layer.id())) |existing| {
        existing.* = layer;
        existing.alive = true;
        return;
    }
    _ = try tree.insert(layer);
}

pub fn handleMessage(state: *ShellState, json_text: []const u8) BridgeResult {
    var result: BridgeResult = .{};

    const parsed = std.json.parseFromSlice(std.json.Value, state.allocator, json_text, .{}) catch {
        result.log = "bridge: invalid json";
        return result;
    };
    defer parsed.deinit();

    const root = switch (parsed.value) {
        .object => |o| o,
        else => {
            result.log = "bridge: root not object";
            return result;
        },
    };

    const type_v = root.get("type") orelse {
        result.log = "bridge: missing type";
        return result;
    };
    const type_s = switch (type_v) {
        .string => |s| s,
        else => {
            result.log = "bridge: type not string";
            return result;
        },
    };

    if (std.mem.eql(u8, type_s, "hit.setOpaqueRegions")) {
        const update_v = root.get("update") orelse return result;
        const update = switch (update_v) {
            .object => |o| o,
            else => return result,
        };
        const layer_id = switch (update.get("layerId") orelse return result) {
            .string => |s| s,
            else => return result,
        };
        const regions_v = update.get("opaqueRegions") orelse return result;
        const region = parseRegion(regions_v);
        var generation: ?u64 = null;
        if (update.get("generation")) |g| {
            generation = switch (g) {
                .integer => |i| @intCast(i),
                else => null,
            };
        }
        state.tree.applyWebShape(layer_id, region, generation) catch {
            result.log = "hit: dropped stale generation";
            return result;
        };
        result.log = "hit: opaque regions updated";
        return result;
    }

    if (std.mem.eql(u8, type_s, "hit.setMainOpaqueRegions")) {
        const region_v = root.get("region") orelse return result;
        const region = parseRegion(region_v);
        state.tree.applyWebShape(layers.dogfood.main_webview, region, null) catch {};
        result.log = "hit: main opaque regions updated";
        return result;
    }

    if (!std.mem.eql(u8, type_s, "req")) {
        result.log = "bridge: unhandled type";
        return result;
    }

    const id = switch (root.get("id") orelse return result) {
        .string => |s| s,
        else => return result,
    };
    const method = switch (root.get("method") orelse return result) {
        .string => |s| s,
        else => return result,
    };
    const args = root.get("args");

    if (std.mem.eql(u8, method, "call")) {
        result.eval_js = makeReply(state, id, false, "{code:'capability.denied',message:'call deny-all (linux spike)'}");
        result.log = "call denied";
        return result;
    }

    if (std.mem.eql(u8, method, "layers.insert")) {
        const spec = switch (args orelse .null) {
            .object => |o| o,
            else => {
                result.eval_js = makeReply(state, id, false, "{code:'invalid',message:'layers.insert needs object'}");
                return result;
            },
        };
        const lid = if (spec.get("id")) |v| switch (v) {
            .string => |s| s,
            else => "layer",
        } else "layer";
        const kind_s = if (spec.get("kind")) |v| switch (v) {
            .string => |s| s,
            else => "native",
        } else "native";
        const bounds: ?geometry.Rect = if (spec.get("bounds")) |b| switch (b) {
            .object => |o| parseRect(o),
            else => null,
        } else null;

        var layer: layers.Layer = .{};
        layer.setId(lid) catch {
            result.eval_js = makeReply(state, id, false, "{code:'capacity',message:'id too long'}");
            return result;
        };

        if (std.mem.eql(u8, kind_s, "material")) {
            layer.kind = .material;
            layer.z_index = 30;
            layer.hit_policy = .{ .mode = .solid };
            state.last_material = materials.paintPlanGtkBlur();
            if (bounds) |r| {
                layer.bounds = r;
                result.material_bounds = r;
            }
            result.material_visible = true;
            result.log = "layers.insert material (gtk.blur degraded paint)";
        } else if (std.mem.eql(u8, kind_s, "webview")) {
            layer.kind = .webview;
            layer.hit_policy = .{ .mode = .web_shaped };
            layer.z_index = 10;
            if (bounds) |r| layer.bounds = r;
            result.log = "layers.insert webview";
        } else {
            layer.kind = .native;
            layer.hit_policy = .{ .mode = .solid };
            if (bounds) |r| layer.bounds = r;
            if (spec.get("zIndex")) |z| layer.z_index = @intFromFloat(jsonFloat(z));
            result.log = "layers.insert native";
        }

        if (spec.get("zIndex")) |z| layer.z_index = @intFromFloat(jsonFloat(z));

        upsertLayer(&state.tree, layer) catch {
            result.eval_js = makeReply(state, id, false, "{code:'capacity',message:'layer table full'}");
            return result;
        };

        const body = std.fmt.bufPrint(&state.body_buf, "{{id:'{s}'}}", .{lid}) catch "{id:'layer'}";
        result.eval_js = makeReply(state, id, true, body);
        return result;
    }

    if (std.mem.eql(u8, method, "layers.update") or std.mem.eql(u8, method, "layers.remove")) {
        result.eval_js = makeReply(state, id, true, "null");
        return result;
    }

    result.eval_js = makeReply(state, id, false, "{code:'unsupported.platform',message:'unknown method'}");
    return result;
}
