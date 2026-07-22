//! Zig mirror of include/vela_shell_abi.h (host-private C ABI).

pub const Status = enum(i32) {
    ok = 0,
    invalid = 1,
    not_found = 2,
    unsupported = 3,
    internal = 4,
    capacity = 5,

    pub fn fromInt(v: i32) Status {
        return @enumFromInt(v);
    }

    pub fn toInt(self: Status) i32 {
        return @intFromEnum(self);
    }
};

pub const Rect = extern struct {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
};

pub const InputMode = enum(i32) {
    normal = 0,
    region_through = 1,
    full_through = 2,
};

pub const WindowState = extern struct {
    bounds: Rect,
    scale_factor: f64,
    input_mode: InputMode,
    visible: i32,
    focused: i32,
};

pub const WindowId = u64;
pub const WebViewId = u64;

pub const LayerRef = extern struct {
    id: [*]const u8,
    id_len: usize,
    z_index: i32,
};

pub const Point = extern struct {
    x: f64,
    y: f64,
};

pub const HitTarget = extern struct {
    layer_id: [*]const u8,
    layer_id_len: usize,
    kind: i32,
};

pub const MaterialResult = extern struct {
    degraded: i32,
    resolved_id: [*]const u8,
    resolved_id_len: usize,
    reason: ?[*]const u8,
    reason_len: usize,
};

pub const EventFn = *const fn (
    userdata: ?*anyopaque,
    channel: [*]const u8,
    channel_len: usize,
    payload_json: [*]const u8,
    payload_json_len: usize,
) callconv(.c) void;
