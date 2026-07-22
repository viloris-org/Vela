//! In-memory L4 mock: implements BackendVTable without real windowing.

const std = @import("std");
const types = @import("../abi/types.zig");
const vtable_mod = @import("../abi/vtable.zig");

pub const max_layers = 32;
pub const max_windows = 4;
pub const max_webviews = 8;
pub const max_id_bytes = 64;
pub const max_url_bytes = 512;

const Window = struct {
    id: types.WindowId,
    state: types.WindowState,
    alive: bool = false,
};

const WebView = struct {
    id: types.WebViewId,
    window_id: types.WindowId,
    last_url: [max_url_bytes]u8 = undefined,
    last_url_len: usize = 0,
    alive: bool = false,
};

const Layer = struct {
    id_buf: [max_id_bytes]u8 = undefined,
    id_len: usize = 0,
    z_index: i32 = 0,
    alive: bool = false,
};

pub const MockBackend = struct {
    windows: [max_windows]Window = [_]Window{.{
        .id = 0,
        .state = .{
            .bounds = .{ .x = 0, .y = 0, .width = 0, .height = 0 },
            .scale_factor = 1.0,
            .input_mode = .normal,
            .visible = 0,
            .focused = 0,
        },
        .alive = false,
    }} ** max_windows,
    webviews: [max_webviews]WebView = [_]WebView{.{
        .id = 0,
        .window_id = 0,
        .alive = false,
    }} ** max_webviews,
    layers: [max_layers]Layer = [_]Layer{.{}} ** max_layers,
    next_window_id: types.WindowId = 1,
    next_webview_id: types.WebViewId = 1,
    layer_count: usize = 0,
    event_fn: ?types.EventFn = null,
    event_userdata: ?*anyopaque = null,
    material_id_storage: [max_id_bytes]u8 = undefined,
    material_id_len: usize = 0,
    material_reason: []const u8 = "mock backend has no system materials",
    hit_layer_id: [max_id_bytes]u8 = undefined,
    hit_layer_id_len: usize = 0,
    last_generation: u64 = 0,

    pub fn initEmpty() MockBackend {
        return .{};
    }

    pub fn createVTable(self: *MockBackend) vtable_mod.BackendVTable {
        return .{
            .ctx = self,
            .init = cInit,
            .shutdown = cShutdown,
            .name = cName,
            .window_create = cWindowCreate,
            .window_show = cWindowShow,
            .window_close = cWindowClose,
            .window_get_state = cWindowGetState,
            .window_set_bounds = cWindowSetBounds,
            .window_set_input_mode = cWindowSetInputMode,
            .webview_create = cWebViewCreate,
            .webview_navigate = cWebViewNavigate,
            .webview_inject_preload = cWebViewInjectPreload,
            .layer_insert = cLayerInsert,
            .layer_update = cLayerUpdate,
            .layer_remove = cLayerRemove,
            .layer_list_count = cLayerListCount,
            .hit_set_opaque_regions = cHitSetOpaqueRegions,
            .hit_resolve = cHitResolve,
            .material_resolve = cMaterialResolve,
            .events_set_callback = cEventsSetCallback,
        };
    }

    fn findWindow(self: *MockBackend, id: types.WindowId) ?*Window {
        for (&self.windows) |*w| {
            if (w.alive and w.id == id) return w;
        }
        return null;
    }

    fn findWebView(self: *MockBackend, id: types.WebViewId) ?*WebView {
        for (&self.webviews) |*wv| {
            if (wv.alive and wv.id == id) return wv;
        }
        return null;
    }

    fn findLayer(self: *MockBackend, id: []const u8) ?*Layer {
        for (&self.layers) |*layer| {
            if (layer.alive and std.mem.eql(u8, layer.id_buf[0..layer.id_len], id)) return layer;
        }
        return null;
    }
};

fn asMock(ctx: ?*anyopaque) *MockBackend {
    return @ptrCast(@alignCast(ctx.?));
}

fn cInit(ctx: ?*anyopaque) callconv(.c) i32 {
    _ = asMock(ctx);
    return types.Status.ok.toInt();
}

fn cShutdown(ctx: ?*anyopaque) callconv(.c) void {
    const self = asMock(ctx);
    self.* = MockBackend.initEmpty();
}

fn cName(ctx: ?*anyopaque) callconv(.c) [*:0]const u8 {
    _ = ctx;
    return "mock";
}

