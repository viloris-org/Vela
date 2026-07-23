/**
 * Apply compositor window-behind blur to a material region (Phase 1L).
 * L4-only: binds ext-background-effect-v1 or KDE org_kde_kwin_blur.
 * Prefer portable feature ids outside this file (session.zig).
 */
#ifndef VELA_BLUR_H
#define VELA_BLUR_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct VelaBlurState VelaBlurState;
typedef struct _GtkWidget GtkWidget;

/** Backend id for logs: "ext-background-effect" | "kde-blur" | "none" | "x11" | "unknown" */
const char *vela_blur_backend_name(const VelaBlurState *state);

VelaBlurState *vela_blur_create(void);
void vela_blur_destroy(VelaBlurState *state);

/**
 * Bind Wayland blur manager using the window's GdkSurface display.
 * Safe to call before realize; returns 0 if not Wayland or no manager.
 * Call again after window realize if first attach returned 0 and display exists.
 */
int vela_blur_attach(VelaBlurState *state, GtkWidget *window);

/**
 * Set blur region in surface-local (logical content) coordinates.
 * visible=0 clears the effect. Returns 1 if a protocol request was sent.
 */
int vela_blur_set_region(
    VelaBlurState *state,
    int x,
    int y,
    int width,
    int height,
    int visible);

/** 1 if a blur manager was bound. */
int vela_blur_has_manager(const VelaBlurState *state);

/** 1 if a non-empty region is currently applied. */
int vela_blur_is_applied(const VelaBlurState *state);

#ifdef __cplusplus
}
#endif

#endif /* VELA_BLUR_H */
