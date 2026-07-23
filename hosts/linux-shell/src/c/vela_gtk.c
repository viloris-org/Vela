#include "vela_gtk.h"

#include <gtk/gtk.h>
#include <webkit/webkit.h>

#include <stdio.h>
#include <string.h>

struct VelaGtkApp {
    GtkApplication *application;
    GtkWidget *window;
    GtkWidget *overlay;
    GtkWidget *underlay;
    GtkWidget *webview;
    GtkWidget *material;
    GtkWidget *material_label;
    GtkWidget *debug_label;
    GtkCssProvider *material_css;
    WebKitUserContentManager *ucm;
    VelaGtkPointerDownFn on_pointer_down;
    void *on_pointer_down_userdata;
    VelaGtkBridgeMessageFn on_bridge_message;
    void *on_bridge_message_userdata;
    int32_t hit_route; /* 1 underlay 2 web 3 material */
    int material_above_web; /* 1 toolbar-on-top, 0 glass-under-web */
    double material_radius;
    int material_w; /* last app-reported width (0 = unset) */
    int material_h;
    double underlay_r;
    double underlay_g;
    double underlay_b;
    char *preload_js;
    char *initial_url;
    char *title;
    int width;
    int height;
};

static void apply_material_css(VelaGtkApp *app)
{
    char css[640];
    double r = app->material_radius;
    int w = app->material_w > 0 ? app->material_w : 0;
    int h = app->material_h > 0 ? app->material_h : 0;
    if (r < 0.0) {
        r = 999.0; /* capsule */
    }
    /*
     * Translucent chrome stand-in for gtk.blur when compositor/snapshot
     * blur is unavailable. Keep alpha low so underlay color bleeds through
     * and stacked web card (also soft) does not read as a solid white slab.
     * max-width/height pin the plate to app-reported card bounds.
     */
    if (w > 0 && h > 0) {
        g_snprintf(
            css,
            sizeof(css),
            ".vela-material {"
            "  background-color: alpha(#f8fafc, 0.38);"
            "  border-radius: %.0fpx;"
            "  border: 1px solid alpha(white, 0.40);"
            "  box-shadow:"
            "    0 20px 48px alpha(black, 0.22),"
            "    inset 0 1px 0 alpha(white, 0.45);"
            "  min-width: %dpx; min-height: %dpx;"
            "  max-width: %dpx; max-height: %dpx;"
            "  padding: 0;"
            "}"
            ".vela-material-label {"
            "  font-weight: 600;"
            "  font-size: 11px;"
            "  color: alpha(#0f172a, 0.45);"
            "  opacity: 1;"
            "  margin: 6px 10px;"
            "}"
            ".vela-debug {"
            "  background-color: alpha(black, 0.55);"
            "  color: white;"
            "  padding: 4px 8px;"
            "  border-radius: 6px;"
            "  font-family: monospace;"
            "  font-size: 11px;"
            "}",
            r,
            w,
            h,
            w,
            h);
    } else {
        g_snprintf(
            css,
            sizeof(css),
            ".vela-material {"
            "  background-color: alpha(#f8fafc, 0.38);"
            "  border-radius: %.0fpx;"
            "  border: 1px solid alpha(white, 0.40);"
            "  box-shadow:"
            "    0 20px 48px alpha(black, 0.22),"
            "    inset 0 1px 0 alpha(white, 0.45);"
            "  min-height: 0;"
            "  padding: 0;"
            "}"
            ".vela-material-label {"
            "  font-weight: 600;"
            "  font-size: 11px;"
            "  color: alpha(#0f172a, 0.45);"
            "  opacity: 1;"
            "  margin: 6px 10px;"
            "}"
            ".vela-debug {"
            "  background-color: alpha(black, 0.55);"
            "  color: white;"
            "  padding: 4px 8px;"
            "  border-radius: 6px;"
            "  font-family: monospace;"
            "  font-size: 11px;"
            "}",
            r);
    }
    if (app->material_css == NULL) {
        app->material_css = gtk_css_provider_new();
        gtk_style_context_add_provider_for_display(
            gdk_display_get_default(),
            GTK_STYLE_PROVIDER(app->material_css),
            GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
    }
    gtk_css_provider_load_from_string(app->material_css, css);
}

static void reorder_material(VelaGtkApp *app)
{
    GtkOverlay *ov;
    if (app->overlay == NULL || app->material == NULL || app->webview == NULL) {
        return;
    }
    ov = GTK_OVERLAY(app->overlay);
    /*
     * GtkOverlay has no reorder API: remove + re-add paints later siblings on top.
     * above_web: underlay → web → material → debug
     * !above_web (clock glass): underlay → material → web → debug
     */
    g_object_ref(app->material);
    g_object_ref(app->webview);
    if (app->debug_label != NULL) {
        g_object_ref(app->debug_label);
    }

    gtk_overlay_remove_overlay(ov, app->material);
    gtk_overlay_remove_overlay(ov, app->webview);
    if (app->debug_label != NULL) {
        gtk_overlay_remove_overlay(ov, app->debug_label);
    }

    if (app->material_above_web) {
        gtk_overlay_add_overlay(ov, app->webview);
        gtk_overlay_add_overlay(ov, app->material);
    } else {
        gtk_overlay_add_overlay(ov, app->material);
        gtk_overlay_add_overlay(ov, app->webview);
    }
    if (app->debug_label != NULL) {
        gtk_overlay_add_overlay(ov, app->debug_label);
        gtk_widget_set_can_target(app->debug_label, FALSE);
    }

    g_object_unref(app->material);
    g_object_unref(app->webview);
    if (app->debug_label != NULL) {
        g_object_unref(app->debug_label);
    }
}

static void underlay_draw(
    GtkDrawingArea *area,
    cairo_t *cr,
    int width,
    int height,
    gpointer user_data)
{
    VelaGtkApp *app = user_data;
    cairo_pattern_t *base;
    cairo_pattern_t *warm;
    cairo_pattern_t *cool;
    (void)area;
    (void)app;

    /* Match example/clock #underlay-sim: dark base + warm/cool blooms so glass reads. */
    base = cairo_pattern_create_linear(0, 0, width * 0.35, height);
    cairo_pattern_add_color_stop_rgb(base, 0.0, 0.118, 0.106, 0.294); /* #1e1b4b */
    cairo_pattern_add_color_stop_rgb(base, 0.50, 0.059, 0.090, 0.165); /* #0f172a */
    cairo_pattern_add_color_stop_rgb(base, 1.0, 0.075, 0.306, 0.290); /* #134e4a */
    cairo_set_source(cr, base);
    cairo_paint(cr);
    cairo_pattern_destroy(base);

    warm = cairo_pattern_create_radial(
        width * 0.20,
        height * 0.30,
        0,
        width * 0.20,
        height * 0.30,
        width * 0.55);
    cairo_pattern_add_color_stop_rgba(warm, 0.0, 0.984, 0.749, 0.141, 0.55); /* #fbbf24 */
    cairo_pattern_add_color_stop_rgba(warm, 0.55, 0.984, 0.749, 0.141, 0.0);
    cairo_set_source(cr, warm);
    cairo_paint(cr);
    cairo_pattern_destroy(warm);

    cool = cairo_pattern_create_radial(
        width * 0.80,
        height * 0.70,
        0,
        width * 0.80,
        height * 0.70,
        width * 0.50);
    cairo_pattern_add_color_stop_rgba(cool, 0.0, 0.957, 0.447, 0.714, 0.42); /* #f472b6 */
    cairo_pattern_add_color_stop_rgba(cool, 0.50, 0.957, 0.447, 0.714, 0.0);
    cairo_set_source(cr, cool);
    cairo_paint(cr);
    cairo_pattern_destroy(cool);

    /* Soft band cue for dogfood holes (under material/web). */
    cairo_set_source_rgba(cr, 1.0, 1.0, 1.0, 0.06);
    cairo_rectangle(cr, width * 0.12, height * 0.22, width * 0.76, height * 0.50);
    cairo_fill(cr);
}

static void on_script_message(
    WebKitUserContentManager *manager,
    JSCValue *value,
    gpointer user_data)
{
    VelaGtkApp *app = user_data;
    (void)manager;
    if (app->on_bridge_message == NULL) {
        return;
    }
    char *json = NULL;
    if (value != NULL && JSC_IS_VALUE(value)) {
        json = jsc_value_to_json(value, 0);
    }
    if (json == NULL) {
        app->on_bridge_message(app->on_bridge_message_userdata, "{}", 2);
        return;
    }
    app->on_bridge_message(app->on_bridge_message_userdata, json, strlen(json));
    g_free(json);
}

static void apply_hit_can_target(VelaGtkApp *app)
{
    /* Route from Shell resolveHit — only the winning sibling targets. */
    gtk_widget_set_can_target(app->underlay, app->hit_route == 1);
    gtk_widget_set_can_target(app->webview, app->hit_route == 2 || app->hit_route == 0);
    /* Material only captures when it wins hit (toolbar). Card glass is under web. */
    gtk_widget_set_can_target(app->material, app->hit_route == 3);
}

static void on_click_pressed(
    GtkGestureClick *gesture,
    int n_press,
    double x,
    double y,
    gpointer user_data)
{
    VelaGtkApp *app = user_data;
    (void)gesture;
    (void)n_press;
    if (app->on_pointer_down != NULL) {
        app->on_pointer_down(app->on_pointer_down_userdata, x, y);
    }
    apply_hit_can_target(app);
}

static void on_app_activate(GtkApplication *application, gpointer user_data)
{
    VelaGtkApp *app = user_data;
    (void)application;

    app->window = gtk_application_window_new(app->application);
    gtk_window_set_title(GTK_WINDOW(app->window), app->title ? app->title : "Vela Linux Shell");
    gtk_window_set_default_size(GTK_WINDOW(app->window), app->width, app->height);

    app->overlay = gtk_overlay_new();
    gtk_window_set_child(GTK_WINDOW(app->window), app->overlay);

    app->underlay = gtk_drawing_area_new();
    gtk_widget_set_hexpand(app->underlay, TRUE);
    gtk_widget_set_vexpand(app->underlay, TRUE);
    gtk_drawing_area_set_draw_func(
        GTK_DRAWING_AREA(app->underlay),
        underlay_draw,
        app,
        NULL);
    gtk_overlay_set_child(GTK_OVERLAY(app->overlay), app->underlay);

    app->ucm = webkit_user_content_manager_new();
    if (app->preload_js != NULL && app->preload_js[0] != '\0') {
        WebKitUserScript *script = webkit_user_script_new(
            app->preload_js,
            WEBKIT_USER_CONTENT_INJECT_TOP_FRAME,
            WEBKIT_USER_SCRIPT_INJECT_AT_DOCUMENT_START,
            NULL,
            NULL);
        webkit_user_content_manager_add_script(app->ucm, script);
        webkit_user_script_unref(script);
    }

    /* Default world (NULL) script message handler → window.webkit.messageHandlers.vela */
    webkit_user_content_manager_register_script_message_handler(app->ucm, "vela", NULL);
    g_signal_connect(app->ucm, "script-message-received::vela", G_CALLBACK(on_script_message), app);

    app->webview = g_object_new(
        WEBKIT_TYPE_WEB_VIEW,
        "user-content-manager",
        app->ucm,
        NULL);
    gtk_widget_set_hexpand(app->webview, TRUE);
    gtk_widget_set_vexpand(app->webview, TRUE);
    /* Transparent page chrome so underlay + material glass show through holes. */
    {
        GdkRGBA clear = { 0.0, 0.0, 0.0, 0.0 };
        webkit_web_view_set_background_color(WEBKIT_WEB_VIEW(app->webview), &clear);
    }
    gtk_widget_set_halign(app->webview, GTK_ALIGN_FILL);
    gtk_widget_set_valign(app->webview, GTK_ALIGN_FILL);

    app->material = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
    gtk_widget_add_css_class(app->material, "vela-material");
    gtk_widget_set_halign(app->material, GTK_ALIGN_START);
    gtk_widget_set_valign(app->material, GTK_ALIGN_START);
    gtk_widget_set_hexpand(app->material, FALSE);
    gtk_widget_set_vexpand(app->material, FALSE);
    gtk_widget_set_overflow(app->material, GTK_OVERFLOW_HIDDEN);
    gtk_widget_set_size_request(app->material, 120, 40);
    app->material_label = gtk_label_new("gtk.blur");
    gtk_widget_add_css_class(app->material_label, "vela-material-label");
    gtk_widget_set_halign(app->material_label, GTK_ALIGN_START);
    gtk_widget_set_valign(app->material_label, GTK_ALIGN_START);
    gtk_box_append(GTK_BOX(app->material), app->material_label);
    /* Hidden until layers.insert; apps drive bounds/stack. */
    gtk_widget_set_visible(app->material, FALSE);
    /* Default stack is under-web glass — badge would bleed through WebView. */
    gtk_widget_set_visible(app->material_label, FALSE);

    /* Default stack: material under web (card glass). Toolbar insert reorders above. */
    app->material_above_web = 0;
    app->material_radius = 28.0;
    gtk_overlay_add_overlay(GTK_OVERLAY(app->overlay), app->material);
    gtk_overlay_add_overlay(GTK_OVERLAY(app->overlay), app->webview);

    /*
     * Bottom-right so it does not stack on top of example status HUD
     * (clock Status panel sits bottom-left).
     */
    app->debug_label = gtk_label_new("lastHit: (none)");
    gtk_widget_add_css_class(app->debug_label, "vela-debug");
    gtk_widget_set_halign(app->debug_label, GTK_ALIGN_END);
    gtk_widget_set_valign(app->debug_label, GTK_ALIGN_END);
    gtk_widget_set_margin_end(app->debug_label, 8);
    gtk_widget_set_margin_bottom(app->debug_label, 8);
    gtk_overlay_add_overlay(GTK_OVERLAY(app->overlay), app->debug_label);
    gtk_widget_set_can_target(app->debug_label, FALSE);

    apply_material_css(app);
    reorder_material(app);

    {
        GtkGesture *click = gtk_gesture_click_new();
        gtk_event_controller_set_propagation_phase(
            GTK_EVENT_CONTROLLER(click),
            GTK_PHASE_CAPTURE);
        g_signal_connect(click, "pressed", G_CALLBACK(on_click_pressed), app);
        gtk_widget_add_controller(app->overlay, GTK_EVENT_CONTROLLER(click));
    }

    app->hit_route = 2;
    apply_hit_can_target(app);

    if (app->initial_url != NULL && app->initial_url[0] != '\0') {
        webkit_web_view_load_uri(WEBKIT_WEB_VIEW(app->webview), app->initial_url);
    } else {
        webkit_web_view_load_uri(WEBKIT_WEB_VIEW(app->webview), "about:blank");
    }

    gtk_window_present(GTK_WINDOW(app->window));
}

VelaGtkApp *vela_gtk_app_create(const VelaGtkConfig *config)
{
    VelaGtkApp *app;
    if (config == NULL) {
        return NULL;
    }
    app = g_new0(VelaGtkApp, 1);
    app->width = config->width > 0 ? config->width : 960;
    app->height = config->height > 0 ? config->height : 640;
    app->underlay_r = 0.12;
    app->underlay_g = 0.28;
    app->underlay_b = 0.42;
    app->on_pointer_down = config->on_pointer_down;
    app->on_pointer_down_userdata = config->on_pointer_down_userdata;
    app->on_bridge_message = config->on_bridge_message;
    app->on_bridge_message_userdata = config->on_bridge_message_userdata;
    app->title = g_strdup(config->title ? config->title : "Vela Linux Shell");
    app->preload_js = config->preload_js ? g_strdup(config->preload_js) : NULL;
    app->initial_url = config->initial_url ? g_strdup(config->initial_url) : NULL;
    app->hit_route = 2;
    app->material_above_web = 0;
    app->material_radius = 28.0;
    app->material_w = 0;
    app->material_h = 0;

    app->application = gtk_application_new("dev.vela.linux-shell", G_APPLICATION_DEFAULT_FLAGS);
    g_signal_connect(app->application, "activate", G_CALLBACK(on_app_activate), app);

    /* Hold argc/argv for run */
    (void)config->argc;
    (void)config->argv;
    return app;
}

void vela_gtk_app_run(VelaGtkApp *app)
{
    if (app == NULL || app->application == NULL) {
        return;
    }
    g_application_run(G_APPLICATION(app->application), 0, NULL);
}

void vela_gtk_app_destroy(VelaGtkApp *app)
{
    if (app == NULL) {
        return;
    }
    if (app->application != NULL) {
        g_object_unref(app->application);
        app->application = NULL;
    }
    g_free(app->title);
    g_free(app->preload_js);
    g_free(app->initial_url);
    if (app->material_css != NULL) {
        g_object_unref(app->material_css);
        app->material_css = NULL;
    }
    g_free(app);
}

void vela_gtk_load_uri(VelaGtkApp *app, const char *uri)
{
    if (app == NULL || app->webview == NULL || uri == NULL) {
        return;
    }
    webkit_web_view_load_uri(WEBKIT_WEB_VIEW(app->webview), uri);
}

void vela_gtk_set_material_bounds(VelaGtkApp *app, const VelaGtkRect *bounds)
{
    int x;
    int y;
    int w;
    int h;
    if (app == NULL || app->material == NULL || bounds == NULL) {
        return;
    }
    x = (int)(bounds->x + 0.5);
    y = (int)(bounds->y + 0.5);
    w = (int)(bounds->width + 0.5);
    h = (int)(bounds->height + 0.5);
    if (w < 1) {
        w = 1;
    }
    if (h < 1) {
        h = 1;
    }
    gtk_widget_set_halign(app->material, GTK_ALIGN_START);
    gtk_widget_set_valign(app->material, GTK_ALIGN_START);
    gtk_widget_set_hexpand(app->material, FALSE);
    gtk_widget_set_vexpand(app->material, FALSE);
    gtk_widget_set_margin_start(app->material, x > 0 ? x : 0);
    gtk_widget_set_margin_top(app->material, y > 0 ? y : 0);
    gtk_widget_set_margin_end(app->material, 0);
    gtk_widget_set_margin_bottom(app->material, 0);
    /* Pin glass plate to app-reported card bounds (avoid double/offset plate). */
    app->material_w = w;
    app->material_h = h;
    gtk_widget_set_size_request(app->material, w, h);
    apply_material_css(app);
    gtk_widget_queue_allocate(app->material);
}

void vela_gtk_set_material_visible(VelaGtkApp *app, int visible)
{
    if (app == NULL || app->material == NULL) {
        return;
    }
    gtk_widget_set_visible(app->material, visible ? TRUE : FALSE);
}

void vela_gtk_set_material_above_web(VelaGtkApp *app, int above_web)
{
    if (app == NULL) {
        return;
    }
    app->material_above_web = above_web ? 1 : 0;
    /*
     * Toolbar chrome (above web): keep the "gtk.blur" dogfood badge.
     * Card glass (under web): hide it — the badge bleeds through the
     * transparent WebView and collides with app brand text (clock "VELA").
     */
    if (app->material_label != NULL) {
        gtk_widget_set_visible(app->material_label, above_web ? TRUE : FALSE);
    }
    reorder_material(app);
}

void vela_gtk_set_material_radius(VelaGtkApp *app, double radius_px)
{
    if (app == NULL) {
        return;
    }
    app->material_radius = radius_px;
    apply_material_css(app);
}

void vela_gtk_set_material_opacity(VelaGtkApp *app, double opacity)
{
    if (app == NULL || app->material == NULL) {
        return;
    }
    if (opacity < 0.0) {
        opacity = 0.0;
    }
    if (opacity > 1.0) {
        opacity = 1.0;
    }
    gtk_widget_set_opacity(app->material, opacity);
}

void vela_gtk_set_underlay_color(VelaGtkApp *app, double r, double g, double b)
{
    if (app == NULL) {
        return;
    }
    app->underlay_r = r;
    app->underlay_g = g;
    app->underlay_b = b;
    if (app->underlay != NULL) {
        gtk_widget_queue_draw(app->underlay);
    }
}

void vela_gtk_set_hit_route(VelaGtkApp *app, int32_t kind)
{
    if (app == NULL) {
        return;
    }
    app->hit_route = kind;
    if (app->webview != NULL) {
        apply_hit_can_target(app);
    }
}

void vela_gtk_set_debug_hit_label(VelaGtkApp *app, const char *text)
{
    if (app == NULL || app->debug_label == NULL) {
        return;
    }
    gtk_label_set_text(GTK_LABEL(app->debug_label), text ? text : "");
}

void vela_gtk_eval_js(VelaGtkApp *app, const char *script)
{
    if (app == NULL || app->webview == NULL || script == NULL) {
        return;
    }
    webkit_web_view_evaluate_javascript(
        WEBKIT_WEB_VIEW(app->webview),
        script,
        -1,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL);
}

void vela_gtk_get_content_size(VelaGtkApp *app, double *out_w, double *out_h)
{
    int w = 0;
    int h = 0;
    if (app == NULL) {
        if (out_w) {
            *out_w = 0;
        }
        if (out_h) {
            *out_h = 0;
        }
        return;
    }
    if (app->overlay != NULL) {
        w = gtk_widget_get_width(app->overlay);
        h = gtk_widget_get_height(app->overlay);
    }
    if (w <= 0) {
        w = app->width;
    }
    if (h <= 0) {
        h = app->height;
    }
    if (out_w) {
        *out_w = (double)w;
    }
    if (out_h) {
        *out_h = (double)h;
    }
}
