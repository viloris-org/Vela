//! Process entry for zig-shell skeleton (no UDS listen yet).
//! Zig 0.16: main takes `std.process.Init` for gpa / args.

const std = @import("std");
const shell = @import("vela_shell");

pub fn main(init: std.process.Init) !void {
    const gpa = init.gpa;

    var it = try init.minimal.args.iterateAllocator(gpa);
    defer it.deinit();
    _ = it.skip(); // argv0

    var want_version = false;
    var want_self_test = false;
    var want_help = false;

    while (it.next()) |arg| {
        if (std.mem.eql(u8, arg, "--version") or std.mem.eql(u8, arg, "-V")) {
            want_version = true;
        } else if (std.mem.eql(u8, arg, "--self-test")) {
            want_self_test = true;
        } else if (std.mem.eql(u8, arg, "--help") or std.mem.eql(u8, arg, "-h")) {
            want_help = true;
        } else {
            std.debug.print("unknown argument: {s}\n", .{arg});
            printUsage();
            std.process.exit(2);
        }
    }

    if (want_help) {
        printUsage();
        return;
    }
    if (want_version) {
        std.debug.print("vela-shell {s}\n", .{shell.version});
        return;
    }
    if (want_self_test) {
        try runSelfTest(gpa);
        std.debug.print("self-test ok\n", .{});
        return;
    }

    // Default: print help (skeleton has no RPC listen yet).
    printUsage();
}

fn printUsage() void {
    std.debug.print(
        \\vela-shell — Vela Zig interop (L2.5) skeleton
        \\
        \\Usage:
        \\  vela-shell --version
        \\  vela-shell --self-test
        \\  vela-shell --help
        \\
        \\No UDS/listen in this build. See hosts/zig-shell/README.md.
        \\
    , .{});
}

fn runSelfTest(gpa: std.mem.Allocator) !void {
    var mock = shell.backend.mock.MockBackend.initEmpty();
    var vt = mock.createVTable();
    _ = vt.callInit();
    defer vt.callShutdown();

    const d = shell.rpc.dispatch.Dispatcher{ .backend = &vt };
    const req = shell.rpc.envelope.Request{
        .id = "self",
        .channel = .shell,
        .method = "ping",
    };
    const out = try d.handle(gpa, req);
    defer gpa.free(out);
    if (std.mem.indexOf(u8, out, "\"pong\":true") == null) {
        return error.SelfTestFailed;
    }

    const frame = try shell.rpc.codec.encodeFrame(gpa, out);
    defer gpa.free(frame);
    const decoded = try shell.rpc.codec.decodeFrame(frame);
    if (!std.mem.eql(u8, decoded.body, out)) return error.SelfTestFailed;
}
