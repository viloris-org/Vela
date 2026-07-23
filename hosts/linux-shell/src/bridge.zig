//! JSON bridge handlers for window.vela message-pass.

const std = @import("std");
const geometry = @import("geometry.zig");
const layers = @import("layers.zig");
const materials = @import("materials.zig");

const session = @import("session.zig");

pub const ShellState = struct {
    tree: layers.LayerTree = .{},
    allocator: std.mem.Allocator,
    last_material: ?materials.ResolvedMaterial = null,
    /// Display probe for honest material paint plans on insert.
    session_probe: session.Probe = .{},
    /// Active material layer id (single material host widget in Phase 1L).
    material_layer_id: [layers.max_id_len]u8 = undefined,
    material_layer_id_len: usize = 0,
    reply_buf: [4096]u8 = undefined,
    body_buf: [512]u8 = undefined,
    event_buf: [1024]u8 = undefined,

    pub fn init(allocator: std.mem.Allocator) ShellState {
        return .{ .allocator = allocator };
    }

    pub fn materialId(self: *const ShellState) []const u8 {
        return self.material_layer_id[0..self.material_layer_id_len];
    }

    pub fn setMaterialId(self: *ShellState, id: []const u8) void {
        const n = @min(id.len, layers.max_id_len);
        @memcpy(self.material_layer_id[0..n], id[0..n]);
        self.material_layer_id_len = n;
    }
};

