//! channel + method → mock/backend ops (skeleton surface).

const std = @import("std");
const envelope = @import("envelope.zig");
const err = @import("../util/err.zig");
const vtable_mod = @import("../abi/vtable.zig");
const types = @import("../abi/types.zig");

pub const version_string = "0.0.1";

pub const Dispatcher = struct {
    backend: *const vtable_mod.BackendVTable,

    pub fn handle(self: Dispatcher, allocator: std.mem.Allocator, req: envelope.Request) error{OutOfMemory}![]u8 {
        return switch (req.channel) {
            .shell => self.handleShell(allocator, req),
            .window => self.handleWindow(allocator, req),
            .call, .layers, .hit => envelope.stringifyErr(
                allocator,
                req.id,
                .unsupported_platform,
                "method not implemented in zig-shell skeleton",
            ),
        };
    }

    fn handleShell(self: Dispatcher, allocator: std.mem.Allocator, req: envelope.Request) error{OutOfMemory}![]u8 {
        if (std.mem.eql(u8, req.method, "ping")) {
            const backend_name = self.backend.callName();
            return envelope.stringifyOk(allocator, req.id, .{
                .pong = true,
                .backend = backend_name,
            });
        }
        if (std.mem.eql(u8, req.method, "version")) {
            return envelope.stringifyOk(allocator, req.id, .{
                .version = version_string,
            });
        }
        return envelope.stringifyErr(allocator, req.id, .unsupported_platform, "unknown shell method");
    }

    fn handleWindow(self: Dispatcher, allocator: std.mem.Allocator, req: envelope.Request) error{OutOfMemory}![]u8 {
        if (std.mem.eql(u8, req.method, "create")) {
            return self.windowCreate(allocator, req);
        }
        if (std.mem.eql(u8, req.method, "show")) {
            return self.windowShow(allocator, req);
        }
        if (std.mem.eql(u8, req.method, "getState")) {
            return self.windowGetState(allocator, req);
        }
        return envelope.stringifyErr(allocator, req.id, .unsupported_platform, "unknown window method");
    }

    fn windowCreate(self: Dispatcher, allocator: std.mem.Allocator, req: envelope.Request) error{OutOfMemory}![]u8 {
        const create = self.backend.window_create orelse
            return envelope.stringifyErr(allocator, req.id, .unsupported_platform, "window_create missing");

        var width: f64 = 800;
        var height: f64 = 600;
        var x: f64 = 0;
        var y: f64 = 0;
        if (req.args_json) |aj| {
            // Best-effort read of common fields; ignore parse failures → defaults.
            if (std.json.parseFromSlice(std.json.Value, allocator, aj, .{})) |parsed| {
                defer parsed.deinit();
                if (parsed.value == .object) {
                    if (jsonNumber(parsed.value.object.get("width"))) |n| width = n;
                    if (jsonNumber(parsed.value.object.get("height"))) |n| height = n;
                    if (jsonNumber(parsed.value.object.get("x"))) |n| x = n;
                    if (jsonNumber(parsed.value.object.get("y"))) |n| y = n;
                }
            } else |_| {}
        }

        const bounds = types.Rect{ .x = x, .y = y, .width = width, .height = height };
        var id: types.WindowId = 0;
        const status = types.Status.fromInt(create(self.backend.ctx, &bounds, &id));
        if (status != .ok) {
            return envelope.stringifyErr(allocator, req.id, err.fromStatus(status), "window create failed");
        }
        return envelope.stringifyOk(allocator, req.id, .{ .windowId = id });
    }

    fn windowShow(self: Dispatcher, allocator: std.mem.Allocator, req: envelope.Request) error{OutOfMemory}![]u8 {
        const show = self.backend.window_show orelse
            return envelope.stringifyErr(allocator, req.id, .unsupported_platform, "window_show missing");
        const id = parseWindowId(allocator, req.args_json) orelse
            return envelope.stringifyErr(allocator, req.id, .schema_invalid, "windowId required");
        const status = types.Status.fromInt(show(self.backend.ctx, id));
        if (status != .ok) {
            return envelope.stringifyErr(allocator, req.id, err.fromStatus(status), "window show failed");
        }
        return envelope.stringifyOkEmpty(allocator, req.id);
    }

    fn windowGetState(self: Dispatcher, allocator: std.mem.Allocator, req: envelope.Request) error{OutOfMemory}![]u8 {
        const get_state = self.backend.window_get_state orelse
            return envelope.stringifyErr(allocator, req.id, .unsupported_platform, "window_get_state missing");
        const id = parseWindowId(allocator, req.args_json) orelse
            return envelope.stringifyErr(allocator, req.id, .schema_invalid, "windowId required");
        var state: types.WindowState = undefined;
        const status = types.Status.fromInt(get_state(self.backend.ctx, id, &state));
        if (status != .ok) {
            return envelope.stringifyErr(allocator, req.id, err.fromStatus(status), "window getState failed");
        }
        return envelope.stringifyOk(allocator, req.id, .{
            .windowId = id,
            .bounds = .{
                .x = state.bounds.x,
                .y = state.bounds.y,
                .width = state.bounds.width,
                .height = state.bounds.height,
            },
            .scaleFactor = state.scale_factor,
            .visible = state.visible != 0,
            .focused = state.focused != 0,
            .inputMode = inputModeName(state.input_mode),
        });
    }
};

