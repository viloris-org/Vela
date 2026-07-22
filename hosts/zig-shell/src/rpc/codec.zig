//! Wire framing: u32 little-endian length prefix + UTF-8 JSON body.
//! Payload shapes are defined by @vela/api; framing is host implementation detail (ADR 0002).

const std = @import("std");
const envelope = @import("envelope.zig");

pub const max_frame_body: u32 = 16 * 1024 * 1024;

pub const FrameError = error{
    Truncated,
    BodyTooLarge,
    OutOfMemory,
};

/// Encode body into length-prefixed frame. Caller owns returned slice.
pub fn encodeFrame(allocator: std.mem.Allocator, body: []const u8) FrameError![]u8 {
    if (body.len > max_frame_body) return error.BodyTooLarge;
    const len: u32 = @intCast(body.len);
    var out = try allocator.alloc(u8, 4 + body.len);
    std.mem.writeInt(u32, out[0..4], len, .little);
    @memcpy(out[4..], body);
    return out;
}

/// Decode one frame from `buf`. Returns body slice into `buf` (not owned).
pub fn decodeFrame(buf: []const u8) FrameError!struct { body: []const u8, consumed: usize } {
    if (buf.len < 4) return error.Truncated;
    const len = std.mem.readInt(u32, buf[0..4], .little);
    if (len > max_frame_body) return error.BodyTooLarge;
    if (buf.len < 4 + len) return error.Truncated;
    return .{
        .body = buf[4 .. 4 + len],
        .consumed = 4 + len,
    };
}

/// Round-trip helper used by tests and self-test: JSON request → response JSON → frame.
pub fn roundTripRequestJson(
    allocator: std.mem.Allocator,
    request_json: []const u8,
    respond: *const fn (allocator: std.mem.Allocator, req: envelope.Request) anyerror![]u8,
) ![]u8 {
    var parsed = try envelope.parseRequest(allocator, request_json);
    defer {
        if (parsed.request.args_json) |a| allocator.free(a);
        parsed.parsed.deinit();
    }
    return try respond(allocator, parsed.request);
}

test "frame encode decode roundtrip" {
    const body = "{\"id\":\"1\",\"ok\":true}";
    const frame = try encodeFrame(std.testing.allocator, body);
    defer std.testing.allocator.free(frame);
    try std.testing.expectEqual(@as(usize, 4 + body.len), frame.len);
    const decoded = try decodeFrame(frame);
    try std.testing.expectEqualStrings(body, decoded.body);
    try std.testing.expectEqual(frame.len, decoded.consumed);
}

test "frame truncated" {
    const r = decodeFrame(&[_]u8{ 1, 0, 0 });
    try std.testing.expectError(error.Truncated, r);
}