fn cWindowCreate(
    ctx: ?*anyopaque,
    bounds: *const types.Rect,
    out_id: *types.WindowId,
) callconv(.c) i32 {
    const self = asMock(ctx);
    for (&self.windows) |*w| {
        if (!w.alive) {
            w.* = .{
                .id = self.next_window_id,
                .alive = true,
                .state = .{
                    .bounds = bounds.*,
                    .scale_factor = 1.0,
                    .input_mode = .normal,
                    .visible = 0,
                    .focused = 0,
                },
            };
            self.next_window_id += 1;
            out_id.* = w.id;
            return types.Status.ok.toInt();
        }
    }
    return types.Status.capacity.toInt();
}

fn cWindowShow(ctx: ?*anyopaque, id: types.WindowId) callconv(.c) i32 {
    const w = asMock(ctx).findWindow(id) orelse return types.Status.not_found.toInt();
    w.state.visible = 1;
    w.state.focused = 1;
    return types.Status.ok.toInt();
}

fn cWindowClose(ctx: ?*anyopaque, id: types.WindowId) callconv(.c) i32 {
    const w = asMock(ctx).findWindow(id) orelse return types.Status.not_found.toInt();
    w.alive = false;
    return types.Status.ok.toInt();
}

fn cWindowGetState(
    ctx: ?*anyopaque,
    id: types.WindowId,
    out: *types.WindowState,
) callconv(.c) i32 {
    const w = asMock(ctx).findWindow(id) orelse return types.Status.not_found.toInt();
    out.* = w.state;
    return types.Status.ok.toInt();
}

fn cWindowSetBounds(
    ctx: ?*anyopaque,
    id: types.WindowId,
    bounds: *const types.Rect,
) callconv(.c) i32 {
    const w = asMock(ctx).findWindow(id) orelse return types.Status.not_found.toInt();
    w.state.bounds = bounds.*;
    return types.Status.ok.toInt();
}

fn cWindowSetInputMode(
    ctx: ?*anyopaque,
    id: types.WindowId,
    mode: types.InputMode,
) callconv(.c) i32 {
    const w = asMock(ctx).findWindow(id) orelse return types.Status.not_found.toInt();
    w.state.input_mode = mode;
    return types.Status.ok.toInt();
}

fn cWebViewCreate(
    ctx: ?*anyopaque,
    window_id: types.WindowId,
    out_id: *types.WebViewId,
) callconv(.c) i32 {
    const self = asMock(ctx);
    if (self.findWindow(window_id) == null) return types.Status.not_found.toInt();
    for (&self.webviews) |*wv| {
        if (!wv.alive) {
            wv.* = .{
                .id = self.next_webview_id,
                .window_id = window_id,
                .alive = true,
                .last_url_len = 0,
            };
            self.next_webview_id += 1;
            out_id.* = wv.id;
            return types.Status.ok.toInt();
        }
    }
    return types.Status.capacity.toInt();
}

fn cWebViewNavigate(
    ctx: ?*anyopaque,
    id: types.WebViewId,
    url: [*]const u8,
    url_len: usize,
) callconv(.c) i32 {
    const wv = asMock(ctx).findWebView(id) orelse return types.Status.not_found.toInt();
    if (url_len > max_url_bytes) return types.Status.invalid.toInt();
    @memcpy(wv.last_url[0..url_len], url[0..url_len]);
    wv.last_url_len = url_len;
    return types.Status.ok.toInt();
}

fn cWebViewInjectPreload(
    ctx: ?*anyopaque,
    id: types.WebViewId,
    script: [*]const u8,
    script_len: usize,
) callconv(.c) i32 {
    _ = script;
    _ = script_len;
    if (asMock(ctx).findWebView(id) == null) return types.Status.not_found.toInt();
    return types.Status.ok.toInt();
}

fn storeId(dest: *[max_id_bytes]u8, src: []const u8) ?usize {
    if (src.len == 0 or src.len > max_id_bytes) return null;
    @memcpy(dest[0..src.len], src);
    return src.len;
}

fn cLayerInsert(ctx: ?*anyopaque, layer: *const types.LayerRef) callconv(.c) i32 {
    const self = asMock(ctx);
    const id = layer.id[0..layer.id_len];
    if (self.findLayer(id) != null) return types.Status.invalid.toInt();
    for (&self.layers) |*slot| {
        if (!slot.alive) {
            const n = storeId(&slot.id_buf, id) orelse return types.Status.invalid.toInt();
            slot.id_len = n;
            slot.z_index = layer.z_index;
            slot.alive = true;
            self.layer_count += 1;
            return types.Status.ok.toInt();
        }
    }
    return types.Status.capacity.toInt();
}

fn cLayerUpdate(ctx: ?*anyopaque, layer: *const types.LayerRef) callconv(.c) i32 {
    const self = asMock(ctx);
    const id = layer.id[0..layer.id_len];
    const slot = self.findLayer(id) orelse return types.Status.not_found.toInt();
    slot.z_index = layer.z_index;
    return types.Status.ok.toInt();
}

