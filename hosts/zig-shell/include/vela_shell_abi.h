/**
 * Vela Shell C ABI — host-private wire from Zig interop (L2.5) to L4 backends.
 *
 * Not a public app SDK. App-facing contracts remain @vela/api / window.vela.
 * See docs/adr/0005-zig-interop-layer.md.
 *
 * Coordinates: logical content space (origin top-left, y down) unless noted.
 */

#ifndef VELA_SHELL_ABI_H
#define VELA_SHELL_ABI_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ---- Status codes ------------------------------------------------------- */

typedef int32_t vela_shell_status;

enum {
    VELA_SHELL_OK = 0,
    VELA_SHELL_ERR_INVALID = 1,
    VELA_SHELL_ERR_NOT_FOUND = 2,
    VELA_SHELL_ERR_UNSUPPORTED = 3,
    VELA_SHELL_ERR_INTERNAL = 4,
    VELA_SHELL_ERR_CAPACITY = 5,
};

/* ---- Geometry / window -------------------------------------------------- */

typedef struct vela_shell_rect {
    double x;
    double y;
    double width;
    double height;
} vela_shell_rect;

/** Matches @vela/api WindowInputMode string values. */
typedef enum vela_shell_input_mode {
    VELA_SHELL_INPUT_NORMAL = 0,
    VELA_SHELL_INPUT_REGION_THROUGH = 1,
    VELA_SHELL_INPUT_FULL_THROUGH = 2,
} vela_shell_input_mode;

typedef struct vela_shell_window_state {
    vela_shell_rect bounds;
    double scale_factor;
    vela_shell_input_mode input_mode;
    int32_t visible; /* 0/1 */
    int32_t focused; /* 0/1 */
} vela_shell_window_state;

typedef uint64_t vela_shell_window_id;
typedef uint64_t vela_shell_webview_id;

/* ---- Layer (minimal stub fields) ---------------------------------------- */

typedef struct vela_shell_layer_ref {
    const char *id; /* UTF-8, not owned after call returns unless documented */
    size_t id_len;
    int32_t z_index;
} vela_shell_layer_ref;

/* ---- Hit ---------------------------------------------------------------- */

typedef struct vela_shell_point {
    double x;
    double y;
} vela_shell_point;

typedef struct vela_shell_hit_target {
    const char *layer_id;
    size_t layer_id_len;
    int32_t kind; /* opaque to L2.5; L4/docs map to HitTarget */
} vela_shell_hit_target;

/* ---- Material resolve (degrade diagnostics) ----------------------------- */

typedef struct vela_shell_material_result {
    int32_t degraded; /* 0/1 */
    const char *resolved_id;
    size_t resolved_id_len;
    const char *reason; /* optional diagnostic; may be NULL */
    size_t reason_len;
} vela_shell_material_result;

/* ---- Events (L4 → Zig) -------------------------------------------------- */

typedef void (*vela_shell_event_fn)(
    void *userdata,
    const char *channel,
    size_t channel_len,
    const char *payload_json,
    size_t payload_json_len);

/* ---- Backend vtable ----------------------------------------------------- */

typedef struct vela_shell_backend_vtable {
    void *ctx;

    vela_shell_status (*init)(void *ctx);
    void (*shutdown)(void *ctx);
    /** NUL-terminated backend name (e.g. "mock"); valid until shutdown. */
    const char *(*name)(void *ctx);

    vela_shell_status (*window_create)(
        void *ctx,
        const vela_shell_rect *bounds,
        vela_shell_window_id *out_id);
    vela_shell_status (*window_show)(void *ctx, vela_shell_window_id id);
    vela_shell_status (*window_close)(void *ctx, vela_shell_window_id id);
    vela_shell_status (*window_get_state)(
        void *ctx,
        vela_shell_window_id id,
        vela_shell_window_state *out);
    vela_shell_status (*window_set_bounds)(
        void *ctx,
        vela_shell_window_id id,
        const vela_shell_rect *bounds);
    vela_shell_status (*window_set_input_mode)(
        void *ctx,
        vela_shell_window_id id,
        vela_shell_input_mode mode);

    vela_shell_status (*webview_create)(
        void *ctx,
        vela_shell_window_id window_id,
        vela_shell_webview_id *out_id);
    vela_shell_status (*webview_navigate)(
        void *ctx,
        vela_shell_webview_id id,
        const char *url,
        size_t url_len);
    vela_shell_status (*webview_inject_preload)(
        void *ctx,
        vela_shell_webview_id id,
        const char *script,
        size_t script_len);

    vela_shell_status (*layer_insert)(
        void *ctx,
        const vela_shell_layer_ref *layer);
    vela_shell_status (*layer_update)(
        void *ctx,
        const vela_shell_layer_ref *layer);
    vela_shell_status (*layer_remove)(
        void *ctx,
        const char *id,
        size_t id_len);
    vela_shell_status (*layer_list_count)(void *ctx, size_t *out_count);

    vela_shell_status (*hit_set_opaque_regions)(
        void *ctx,
        const char *layer_id,
        size_t layer_id_len,
        const vela_shell_rect *rects,
        size_t rect_count,
        uint64_t generation);
    vela_shell_status (*hit_resolve)(
        void *ctx,
        vela_shell_point point,
        vela_shell_hit_target *out);

    vela_shell_status (*material_resolve)(
        void *ctx,
        const char *material_id,
        size_t material_id_len,
        vela_shell_material_result *out);

    vela_shell_status (*events_set_callback)(
        void *ctx,
        vela_shell_event_fn fn,
        void *userdata);
} vela_shell_backend_vtable;

#ifdef __cplusplus
}
#endif

#endif /* VELA_SHELL_ABI_H */
