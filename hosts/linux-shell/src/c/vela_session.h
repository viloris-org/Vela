/**
 * Display-session probe for hosts/linux-shell.
 * Detects GDK backend (Wayland/X11) and queries known Wayland globals.
 * Maps stay in Zig (session.zig); this surface only reports names.
 */
#ifndef VELA_SESSION_H
#define VELA_SESSION_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Display backend: 0=unknown, 1=wayland, 2=x11 */
enum {
    VELA_DISPLAY_UNKNOWN = 0,
    VELA_DISPLAY_WAYLAND = 1,
    VELA_DISPLAY_X11 = 2
};

/**
 * Probe current default GdkDisplay.
 * Writes up to max_globals NUL-terminated interface names into globals_out
 * (each entry is a pointer into a static table of known names that are present).
 * Returns backend enum; out_count is number of matched globals.
 *
 * Safe to call before or after creating a GtkApplication (needs a default display).
 * On headless / no display, returns VELA_DISPLAY_UNKNOWN and count 0.
 */
int vela_session_probe(
    const char **globals_out,
    size_t max_globals,
    size_t *out_count);

/** Human backend name for logs. */
const char *vela_session_backend_name(int backend);

#ifdef __cplusplus
}
#endif

#endif /* VELA_SESSION_H */
