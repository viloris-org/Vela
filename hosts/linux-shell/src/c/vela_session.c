#include "vela_session.h"

#include <gtk/gtk.h>
#include <gdk/gdk.h>
#include <string.h>

/* Optional Wayland/X11 backends — compile soft when headers exist. */
#if defined(GDK_WINDOWING_WAYLAND)
#include <gdk/wayland/gdkwayland.h>
#endif
#if defined(GDK_WINDOWING_X11)
#include <gdk/x11/gdkx.h>
#endif

/*
 * Globals we care about for Vela Shell jobs (materials, scale, input, session).
 * Keep in sync with session.zig probed_wayland_globals.
 */
static const char *const k_known_globals[] = {
    "wl_compositor",
    "ext_background_effect_manager_v1",
    "org_kde_kwin_blur_manager",
    "wp_fractional_scale_manager_v1",
    "wp_viewporter",
    "wp_alpha_modifier_v1",
    "zwp_idle_inhibit_manager_v1",
    "xdg_activation_v1",
    "zxdg_decoration_manager_v1",
};

const char *vela_session_backend_name(int backend)
{
    switch (backend) {
    case VELA_DISPLAY_WAYLAND:
        return "wayland";
    case VELA_DISPLAY_X11:
        return "x11";
    default:
        return "unknown";
    }
}

int vela_session_probe(
    const char **globals_out,
    size_t max_globals,
    size_t *out_count)
{
    GdkDisplay *display;
    size_t count = 0;
    int backend = VELA_DISPLAY_UNKNOWN;

    if (out_count) {
        *out_count = 0;
    }

    /* GtkApplication normally opens the display on run; probe may run earlier. */
    if (!gtk_is_initialized()) {
        gtk_init();
    }

    display = gdk_display_get_default();
    if (display == NULL) {
        display = gdk_display_open(NULL);
    }
    if (display == NULL) {
        return VELA_DISPLAY_UNKNOWN;
    }

#if defined(GDK_WINDOWING_WAYLAND)
    if (GDK_IS_WAYLAND_DISPLAY(display)) {
        backend = VELA_DISPLAY_WAYLAND;
        size_t i;
        for (i = 0; i < G_N_ELEMENTS(k_known_globals); i++) {
            if (gdk_wayland_display_query_registry(display, k_known_globals[i])) {
                if (globals_out != NULL && count < max_globals) {
                    globals_out[count] = k_known_globals[i];
                    count++;
                }
            }
        }
        if (out_count) {
            *out_count = count;
        }
        return backend;
    }
#endif

#if defined(GDK_WINDOWING_X11)
    if (GDK_IS_X11_DISPLAY(display)) {
        backend = VELA_DISPLAY_X11;
        /* X11 has no Wayland globals; features come from other probes later. */
        if (out_count) {
            *out_count = 0;
        }
        return backend;
    }
#endif

    /* Fallback: inspect backend name string (works when type macros unavailable). */
    {
        const char *name = G_OBJECT_TYPE_NAME(display);
        if (name != NULL) {
            if (strstr(name, "Wayland") != NULL || strstr(name, "wayland") != NULL) {
                backend = VELA_DISPLAY_WAYLAND;
            } else if (strstr(name, "X11") != NULL || strstr(name, "X11Display") != NULL) {
                backend = VELA_DISPLAY_X11;
            }
        }
    }

    if (out_count) {
        *out_count = count;
    }
    return backend;
}
