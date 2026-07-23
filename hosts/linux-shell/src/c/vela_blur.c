/**
 * Compositor blur apply for hosts/linux-shell.
 * Prefer ext_background_effect_manager_v1; fall back to org_kde_kwin_blur_manager.
 */

#include "vela_blur.h"

#include <gtk/gtk.h>
#include <gdk/gdk.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#if defined(GDK_WINDOWING_WAYLAND)
#include <gdk/wayland/gdkwayland.h>
#include <wayland-client.h>

#include "gen/ext-background-effect-v1-client-protocol.h"
#include "gen/kde-blur-client-protocol.h"
#endif

struct VelaBlurState {
    GtkWidget *window;
    int backend; /* 0 none, 1 ext, 2 kde, 3 x11, 4 unknown */
    int applied;
    int last_x;
    int last_y;
    int last_w;
    int last_h;
#if defined(GDK_WINDOWING_WAYLAND)
    struct wl_display *display;
    struct wl_compositor *compositor;
    struct wl_registry *registry;
    struct ext_background_effect_manager_v1 *ext_mgr;
    struct org_kde_kwin_blur_manager *kde_mgr;
    struct wl_surface *surface;
    struct ext_background_effect_surface_v1 *ext_effect;
    struct org_kde_kwin_blur *kde_blur;
    uint32_t ext_caps;
    int ext_has_blur_cap; /* -1 unknown, 0 no, 1 yes */
#endif
};

const char *vela_blur_backend_name(const VelaBlurState *state)
{
    if (state == NULL) {
        return "none";
    }
    switch (state->backend) {
    case 1:
        return "ext-background-effect";
    case 2:
        return "kde-blur";
    case 3:
        return "x11";
    case 4:
        return "unknown";
    default:
        return "none";
    }
}

int vela_blur_has_manager(const VelaBlurState *state)
{
    return state != NULL && (state->backend == 1 || state->backend == 2);
}

int vela_blur_is_applied(const VelaBlurState *state)
{
    return state != NULL && state->applied;
}

VelaBlurState *vela_blur_create(void)
{
    return g_new0(VelaBlurState, 1);
}

void vela_blur_destroy(VelaBlurState *state)
{
    if (state == NULL) {
        return;
    }
#if defined(GDK_WINDOWING_WAYLAND)
    if (state->ext_effect != NULL) {
        ext_background_effect_surface_v1_destroy(state->ext_effect);
        state->ext_effect = NULL;
    }
    if (state->kde_blur != NULL) {
        org_kde_kwin_blur_release(state->kde_blur);
        state->kde_blur = NULL;
    }
    if (state->ext_mgr != NULL) {
        ext_background_effect_manager_v1_destroy(state->ext_mgr);
        state->ext_mgr = NULL;
    }
    if (state->kde_mgr != NULL) {
        /* manager has no destroy in older KDE protocol; leave for process exit */
        state->kde_mgr = NULL;
    }
    if (state->registry != NULL) {
        wl_registry_destroy(state->registry);
        state->registry = NULL;
    }
    /* display / compositor / surface owned by GDK */
    state->display = NULL;
    state->compositor = NULL;
    state->surface = NULL;
#endif
    g_free(state);
}

#if defined(GDK_WINDOWING_WAYLAND)

static void on_ext_capabilities(
    void *data,
    struct ext_background_effect_manager_v1 *mgr,
    uint32_t flags)
{
    VelaBlurState *state = data;
    (void)mgr;
    state->ext_caps = flags;
    state->ext_has_blur_cap =
        (flags & EXT_BACKGROUND_EFFECT_MANAGER_V1_CAPABILITY_BLUR) ? 1 : 0;
}

static const struct ext_background_effect_manager_v1_listener ext_mgr_listener = {
    .capabilities = on_ext_capabilities,
};

static void registry_global(
    void *data,
    struct wl_registry *registry,
    uint32_t name,
    const char *interface,
    uint32_t version)
{
    VelaBlurState *state = data;
    (void)version;

    if (interface == NULL) {
        return;
    }

    /* Prefer standardized staging protocol over KDE legacy. */
    if (strcmp(interface, ext_background_effect_manager_v1_interface.name) == 0) {
        if (state->ext_mgr == NULL) {
            state->ext_mgr = wl_registry_bind(
                registry,
                name,
                &ext_background_effect_manager_v1_interface,
                1);
            if (state->ext_mgr != NULL) {
                ext_background_effect_manager_v1_add_listener(
                    state->ext_mgr,
                    &ext_mgr_listener,
                    state);
            }
        }
        return;
    }

    if (strcmp(interface, org_kde_kwin_blur_manager_interface.name) == 0) {
        if (state->kde_mgr == NULL) {
            state->kde_mgr = wl_registry_bind(
                registry,
                name,
                &org_kde_kwin_blur_manager_interface,
                1);
        }
    }
}

static void registry_global_remove(
    void *data,
    struct wl_registry *registry,
    uint32_t name)
{
    (void)data;
    (void)registry;
    (void)name;
    /* Capability drop: next set_region will re-check; leave objects inert. */
}

static const struct wl_registry_listener registry_listener = {
    .global = registry_global,
    .global_remove = registry_global_remove,
};

static GdkSurface *window_gdk_surface(GtkWidget *window)
{
    if (window == NULL) {
        return NULL;
    }
    return gtk_native_get_surface(GTK_NATIVE(window));
}

