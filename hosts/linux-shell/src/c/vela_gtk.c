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
    GtkWidget *debug_label;
    WebKitUserContentManager *ucm;
    VelaGtkPointerDownFn on_pointer_down;
    void *on_pointer_down_userdata;
    VelaGtkBridgeMessageFn on_bridge_message;
    void *on_bridge_message_userdata;
    int32_t hit_route; /* 1 underlay 2 web 3 material */
    double underlay_r;
    double underlay_g;
    double underlay_b;
    char *preload_js;
    char *initial_url;
    char *title;
    int width;
    int height;
};

static void underlay_draw(
    GtkDrawingArea *area,
    cairo_t *cr,
    int width,
    int height,
    gpointer user_data)
{
    VelaGtkApp *app = user_data;
    (void)area;
    (void)width;
    (void)height;
    cairo_set_source_rgb(cr, app->underlay_r, app->underlay_g, app->underlay_b);
    cairo_paint(cr);
    /* Visual cue for dogfood holes */
    cairo_set_source_rgba(cr, 1.0, 1.0, 1.0, 0.12);
    cairo_rectangle(cr, width * 0.15, height * 0.25, width * 0.7, height * 0.45);
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
    /* Default: web receives events; material always on top for its allocation. */
    gtk_widget_set_can_target(app->underlay, app->hit_route == 1);
    gtk_widget_set_can_target(app->webview, app->hit_route == 2 || app->hit_route == 0);
    gtk_widget_set_can_target(app->material, TRUE);
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
    /* WebView as overlay child on top of underlay, under material. */
    gtk_overlay_add_overlay(GTK_OVERLAY(app->overlay), app->webview);
    gtk_widget_set_halign(app->webview, GTK_ALIGN_FILL);
    gtk_widget_set_valign(app->webview, GTK_ALIGN_FILL);

    app->material = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 0);
    gtk_widget_add_css_class(app->material, "vela-material");
    gtk_widget_set_halign(app->material, GTK_ALIGN_CENTER);
    gtk_widget_set_valign(app->material, GTK_ALIGN_START);
    gtk_widget_set_margin_top(app->material, 12);
    gtk_widget_set_size_request(app->material, 480, 52);
    {
        GtkWidget *label = gtk_label_new("gtk.blur toolbar (degraded)");
        gtk_widget_add_css_class(label, "vela-material-label");
        gtk_box_append(GTK_BOX(app->material), label);
    }
    gtk_overlay_add_overlay(GTK_OVERLAY(app->overlay), app->material);

    app->debug_label = gtk_label_new("lastHit: (none)");
    gtk_widget_add_css_class(app->debug_label, "vela-debug");
    gtk_widget_set_halign(app->debug_label, GTK_ALIGN_START);
    gtk_widget_set_valign(app->debug_label, GTK_ALIGN_END);
    gtk_widget_set_margin_start(app->debug_label, 8);
    gtk_widget_set_margin_bottom(app->debug_label, 8);
    gtk_overlay_add_overlay(GTK_OVERLAY(app->overlay), app->debug_label);
    gtk_widget_set_can_target(app->debug_label, FALSE);

    {
        GtkCssProvider *provider = gtk_css_provider_new();
        const char *css =
            ".vela-material {"
            "  background-color: alpha(@theme_bg_color, 0.55);"
            "  border-radius: 999px;"
            "  border: 1px solid alpha(@theme_fg_color, 0.18);"
            "  padding: 0 20px;"
            "  min-height: 52px;"
            "}"
            ".vela-material-label { font-weight: 600; }"
            ".vela-debug {"
            "  background-color: alpha(black, 0.55);"
            "  color: white;"
            "  padding: 4px 8px;"
            "  border-radius: 6px;"
            "  font-family: monospace;"
            "  font-size: 11px;"
            "}";
        gtk_css_provider_load_from_string(provider, css);
        gtk_style_context_add_provider_for_display(
            gdk_display_get_default(),
            GTK_STYLE_PROVIDER(provider),
            GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
        g_object_unref(provider);
    }

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
    if (app == NULL || app->material == NULL || bounds == NULL) {
        return;
    }
    gtk_widget_set_margin_top(app->material, (int)bounds->y);
    gtk_widget_set_size_request(app->material, (int)bounds->width, (int)bounds->height);
    /* Horizontal: center with approximate margin via width request only for spike. */
}

void vela_gtk_set_material_visible(VelaGtkApp *app, int visible)
{
    if (app == NULL || app->material == NULL) {
        return;
    }
    gtk_widget_set_visible(app->material, visible ? TRUE : FALSE);
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