fn jsonNumber(v: ?std.json.Value) ?f64 {
    const val = v orelse return null;
    return switch (val) {
        .float => |f| f,
        .integer => |i| @floatFromInt(i),
        else => null,
    };
}

fn inputModeName(mode: types.InputMode) []const u8 {
    return switch (mode) {
        .normal => "normal",
        .region_through => "region-through",
        .full_through => "full-through",
    };
}

fn parseWindowId(allocator: std.mem.Allocator, args_json: ?[]const u8) ?types.WindowId {
    const aj = args_json orelse return null;
    const parsed = std.json.parseFromSlice(std.json.Value, allocator, aj, .{}) catch return null;
    defer parsed.deinit();
    if (parsed.value != .object) return null;
    const v = parsed.value.object.get("windowId") orelse return null;
    return switch (v) {
        .integer => |i| if (i >= 0) @intCast(i) else null,
        .float => |f| if (f >= 0) @intFromFloat(f) else null,
        else => null,
    };
}

test "dispatch shell.ping" {
    const mock_mod = @import("../backend/mock.zig");
    var mock = mock_mod.MockBackend.initEmpty();
    var vt = mock.createVTable();
    _ = vt.callInit();
    defer vt.callShutdown();

    const d = Dispatcher{ .backend = &vt };
    const req = envelope.Request{
        .id = "1",
        .channel = .shell,
        .method = "ping",
    };
    const out = try d.handle(std.testing.allocator, req);
    defer std.testing.allocator.free(out);
    try std.testing.expect(std.mem.indexOf(u8, out, "\"pong\":true") != null);
    try std.testing.expect(std.mem.indexOf(u8, out, "mock") != null);
}

test "dispatch window create getState" {
    const mock_mod = @import("../backend/mock.zig");
    var mock = mock_mod.MockBackend.initEmpty();
    var vt = mock.createVTable();
    _ = vt.callInit();
    defer vt.callShutdown();

    const d = Dispatcher{ .backend = &vt };
    const args = try std.testing.allocator.dupe(u8, "{\"width\":640,\"height\":480}");
    defer std.testing.allocator.free(args);
    const create_req = envelope.Request{
        .id = "c",
        .channel = .window,
        .method = "create",
        .args_json = args,
    };
    const created = try d.handle(std.testing.allocator, create_req);
    defer std.testing.allocator.free(created);
    try std.testing.expect(std.mem.indexOf(u8, created, "\"ok\":true") != null);
    try std.testing.expect(std.mem.indexOf(u8, created, "windowId") != null);

    const state_args = try std.testing.allocator.dupe(u8, "{\"windowId\":1}");
    defer std.testing.allocator.free(state_args);
    const state_req = envelope.Request{
        .id = "s",
        .channel = .window,
        .method = "getState",
        .args_json = state_args,
    };
    const state = try d.handle(std.testing.allocator, state_req);
    defer std.testing.allocator.free(state);
    try std.testing.expect(std.mem.indexOf(u8, state, "640") != null);
    try std.testing.expect(std.mem.indexOf(u8, state, "\"ok\":true") != null);
}

test "dispatch unknown method" {
    const mock_mod = @import("../backend/mock.zig");
    var mock = mock_mod.MockBackend.initEmpty();
    var vt = mock.createVTable();
    const d = Dispatcher{ .backend = &vt };
    const req = envelope.Request{
        .id = "u",
        .channel = .shell,
        .method = "nope",
    };
    const out = try d.handle(std.testing.allocator, req);
    defer std.testing.allocator.free(out);
    try std.testing.expect(std.mem.indexOf(u8, out, "unsupported.platform") != null);
}
