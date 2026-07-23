const std = @import("std");

/// Fedora/system include paths from `pkg-config --cflags gtk4 webkitgtk-6.0`.
/// Re-run pkg-config and update if distro layout differs.
const gtk_c_includes = [_][]const u8{
    "/usr/include/webkitgtk-6.0",
    "/usr/include/gtk-4.0",
    "/usr/include/pango-1.0",
    "/usr/include/fribidi",
    "/usr/include/harfbuzz",
    "/usr/include/gdk-pixbuf-2.0",
    "/usr/include/glycin-2",
    "/usr/include/cairo",
    "/usr/include/libxml2",
    "/usr/include/freetype2",
    "/usr/include/libpng16",
    "/usr/include/pixman-1",
    "/usr/include/graphene-1.0",
    "/usr/lib64/graphene-1.0/include",
    "/usr/include/libsoup-3.0",
    "/usr/include/libmount",
    "/usr/include/blkid",
    "/usr/include/glib-2.0",
    "/usr/lib64/glib-2.0/include",
    "/usr/include/sysprof-6",
};

const gtk_cflags = [_][]const u8{
    "-std=c11",
    "-pthread",
    "-DWITH_GZFILEOP",
};

const gtk_libs = [_][]const u8{
    "webkitgtk-6.0",
    "gtk-4",
    "pangocairo-1.0",
    "pango-1.0",
    "gdk_pixbuf-2.0",
    "cairo-gobject",
    "cairo",
    "harfbuzz",
    "vulkan",
    "graphene-1.0",
    "soup-3.0",
    "gio-2.0",
    "gmodule-2.0",
    "javascriptcoregtk-6.0",
    "gobject-2.0",
    "glib-2.0",
};

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .link_libc = true,
    });
    exe_mod.addIncludePath(b.path("src/c"));
    for (gtk_c_includes) |inc| {
        exe_mod.addIncludePath(.{ .cwd_relative = inc });
    }

    var c_flags_list: std.ArrayList([]const u8) = .empty;
    for (gtk_cflags) |f| {
        c_flags_list.append(b.allocator, f) catch @panic("OOM");
    }
    for (gtk_c_includes) |inc| {
        const flag = std.fmt.allocPrint(b.allocator, "-I{s}", .{inc}) catch @panic("OOM");
        c_flags_list.append(b.allocator, flag) catch @panic("OOM");
    }

    exe_mod.addCSourceFile(.{
        .file = b.path("src/c/vela_gtk.c"),
        .flags = c_flags_list.items,
    });
    exe_mod.addCSourceFile(.{
        .file = b.path("src/c/vela_session.c"),
        .flags = c_flags_list.items,
    });

    for (gtk_libs) |lib| {
        exe_mod.linkSystemLibrary(lib, .{});
    }

    const exe = b.addExecutable(.{
        .name = "vela-linux-shell",
        .root_module = exe_mod,
    });
    b.installArtifact(exe);

    const install_preload = b.addInstallFile(
        b.path("scripts/preload.js"),
        "share/vela-linux-shell/preload.js",
    );
    b.getInstallStep().dependOn(&install_preload.step);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    run_cmd.setCwd(b.path("."));
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    const run_step = b.step("run", "Run vela-linux-shell");
    run_step.dependOn(&run_cmd.step);

    const pure_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/hit.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const run_pure = b.addRunArtifact(pure_tests);

    const session_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/session.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const run_session = b.addRunArtifact(session_tests);

    const materials_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/materials.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const run_materials = b.addRunArtifact(materials_tests);

    const test_step = b.step("test", "Run pure hit/session/material unit tests");
    test_step.dependOn(&run_pure.step);
    test_step.dependOn(&run_session.step);
    test_step.dependOn(&run_materials.step);
}
