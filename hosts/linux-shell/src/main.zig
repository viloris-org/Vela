//! vela-linux-shell — Linux Tier 2 composition spike entry.
//! GTK4 + WebKitGTK 6.0 via thin C wrappers; policy in Zig.
//! Zig 0.16: main takes `std.process.Init`.

const std = @import("std");
const geometry = @import("geometry.zig");
const layers = @import("layers.zig");
const hit = @import("hit.zig");
const materials = @import("materials.zig");
const bridge = @import("bridge.zig");
const c = @cImport({
    @cInclude("vela_gtk.h");
});

const version = "0.0.1";

const AppCtx = struct {
    state: bridge.ShellState,
    gtk: ?*c.VelaGtkApp = null,
    last_hit: hit.HitTarget = .{ .kind = .window_background },
    label_buf: [256]u8 = undefined,
};

fn onPointerDown(userdata: ?*anyopaque, x: f64, y: f64) callconv(.c) void {
    const ctx: *AppCtx = @ptrCast(@alignCast(userdata.?));
    const target = hit.resolveHit(.normal, &ctx.state.tree, .{ .x = x, .y = y });
    ctx.last_hit = target;
    const route = hit.hitRoute(target);
    if (ctx.gtk) |app| {
        c.vela_gtk_set_hit_route(app, route);
        const label = hit.formatHit(target, &ctx.label_buf);
        // ensure null-terminated for C
        if (label.len < ctx.label_buf.len) {
            ctx.label_buf[label.len] = 0;
        }
        c.vela_gtk_set_debug_hit_label(app, &ctx.label_buf);
    }
    std.log.info("pointerDown ({d:.1},{d:.1}) → {s}", .{
        x,
        y,
        hit.formatHit(target, &ctx.label_buf),
    });
}

fn onBridgeMessage(userdata: ?*anyopaque, json: [*c]const u8, json_len: usize) callconv(.c) void {
    const ctx: *AppCtx = @ptrCast(@alignCast(userdata.?));
    const slice = json[0..json_len];
    const result = bridge.handleMessage(&ctx.state, slice);
    if (result.log) |log_line| {
        std.log.info("{s}", .{log_line});
    }
    if (ctx.gtk) |app| {
        if (result.material_bounds) |b| {
            var rect = c.VelaGtkRect{
                .x = b.x,
                .y = b.y,
                .width = b.width,
                .height = b.height,
            };
            c.vela_gtk_set_material_bounds(app, &rect);
        }
        if (result.material_visible) |vis| {
            c.vela_gtk_set_material_visible(app, if (vis) 1 else 0);
        }
        if (result.eval_js) |js| {
            // js is a slice into reply_buf; need NUL for C
            if (js.ptr[js.len] == 0 or js.len < ctx.state.reply_buf.len) {
                // ensure NUL: reply_buf is larger; write terminator if possible
            }
            var zbuf: [4096]u8 = undefined;
            if (js.len + 1 > zbuf.len) return;
            @memcpy(zbuf[0..js.len], js);
            zbuf[js.len] = 0;
            c.vela_gtk_eval_js(app, &zbuf);
        }
        if (ctx.state.last_material) |mat| {
            if (mat.degraded) {
                if (mat.reason) |reason| {
                    std.log.warn("material degraded effective={s} reason={s}", .{ mat.effective, reason });
                }
            }
        }
    }
}