static int ensure_surface_objects(VelaBlurState *state)
{
    GdkSurface *gdk_surface;

    if (state->surface == NULL) {
        gdk_surface = window_gdk_surface(state->window);
        if (gdk_surface == NULL || !GDK_IS_WAYLAND_SURFACE(gdk_surface)) {
            return 0;
        }
        state->surface = gdk_wayland_surface_get_wl_surface(gdk_surface);
        if (state->surface == NULL) {
            return 0;
        }
    }

    if (state->ext_mgr != NULL && state->ext_effect == NULL) {
        state->ext_effect = ext_background_effect_manager_v1_get_background_effect(
            state->ext_mgr,
            state->surface);
        if (state->ext_effect != NULL) {
            state->backend = 1;
        }
    }

    if (state->backend != 1 && state->kde_mgr != NULL && state->kde_blur == NULL) {
        state->kde_blur = org_kde_kwin_blur_manager_create(state->kde_mgr, state->surface);
        if (state->kde_blur != NULL) {
            state->backend = 2;
        }
    }

    return state->backend == 1 || state->backend == 2;
}

static void force_surface_commit(VelaBlurState *state)
{
    GdkSurface *gdk_surface = window_gdk_surface(state->window);
    if (gdk_surface == NULL) {
        return;
    }
#if GTK_CHECK_VERSION(4, 18, 0)
    if (GDK_IS_WAYLAND_SURFACE(gdk_surface)) {
        gdk_wayland_surface_force_next_commit(gdk_surface);
    }
#else
    (void)gdk_surface;
#endif
    /* Queue a redraw so GTK commits the surface with new blur state. */
    if (state->window != NULL) {
        gtk_widget_queue_draw(state->window);
    }
}

#endif /* GDK_WINDOWING_WAYLAND */

int vela_blur_attach(VelaBlurState *state, GtkWidget *window)
{
    GdkDisplay *display;

    if (state == NULL || window == NULL) {
        return 0;
    }

    state->window = window;

#if !defined(GDK_WINDOWING_WAYLAND)
    state->backend = 4;
    return 0;
#else
    display = gtk_widget_get_display(window);
    if (display == NULL) {
        display = gdk_display_get_default();
    }
    if (display == NULL) {
        state->backend = 4;
        return 0;
    }

    if (!GDK_IS_WAYLAND_DISPLAY(display)) {
#if defined(GDK_WINDOWING_X11)
        {
            const char *name = G_OBJECT_TYPE_NAME(display);
            if (name != NULL && strstr(name, "X11") != NULL) {
                state->backend = 3;
                return 0;
            }
        }
#endif
        state->backend = 4;
        return 0;
    }

    if (state->registry != NULL) {
        /* Already bound managers; try surface objects if window now realized. */
        return ensure_surface_objects(state);
    }

    state->display = gdk_wayland_display_get_wl_display(display);
    state->compositor = gdk_wayland_display_get_wl_compositor(display);
    if (state->display == NULL || state->compositor == NULL) {
        state->backend = 4;
        return 0;
    }

    state->ext_has_blur_cap = -1;
    state->registry = wl_display_get_registry(state->display);
    if (state->registry == NULL) {
        state->backend = 4;
        return 0;
    }

    wl_registry_add_listener(state->registry, &registry_listener, state);
    wl_display_roundtrip(state->display);
    /* capabilities event for ext manager */
    wl_display_roundtrip(state->display);

    if (state->ext_mgr == NULL && state->kde_mgr == NULL) {
        state->backend = 0;
        return 0;
    }

    /* Prefer ext when bound; KDE as fallback. Surface objects need realize. */
    if (state->ext_mgr != NULL) {
        state->backend = 1;
    } else {
        state->backend = 2;
    }

    return ensure_surface_objects(state) || state->ext_mgr != NULL || state->kde_mgr != NULL;
#endif
}

int vela_blur_set_region(
    VelaBlurState *state,
    int x,
    int y,
    int width,
    int height,
    int visible)
{
#if !defined(GDK_WINDOWING_WAYLAND)
    (void)state;
    (void)x;
    (void)y;
    (void)width;
    (void)height;
    (void)visible;
    return 0;
#else
    struct wl_region *region = NULL;

    if (state == NULL) {
        return 0;
    }

    /* Re-attach surface objects after realize. */
    if (state->window != NULL) {
        (void)vela_blur_attach(state, state->window);
    }

    if (!ensure_surface_objects(state)) {
        return 0;
    }

    if (state->compositor == NULL) {
        return 0;
    }

    if (state->ext_effect != NULL && state->ext_has_blur_cap == 0) {
        /* Compositor advertised manager without blur capability. */
        return 0;
    }

    if (!visible || width < 1 || height < 1) {
        if (state->ext_effect != NULL) {
            ext_background_effect_surface_v1_set_blur_region(state->ext_effect, NULL);
        }
        if (state->kde_blur != NULL) {
            org_kde_kwin_blur_set_region(state->kde_blur, NULL);
            org_kde_kwin_blur_commit(state->kde_blur);
        }
        state->applied = 0;
        force_surface_commit(state);
        return 1;
    }

    region = wl_compositor_create_region(state->compositor);
    if (region == NULL) {
        return 0;
    }
    wl_region_add(region, x, y, width, height);

    if (state->ext_effect != NULL) {
        ext_background_effect_surface_v1_set_blur_region(state->ext_effect, region);
        state->backend = 1;
    } else if (state->kde_blur != NULL) {
        org_kde_kwin_blur_set_region(state->kde_blur, region);
        org_kde_kwin_blur_commit(state->kde_blur);
        state->backend = 2;
    } else {
        wl_region_destroy(region);
        return 0;
    }

    /* Region is copy semantics for both protocols. */
    wl_region_destroy(region);

    state->last_x = x;
    state->last_y = y;
    state->last_w = width;
    state->last_h = height;
    state->applied = 1;
    force_surface_commit(state);
    return 1;
#endif
}
