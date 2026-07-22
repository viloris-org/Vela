//! Backend vtable: Zig control plane → L4 (C-compatible function pointers).

const types = @import("types.zig");

pub const BackendVTable = extern struct {
    ctx: ?*anyopaque,

    init: ?*const fn (ctx: ?*anyopaque) callconv(.c) i32,
    shutdown: ?*const fn (ctx: ?*anyopaque) callconv(.c) void,
    name: ?*const fn (ctx: ?*anyopaque) callconv(.c) [*:0]const u8,

    window_create: ?*const fn (
        ctx: ?*anyopaque,
        bounds: *const types.Rect,
        out_id: *types.WindowId,
    ) callconv(.c) i32,
    window_show: ?*const fn (ctx: ?*anyopaque, id: types.WindowId) callconv(.c) i32,
    window_close: ?*const fn (ctx: ?*anyopaque, id: types.WindowId) callconv(.c) i32,
    window_get_state: ?*const fn (
        ctx: ?*anyopaque,
        id: types.WindowId,
        out: *types.WindowState,
    ) callconv(.c) i32,
    window_set_bounds: ?*const fn (
        ctx: ?*anyopaque,
        id: types.WindowId,
        bounds: *const types.Rect,
    ) callconv(.c) i32,
    window_set_input_mode: ?*const fn (
        ctx: ?*anyopaque,
        id: types.WindowId,
        mode: types.InputMode,
    ) callconv(.c) i32,

    webview_create: ?*const fn (
        ctx: ?*anyopaque,
        window_id: types.WindowId,
        out_id: *types.WebViewId,
    ) callconv(.c) i32,
    webview_navigate: ?*const fn (
        ctx: ?*anyopaque,
        id: types.WebViewId,
        url: [*]const u8,
        url_len: usize,
    ) callconv(.c) i32,
    webview_inject_preload: ?*const fn (
        ctx: ?*anyopaque,
        id: types.WebViewId,
        script: [*]const u8,
        script_len: usize,
    ) callconv(.c) i32,

    layer_insert: ?*const fn (ctx: ?*anyopaque, layer: *const types.LayerRef) callconv(.c) i32,
    layer_update: ?*const fn (ctx: ?*anyopaque, layer: *const types.LayerRef) callconv(.c) i32,
    layer_remove: ?*const fn (ctx: ?*anyopaque, id: [*]const u8, id_len: usize) callconv(.c) i32,
    layer_list_count: ?*const fn (ctx: ?*anyopaque, out_count: *usize) callconv(.c) i32,

    hit_set_opaque_regions: ?*const fn (
        ctx: ?*anyopaque,
        layer_id: [*]const u8,
        layer_id_len: usize,
        rects: ?[*]const types.Rect,
        rect_count: usize,
        generation: u64,
    ) callconv(.c) i32,
    hit_resolve: ?*const fn (
        ctx: ?*anyopaque,
        point: types.Point,
        out: *types.HitTarget,
    ) callconv(.c) i32,

    material_resolve: ?*const fn (
        ctx: ?*anyopaque,
        material_id: [*]const u8,
        material_id_len: usize,
        out: *types.MaterialResult,
    ) callconv(.c) i32,

    events_set_callback: ?*const fn (
        ctx: ?*anyopaque,
        fn_ptr: ?types.EventFn,
        userdata: ?*anyopaque,
    ) callconv(.c) i32,

    pub fn callInit(self: *const BackendVTable) types.Status {
        if (self.init) |f| return types.Status.fromInt(f(self.ctx));
        return .unsupported;
    }

    pub fn callShutdown(self: *const BackendVTable) void {
        if (self.shutdown) |f| f(self.ctx);
    }

    pub fn callName(self: *const BackendVTable) []const u8 {
        if (self.name) |f| {
            const p = f(self.ctx);
            return std.mem.span(p);
        }
        return "unknown";
    }

    const std = @import("std");
};
