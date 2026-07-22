//! Internal status ↔ RPC error code strings (aligned with @vela/api protocol/rpc.ts).

const abi = @import("../abi/types.zig");

pub const RpcErrorCode = enum {
    capability_denied,
    schema_invalid,
    layer_not_found,
    unsupported_platform,
    generation_stale,
    internal,

    pub fn toString(self: RpcErrorCode) []const u8 {
        return switch (self) {
            .capability_denied => "capability.denied",
            .schema_invalid => "schema.invalid",
            .layer_not_found => "layer.not_found",
            .unsupported_platform => "unsupported.platform",
            .generation_stale => "generation.stale",
            .internal => "internal",
        };
    }
};

pub fn fromStatus(status: abi.Status) RpcErrorCode {
    return switch (status) {
        .ok => .internal, // should not map success
        .invalid => .schema_invalid,
        .not_found => .layer_not_found,
        .unsupported => .unsupported_platform,
        .internal, .capacity => .internal,
    };
}
