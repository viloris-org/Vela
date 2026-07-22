//! Library root for vela_shell (Zig interop L2.5). Re-exports only.

pub const version = @import("rpc/dispatch.zig").version_string;

pub const abi = struct {
    pub const types = @import("abi/types.zig");
    pub const vtable = @import("abi/vtable.zig");
};

pub const backend = struct {
    pub const mock = @import("backend/mock.zig");
};

pub const rpc = struct {
    pub const envelope = @import("rpc/envelope.zig");
    pub const codec = @import("rpc/codec.zig");
    pub const dispatch = @import("rpc/dispatch.zig");
};

pub const util = struct {
    pub const err = @import("util/err.zig");
};

// Pull unit tests from modules into `zig build test`.
test {
    _ = @import("abi/types.zig");
    _ = @import("abi/vtable.zig");
    _ = @import("backend/mock.zig");
    _ = @import("rpc/envelope.zig");
    _ = @import("rpc/codec.zig");
    _ = @import("rpc/dispatch.zig");
    _ = @import("util/err.zig");
}
