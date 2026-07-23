/**
 * Thin GObject/GTK4/WebKitGTK surface for hosts/linux-shell.
 * Zig owns policy; this file owns toolkit plumbing only.
 */
#ifndef VELA_GTK_H
#define VELA_GTK_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct VelaGtkApp VelaGtkApp;

typedef struct VelaGtkRect {
    double x;
    double y;
    double width;
    double height;
} VelaGtkRect;

/** Pointer-down callback: logical content coords (origin top-left, y down). */
typedef void (*VelaGtkPointerDownFn)(void *userdata, double x, double y);

/** JSON text from window.webkit.messageHandlers.vela.postMessage. */
typedef void (*VelaGtkBridgeMessageFn)(void *userdata, const char *json, size_t json_len);

typedef struct VelaGtkConfig {
    int argc;
    char **argv;
    const char *title;
    int width;
    int height;
    const char *preload_js; /* full user script source; may be NULL */
    const char *initial_url; /* may be NULL → about:blank */
    VelaGtkPointerDownFn on_pointer_down;
    void *on_pointer_down_userdata;
    VelaGtkBridgeMessageFn on_bridge_message;
    void *on_bridge_message_userdata;
} VelaGtkConfig;

/** Create app state (does not enter main loop). Returns NULL on failure. */
VelaGtkApp *vela_gtk_app_create(const VelaGtkConfig *config);

/** Run GTK main loop (blocking until window closed). */
void vela_gtk_app_run(VelaGtkApp *app);

void vela_gtk_app_destroy(VelaGtkApp *app);

/** Navigate main WebView. */
void vela_gtk_load_uri(VelaGtkApp *app, const char *uri);

/** Resize / place material host in logical content coords (top-left origin). */
void vela_gtk_set_material_bounds(VelaGtkApp *app, const VelaGtkRect *bounds);

/** Show/hide material host. */
void vela_gtk_set_material_visible(VelaGtkApp *app, int visible);

/**
 * Stack material relative to the WebView.
 * above_web=1: chrome/toolbar on top (playground).
 * above_web=0: card glass under transparent WebView (clock).
 */
void vela_gtk_set_material_above_web(VelaGtkApp *app, int above_web);

/** Corner radius in px; use a large value (e.g. 999) for capsule/pill. */
void vela_gtk_set_material_radius(VelaGtkApp *app, double radius_px);

/** Opacity 0..1 for material host (visual only; hit policy stays separate). */
void vela_gtk_set_material_opacity(VelaGtkApp *app, double opacity);

/** Underlay fill as RGB 0..1. */
void vela_gtk_set_underlay_color(VelaGtkApp *app, double r, double g, double b);

/**
 * After resolveHit: which sibling may receive the next pointer sequence.
 * kind: 0=none/bg, 1=underlay, 2=webview, 3=material, 4=chrome
 */
void vela_gtk_set_hit_route(VelaGtkApp *app, int32_t kind);

/** Push debug label (last HitTarget). */
void vela_gtk_set_debug_hit_label(VelaGtkApp *app, const char *text);

/** Evaluate JS in page (fire-and-forget). */
void vela_gtk_eval_js(VelaGtkApp *app, const char *script);

/** Content size in logical pixels (allocation). */
void vela_gtk_get_content_size(VelaGtkApp *app, double *out_w, double *out_h);

#ifdef __cplusplus
}
#endif

#endif /* VELA_GTK_H */