pub const BridgeResult = struct {
    eval_js: ?[]const u8 = null,
    material_bounds: ?geometry.Rect = null,
    material_visible: ?bool = null,
    /// true → material overlay above WebView (toolbar chrome); false → under WebView (card glass).
    material_above_web: ?bool = null,
    material_radius: ?f64 = null,
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

fn parseHitPolicy(spec: std.json.ObjectMap) layers.HitPolicy {
    const hp = spec.get("hitPolicy") orelse return .{ .mode = .solid };
    const obj = switch (hp) {
        .object => |o| o,
        else => return .{ .mode = .solid },
    };
    const mode_v = obj.get("mode") orelse return .{ .mode = .solid };
    const mode_s = switch (mode_v) {
        .string => |s| s,
        else => return .{ .mode = .solid },
    };
    if (std.mem.eql(u8, mode_s, "transparent")) return .{ .mode = .transparent };
    if (std.mem.eql(u8, mode_s, "web-shaped") or std.mem.eql(u8, mode_s, "web_shaped")) {
        return .{ .mode = .web_shaped };
    }
    if (std.mem.eql(u8, mode_s, "opaque") or std.mem.eql(u8, mode_s, "solid")) {
        return .{ .mode = .solid };
    }
    return .{ .mode = .solid };
}

fn parseShapeRadius(spec: std.json.ObjectMap) ?f64 {
    const shape = spec.get("shape") orelse return null;
    const obj = switch (shape) {
        .object => |o| o,
        else => return null,
    };
    const type_v = obj.get("type") orelse return null;
    const type_s = switch (type_v) {
        .string => |s| s,
        else => return null,
    };
    if (std.mem.eql(u8, type_s, "capsule")) return -1; // sentinel: full pill
    if (obj.get("radius")) |rv| {
        return switch (rv) {
            .float, .integer => jsonFloat(rv),
            else => null,
        };
    }
    return null;
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

/// Reply + optional material.degraded event in one eval.
fn makeReplyWithDegrade(
    state: *ShellState,
    id: []const u8,
    body: []const u8,
    paint: materials.PaintResult,
) []const u8 {
    const reply = makeReply(state, id, true, body);
    if (!paint.degraded) return reply;

    const reason = paint.reason orelse "no-backdrop-blur";
    const event = std.fmt.bufPrint(
        &state.event_buf,
        ";window.__velaHostDispatch({{type:'event',channel:'material.degraded',payload:{{material:'{s}',degraded:true,reason:'{s}'}}}})",
        .{ paint.effective, reason },
    ) catch return reply;

    // Append event after reply into reply_buf if space remains.
    if (reply.len + event.len >= state.reply_buf.len) return reply;
    @memcpy(state.reply_buf[reply.len .. reply.len + event.len], event);
    return state.reply_buf[0 .. reply.len + event.len];
}

fn upsertLayer(tree: *layers.LayerTree, layer: layers.Layer) !void {
    if (tree.find(layer.id())) |existing| {
        existing.* = layer;
        existing.alive = true;
        return;
    }
    _ = try tree.insert(layer);
}

fn webZ(tree: *layers.LayerTree) i32 {
    if (tree.find(layers.dogfood.main_webview)) |web| return web.z_index;
    return 10;
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
            layer.hit_policy = parseHitPolicy(spec);
            if (spec.get("zIndex")) |z| layer.z_index = @intFromFloat(jsonFloat(z));
            // Prefer requested material id when present (maps foreign → gtk.blur on Linux).
            const requested: []const u8 = if (spec.get("material")) |mv| switch (mv) {
                .string => |s| s,
                else => "gtk.blur",
            } else "gtk.blur";
            const paint = materials.planPaint(requested, state.session_probe);
            state.last_material = materials.toResolved(paint);
            state.setMaterialId(lid);
            if (bounds) |r| layer.bounds = r;
            layer.visible = true;
            result.material_bounds = layer.bounds;
            result.material_visible = true;
            result.material_above_web = layer.z_index > webZ(&state.tree);
            result.material_radius = parseShapeRadius(spec);
            result.log = "layers.insert material (paint plan applied)";

            upsertLayer(&state.tree, layer) catch {
                result.eval_js = makeReply(state, id, false, "{code:'capacity',message:'layer table full'}");
                return result;
            };

            const body = std.fmt.bufPrint(&state.body_buf, "{{id:'{s}'}}", .{lid}) catch "{id:'layer'}";
            result.eval_js = makeReplyWithDegrade(state, id, body, paint);
            return result;
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

    if (std.mem.eql(u8, method, "layers.update")) {
        const obj = switch (args orelse .null) {
            .object => |o| o,
            else => {
                result.eval_js = makeReply(state, id, false, "{code:'invalid',message:'layers.update needs object'}");
                return result;
            },
        };
        const lid = switch (obj.get("id") orelse .null) {
            .string => |s| s,
            else => {
                result.eval_js = makeReply(state, id, false, "{code:'invalid',message:'layers.update needs id'}");
                return result;
            },
        };
        const patch = switch (obj.get("patch") orelse .null) {
            .object => |o| o,
            else => {
                result.eval_js = makeReply(state, id, true, "null");
                return result;
            },
        };

        if (state.tree.find(lid)) |layer| {
            if (patch.get("bounds")) |b| {
                if (switch (b) {
                    .object => |o| parseRect(o),
                    else => null,
                }) |r| {
                    layer.bounds = r;
                    if (layer.kind == .material) {
                        result.material_bounds = r;
                        result.material_visible = layer.visible;
                        result.material_above_web = layer.z_index > webZ(&state.tree);
                    }
                }
            }
            if (patch.get("zIndex")) |z| {
                layer.z_index = @intFromFloat(jsonFloat(z));
                if (layer.kind == .material) {
                    result.material_above_web = layer.z_index > webZ(&state.tree);
                }
            }
            if (patch.get("shape")) |_| {
                // Re-parse shape from patch root: { shape: {...} }
                result.material_radius = parseShapeRadius(patch);
            }
            if (patch.get("hitPolicy")) |_| {
                // rebuild from a synthetic view: hitPolicy is on patch root
                layer.hit_policy = parseHitPolicy(patch);
            }
            result.log = "layers.update ok";
        } else {
            result.log = "layers.update: unknown id";
        }

        result.eval_js = makeReply(state, id, true, "null");
        return result;
    }

    if (std.mem.eql(u8, method, "layers.remove")) {
        const lid = switch (args orelse .null) {
            .string => |s| s,
            .object => |o| switch (o.get("id") orelse .null) {
                .string => |s| s,
                else => "",
            },
            else => "",
        };
        if (lid.len > 0) {
            _ = state.tree.remove(lid);
            if (std.mem.eql(u8, lid, state.materialId())) {
                result.material_visible = false;
                state.material_layer_id_len = 0;
            }
        }
        result.eval_js = makeReply(state, id, true, "null");
        return result;
    }

    result.eval_js = makeReply(state, id, false, "{code:'unsupported.platform',message:'unknown method'}");
    return result;
}