fn printUsage() void {
    std.debug.print(
        \\vela-linux-shell {s}
        \\
        \\Usage:
        \\  vela-linux-shell [--url URL] [--version] [--help] [--self-test]
        \\
        \\Options:
        \\  --url URL     Navigate main WebView (default: http://127.0.0.1:5173)
        \\  --version     Print version and exit
        \\  --self-test   Run resolveHit fixtures (no GUI) and exit
        \\  --help        Show this help
        \\
        \\Dogfood:
        \\  bun run playground:serve   # other terminal
        \\  zig build run -- --url http://127.0.0.1:5173
        \\
        \\Deps: GTK4 + webkitgtk-6.0 (pkg-config). See README.md.
        \\
    , .{version});
}

fn runSelfTest() !void {
    var tree: layers.LayerTree = .{};
    try layers.bootstrapDogfood(&tree, .{ .x = 0, .y = 0, .width = 800, .height = 600 });

    const toolbar = hit.resolveHit(.normal, &tree, .{ .x = 400, .y = 30 });
    if (toolbar.kind != .material) return error.SelfTestToolbar;
    if (!std.mem.eql(u8, toolbar.layer_id, layers.dogfood.toolbar_material)) return error.SelfTestToolbarId;

    const hole = hit.resolveHit(.normal, &tree, .{ .x = 400, .y = 300 });
    if (hole.kind != .native) return error.SelfTestHole;
    if (!std.mem.eql(u8, hole.layer_id, layers.dogfood.underlay)) return error.SelfTestHoleId;

    var region: geometry.Region = .{};
    try region.append(.{ .rect = .{ .x = 100, .y = 100, .width = 200, .height = 200 } });
    try tree.applyWebShape(layers.dogfood.main_webview, region, 1);
    const web = hit.resolveHit(.normal, &tree, .{ .x = 150, .y = 150 });
    if (web.kind != .webview) return error.SelfTestWeb;

    tree.applyWebShape(layers.dogfood.main_webview, region, 0) catch |err| {
        if (err != error.Stale) return err;
    };

    const paint = materials.paintPlanGtkBlur();
    if (!paint.degraded) return error.SelfTestMaterialHonesty;

    std.debug.print("self-test ok (hit + generation + gtk.blur degrade)\n", .{});
}

pub fn main(init: std.process.Init) !void {
    const gpa = init.gpa;

    var it = try init.minimal.args.iterateAllocator(gpa);
    defer it.deinit();
    _ = it.skip(); // argv0

    var url: []const u8 = "http://127.0.0.1:5173";
    while (it.next()) |arg| {
        if (std.mem.eql(u8, arg, "--help") or std.mem.eql(u8, arg, "-h")) {
            printUsage();
            return;
        }
        if (std.mem.eql(u8, arg, "--version") or std.mem.eql(u8, arg, "-V")) {
            std.debug.print("{s}\n", .{version});
            return;
        }
        if (std.mem.eql(u8, arg, "--self-test")) {
            try runSelfTest();
            return;
        }
        if (std.mem.eql(u8, arg, "--url")) {
            url = it.next() orelse {
                std.debug.print("--url requires a value\n", .{});
                std.process.exit(2);
            };
            continue;
        }
        std.debug.print("unknown arg: {s}\n", .{arg});
        printUsage();
        std.process.exit(2);
    }

    const preload: []const u8 = @embedFile("preload.js");

    var ctx = AppCtx{
        .state = bridge.ShellState.init(gpa),
    };
    try layers.bootstrapDogfood(&ctx.state.tree, .{ .x = 0, .y = 0, .width = 960, .height = 640 });

    const mat = materials.resolveMaterialLinux("apple.liquidGlass");
    const paint = materials.paintPlanGtkBlur();
    ctx.state.last_material = paint;
    std.log.info("material policy requested={s} effective={s} paint_reason={s}", .{
        mat.requested,
        mat.effective,
        paint.reason orelse "",
    });

    const url_z = try gpa.dupeZ(u8, url);
    defer gpa.free(url_z);
    const preload_z = try gpa.dupeZ(u8, preload);
    defer gpa.free(preload_z);

    var config = c.VelaGtkConfig{
        .argc = 0,
        .argv = null,
        .title = "Vela Linux Shell",
        .width = 960,
        .height = 640,
        .preload_js = preload_z.ptr,
        .initial_url = url_z.ptr,
        .on_pointer_down = onPointerDown,
        .on_pointer_down_userdata = &ctx,
        .on_bridge_message = onBridgeMessage,
        .on_bridge_message_userdata = &ctx,
    };

    const app = c.vela_gtk_app_create(&config);
    if (app == null) {
        std.log.err("failed to create GTK app", .{});
        std.process.exit(1);
    }
    ctx.gtk = app;

    c.vela_gtk_set_material_visible(app, 1);
    {
        var rect = c.VelaGtkRect{ .x = 16, .y = 12, .width = 928, .height = 52 };
        c.vela_gtk_set_material_bounds(app, &rect);
    }
    c.vela_gtk_set_debug_hit_label(app, "lastHit: (waiting for click)");

    std.log.info("loading {s}", .{url});
    c.vela_gtk_app_run(app);
    c.vela_gtk_app_destroy(app);
}

test {
    _ = geometry;
    _ = layers;
    _ = hit;
    _ = materials;
}
