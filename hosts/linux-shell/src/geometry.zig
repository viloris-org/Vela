//! Geometry helpers — logical content coords (origin top-left, y down).
//! Keep behavior aligned with packages/api/src/geometry.ts.

const std = @import("std");

pub const Point = struct { x: f64, y: f64 };
pub const Rect = struct { x: f64, y: f64, width: f64, height: f64 };

pub const RegionPrimitive = union(enum) {
    rect: Rect,
    rounded_rect: struct { rect: Rect, radius: f64 },
    capsule: Rect,
    circle: struct { center: Point, radius: f64 },
};

pub const max_primitives = 32;

pub const Region = struct {
    primitives: [max_primitives]RegionPrimitive = undefined,
    len: usize = 0,

    pub fn clear(self: *Region) void {
        self.len = 0;
    }

    pub fn append(self: *Region, p: RegionPrimitive) !void {
        if (self.len >= max_primitives) return error.Capacity;
        self.primitives[self.len] = p;
        self.len += 1;
    }
};

pub fn rectContains(rect: Rect, point: Point) bool {
    return point.x >= rect.x and
        point.y >= rect.y and
        point.x < rect.x + rect.width and
        point.y < rect.y + rect.height;
}

fn pointInCircle(center: Point, radius: f64, point: Point) bool {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return dx * dx + dy * dy <= radius * radius;
}

fn pointInCapsule(rect: Rect, point: Point) bool {
    if (rect.width <= 0 or rect.height <= 0) return false;
    if (rect.width >= rect.height) {
        const r = rect.height / 2.0;
        const body_left = rect.x + r;
        const body_right = rect.x + rect.width - r;
        const cy = rect.y + r;
        if (point.y < rect.y or point.y > rect.y + rect.height) return false;
        if (point.x >= body_left and point.x <= body_right) return true;
        if (point.x < body_left) return pointInCircle(.{ .x = body_left, .y = cy }, r, point);
        return pointInCircle(.{ .x = body_right, .y = cy }, r, point);
    }
    const r = rect.width / 2.0;
    const body_top = rect.y + r;
    const body_bottom = rect.y + rect.height - r;
    const cx = rect.x + r;
    if (point.x < rect.x or point.x > rect.x + rect.width) return false;
    if (point.y >= body_top and point.y <= body_bottom) return true;
    if (point.y < body_top) return pointInCircle(.{ .x = cx, .y = body_top }, r, point);
    return pointInCircle(.{ .x = cx, .y = body_bottom }, r, point);
}

fn pointInRoundedRect(rect: Rect, radius: f64, point: Point) bool {
    if (!rectContains(rect, point)) return false;
    const max_r = @min(rect.width, rect.height) / 2.0;
    const rr = @min(@max(0.0, radius), max_r);
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;
    if (point.x < left + rr and point.y < top + rr)
        return pointInCircle(.{ .x = left + rr, .y = top + rr }, rr, point);
    if (point.x >= right - rr and point.y < top + rr)
        return pointInCircle(.{ .x = right - rr, .y = top + rr }, rr, point);
    if (point.x >= right - rr and point.y >= bottom - rr)
        return pointInCircle(.{ .x = right - rr, .y = bottom - rr }, rr, point);
    if (point.x < left + rr and point.y >= bottom - rr)
        return pointInCircle(.{ .x = left + rr, .y = bottom - rr }, rr, point);
    return true;
}

pub fn regionPrimitiveContains(p: RegionPrimitive, point: Point) bool {
    return switch (p) {
        RegionPrimitive.rect => |r| rectContains(r, point),
        RegionPrimitive.rounded_rect => |rr| pointInRoundedRect(rr.rect, rr.radius, point),
        RegionPrimitive.capsule => |r| pointInCapsule(r, point),
        RegionPrimitive.circle => |c| pointInCircle(c.center, c.radius, point),
    };
}

pub fn regionContains(region: Region, point: Point) bool {
    var i: usize = 0;
    while (i < region.len) : (i += 1) {
        if (regionPrimitiveContains(region.primitives[i], point)) return true;
    }
    return false;
}

test "rectContains" {
    const r = Rect{ .x = 0, .y = 0, .width = 10, .height = 10 };
    try std.testing.expect(rectContains(r, .{ .x = 0, .y = 0 }));
    try std.testing.expect(!rectContains(r, .{ .x = 10, .y = 0 }));
}

test "capsule horizontal" {
    const r = Rect{ .x = 0, .y = 0, .width = 100, .height = 40 };
    try std.testing.expect(pointInCapsule(r, .{ .x = 50, .y = 20 }));
    try std.testing.expect(!pointInCapsule(r, .{ .x = 50, .y = 50 }));
}
