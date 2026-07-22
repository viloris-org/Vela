//! RPC envelope types aligned with packages/api/src/protocol/rpc.ts (ADR 0002 D5).

const std = @import("std");
const err = @import("../util/err.zig");

pub const Channel = enum {
    call,
    layers,
    hit,
    window,
    shell,

    pub fn fromString(s: []const u8) ?Channel {
        inline for (std.meta.fields(Channel)) |f| {
            if (std.mem.eql(u8, s, f.name)) return @field(Channel, f.name);
        }
        return null;
    }

    pub fn toString(self: Channel) []const u8 {
        return @tagName(self);
    }
};

pub const Request = struct {
    id: []const u8,
    channel: Channel,
    method: []const u8,
    /// Raw JSON text of the `args` value when present; empty if omitted.
    args_json: ?[]const u8 = null,
};

pub const ResponseError = struct {
    code: []const u8,
    message: []const u8,
};

pub const Response = struct {
    id: []const u8,
    ok: bool,
    /// JSON text for `result` when ok; ignored when not ok.
    result_json: ?[]const u8 = null,
    error_code: ?[]const u8 = null,
    error_message: ?[]const u8 = null,

    pub fn okResult(id: []const u8, result_json: ?[]const u8) Response {
        return .{
            .id = id,
            .ok = true,
            .result_json = result_json,
        };
    }

    pub fn fail(id: []const u8, code: err.RpcErrorCode, message: []const u8) Response {
        return .{
            .id = id,
            .ok = false,
            .error_code = code.toString(),
            .error_message = message,
        };
    }
};

pub const ParseError = error{
    InvalidJson,
    MissingField,
    InvalidChannel,
    OutOfMemory,
};

/// Parse a JSON object request. Caller owns nothing; slices point into `parsed` arena.
pub fn parseRequest(allocator: std.mem.Allocator, json_text: []const u8) ParseError!struct {
    parsed: std.json.Parsed(std.json.Value),
    request: Request,
} {
    const parsed = std.json.parseFromSlice(std.json.Value, allocator, json_text, .{}) catch return error.InvalidJson;
    errdefer parsed.deinit();

    if (parsed.value != .object) return error.InvalidJson;
    const obj = parsed.value.object;

    const id_val = obj.get("id") orelse return error.MissingField;
    const channel_val = obj.get("channel") orelse return error.MissingField;
    const method_val = obj.get("method") orelse return error.MissingField;

    if (id_val != .string) return error.InvalidJson;
    if (channel_val != .string) return error.InvalidJson;
    if (method_val != .string) return error.InvalidJson;

    const channel = Channel.fromString(channel_val.string) orelse return error.InvalidChannel;

    var args_json: ?[]const u8 = null;
    if (obj.get("args")) |args_val| {
        // Re-stringify args for handlers that need structured JSON later.
        args_json = std.json.Stringify.valueAlloc(allocator, args_val, .{}) catch return error.OutOfMemory;
    }

    return .{
        .parsed = parsed,
        .request = .{
            .id = id_val.string,
            .channel = channel,
            .method = method_val.string,
            .args_json = args_json,
        },
    };
}

/// Response builder: result as typed anonymous struct via Stringify.valueAlloc.
pub fn stringifyOk(allocator: std.mem.Allocator, id: []const u8, result: anytype) error{OutOfMemory}![]u8 {
    const ResultEnvelope = struct {
        id: []const u8,
        ok: bool = true,
        result: @TypeOf(result),
    };
    return std.json.Stringify.valueAlloc(allocator, ResultEnvelope{
        .id = id,
        .result = result,
    }, .{}) catch return error.OutOfMemory;
}

pub fn stringifyOkEmpty(allocator: std.mem.Allocator, id: []const u8) error{OutOfMemory}![]u8 {
    const Envelope = struct {
        id: []const u8,
        ok: bool = true,
    };
    return std.json.Stringify.valueAlloc(allocator, Envelope{ .id = id }, .{}) catch return error.OutOfMemory;
}

pub fn stringifyErr(
    allocator: std.mem.Allocator,
    id: []const u8,
    code: err.RpcErrorCode,
    message: []const u8,
) error{OutOfMemory}![]u8 {
    const Envelope = struct {
        id: []const u8,
        ok: bool = false,
        @"error": struct {
            code: []const u8,
            message: []const u8,
        },
    };
    return std.json.Stringify.valueAlloc(allocator, Envelope{
        .id = id,
        .@"error" = .{
            .code = code.toString(),
            .message = message,
        },
    }, .{}) catch return error.OutOfMemory;
}

test "parse request shell.ping" {
    const src =
        \\{"id":"1","channel":"shell","method":"ping"}
    ;
    var parsed = try parseRequest(std.testing.allocator, src);
    defer {
        if (parsed.request.args_json) |a| std.testing.allocator.free(a);
        parsed.parsed.deinit();
    }
    try std.testing.expectEqualStrings("1", parsed.request.id);
    try std.testing.expect(parsed.request.channel == .shell);
    try std.testing.expectEqualStrings("ping", parsed.request.method);
    try std.testing.expect(parsed.request.args_json == null);
}

test "stringify err matches rpc error codes" {
    const bytes = try stringifyErr(std.testing.allocator, "x", .unsupported_platform, "nope");
    defer std.testing.allocator.free(bytes);
    try std.testing.expect(std.mem.indexOf(u8, bytes, "unsupported.platform") != null);
    try std.testing.expect(std.mem.indexOf(u8, bytes, "\"ok\":false") != null);
}

test "stringify ok result" {
    const bytes = try stringifyOk(std.testing.allocator, "1", .{ .pong = true, .backend = "mock" });
    defer std.testing.allocator.free(bytes);
    try std.testing.expect(std.mem.indexOf(u8, bytes, "\"pong\":true") != null);
    try std.testing.expect(std.mem.indexOf(u8, bytes, "\"ok\":true") != null);
}