fn cLayerRemove(ctx: ?*anyopaque, id_ptr: [*]const u8, id_len: usize) callconv(.c) i32 {
    const self = asMock(ctx);
    const id = id_ptr[0..id_len];
    const slot = self.findLayer(id) orelse return types.Status.not_found.toInt();
    slot.alive = false;
    slot.id_len = 0;
    self.layer_count -|= 1;
    return types.Status.ok.toInt();
}

fn cLayerListCount(ctx: ?*anyopaque, out_count: *usize) callconv(.c) i32 {
    out_count.* = asMock(ctx).layer_count;
    return types.Status.ok.toInt();
}

fn cHitSetOpaqueRegions(
    ctx: ?*anyopaque,
    layer_id: [*]const u8,
    layer_id_len: usize,
    rects: ?[*]const types.Rect,
    rect_count: usize,
    generation: u64,
) callconv(.c) i32 {
    _ = rects;
    _ = rect_count;
    const self = asMock(ctx);
    const id = layer_id[0..layer_id_len];
    const n = storeId(&self.hit_layer_id, id) orelse return types.Status.invalid.toInt();
    self.hit_layer_id_len = n;
    self.last_generation = generation;
    return types.Status.ok.toInt();
}

fn cHitResolve(
    ctx: ?*anyopaque,
    point: types.Point,
    out: *types.HitTarget,
) callconv(.c) i32 {
    _ = point;
    const self = asMock(ctx);
    if (self.hit_layer_id_len == 0) {
        return types.Status.not_found.toInt();
    }
    out.* = .{
        .layer_id = &self.hit_layer_id,
        .layer_id_len = self.hit_layer_id_len,
        .kind = 0,
    };
    return types.Status.ok.toInt();
}

fn cMaterialResolve(
    ctx: ?*anyopaque,
    material_id: [*]const u8,
    material_id_len: usize,
    out: *types.MaterialResult,
) callconv(.c) i32 {
    const self = asMock(ctx);
    const id = material_id[0..material_id_len];
    const n = storeId(&self.material_id_storage, id) orelse return types.Status.invalid.toInt();
    self.material_id_len = n;
    out.* = .{
        .degraded = 1,
        .resolved_id = &self.material_id_storage,
        .resolved_id_len = self.material_id_len,
        .reason = self.material_reason.ptr,
        .reason_len = self.material_reason.len,
    };
    return types.Status.ok.toInt();
}

fn cEventsSetCallback(
    ctx: ?*anyopaque,
    fn_ptr: ?types.EventFn,
    userdata: ?*anyopaque,
) callconv(.c) i32 {
    const self = asMock(ctx);
    self.event_fn = fn_ptr;
    self.event_userdata = userdata;
    return types.Status.ok.toInt();
}

test "mock window create show getState" {
    var mock = MockBackend.initEmpty();
    var vt = mock.createVTable();
    try std.testing.expectEqual(types.Status.ok, vt.callInit());
    try std.testing.expectEqualStrings("mock", vt.callName());

    const bounds = types.Rect{ .x = 0, .y = 0, .width = 800, .height = 600 };
    var id: types.WindowId = 0;
    try std.testing.expectEqual(
        @as(i32, 0),
        vt.window_create.?(vt.ctx, &bounds, &id),
    );
    try std.testing.expect(id != 0);
    try std.testing.expectEqual(@as(i32, 0), vt.window_show.?(vt.ctx, id));

    var state: types.WindowState = undefined;
    try std.testing.expectEqual(@as(i32, 0), vt.window_get_state.?(vt.ctx, id, &state));
    try std.testing.expectEqual(@as(f64, 800), state.bounds.width);
    try std.testing.expectEqual(@as(i32, 1), state.visible);

    vt.callShutdown();
}

test "mock layer insert list remove" {
    var mock = MockBackend.initEmpty();
    var vt = mock.createVTable();
    _ = vt.callInit();

    const id = "main-webview";
    const layer = types.LayerRef{
        .id = id.ptr,
        .id_len = id.len,
        .z_index = 10,
    };
    try std.testing.expectEqual(@as(i32, 0), vt.layer_insert.?(vt.ctx, &layer));
    var count: usize = 0;
    try std.testing.expectEqual(@as(i32, 0), vt.layer_list_count.?(vt.ctx, &count));
    try std.testing.expectEqual(@as(usize, 1), count);
    try std.testing.expectEqual(@as(i32, 0), vt.layer_remove.?(vt.ctx, id.ptr, id.len));
    try std.testing.expectEqual(@as(i32, 0), vt.layer_list_count.?(vt.ctx, &count));
    try std.testing.expectEqual(@as(usize, 0), count);
}
