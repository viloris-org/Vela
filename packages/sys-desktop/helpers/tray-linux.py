#!/usr/bin/env python3
"""Vela tray helper (Linux): AppIndicator / Ayatana + GTK, JSON-lines on stdio."""

from __future__ import annotations

import json
import os
import sys
import threading

# Prefer Ayatana (Ubuntu/Debian), fall back to AppIndicator3.
gi_ok = False
AppIndicator = None
try:
    import gi

    gi.require_version("Gtk", "3.0")
    from gi.repository import Gtk, GLib  # type: ignore

    try:
        gi.require_version("AyatanaAppIndicator3", "0.1")
        from gi.repository import AyatanaAppIndicator3 as AppIndicator  # type: ignore
    except Exception:
        gi.require_version("AppIndicator3", "0.1")
        from gi.repository import AppIndicator3 as AppIndicator  # type: ignore
    gi_ok = True
except Exception as exc:  # pragma: no cover
    sys.stderr.write(f"vela-tray-linux: GI/AppIndicator unavailable: {exc}\n")
    sys.stderr.flush()
    print(json.dumps({"type": "fatal", "error": f"GI/AppIndicator unavailable: {exc}"}), flush=True)
    sys.exit(2)


trays: dict[str, dict] = {}
lock = threading.Lock()
out_lock = threading.Lock()


def emit(obj: dict) -> None:
    with out_lock:
        sys.stdout.write(json.dumps(obj, separators=(",", ":")) + "\n")
        sys.stdout.flush()


def build_menu(tray_id: str, menu_spec: list | None):
    menu = Gtk.Menu()
    if not menu_spec:
        return menu

    for item in menu_spec:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "separator":
            menu.append(Gtk.SeparatorMenuItem())
            continue
        item_id = str(item.get("id", ""))
        label = str(item.get("label", item_id))
        # Honor optional `checked` for parity with macOS/Windows helpers.
        if "checked" in item and item.get("checked") is not None:
            mi = Gtk.CheckMenuItem(label=label)
            mi.set_active(bool(item.get("checked")))
        else:
            mi = Gtk.MenuItem(label=label)
        if item.get("enabled") is False:
            mi.set_sensitive(False)

        def on_activate(_w, tid=tray_id, iid=item_id):
            emit(
                {
                    "type": "event",
                    "payload": {
                        "id": tid,
                        "action": "menu",
                        "itemId": iid,
                    },
                }
            )

        mi.connect("activate", on_activate)
        menu.append(mi)
    menu.show_all()
    return menu


def ensure_indicator(tray_id: str, tooltip: str | None, icon: str | None, menu_spec: list | None):
    icon_name = icon if icon else "application-default-icon"
    if tray_id in trays:
        state = trays[tray_id]
        ind = state["indicator"]
        if tooltip is not None:
            ind.set_title(tooltip)
        if icon is not None:
            ind.set_icon(icon_name)
        if menu_spec is not None:
            menu = build_menu(tray_id, menu_spec)
            ind.set_menu(menu)
            state["menu"] = menu
        return

    ind = AppIndicator.Indicator.new(
        f"vela-{tray_id}",
        icon_name,
        AppIndicator.IndicatorCategory.APPLICATION_STATUS,
    )
    ind.set_status(AppIndicator.IndicatorStatus.ACTIVE)
    if tooltip:
        ind.set_title(tooltip)
    menu = build_menu(tray_id, menu_spec)
    ind.set_menu(menu)
    trays[tray_id] = {"indicator": ind, "menu": menu}


def handle_req(msg: dict) -> None:
    req_id = msg.get("id")
    op = msg.get("op")
    try:
        if op == "create":
            tid = str(msg["trayId"])
            with lock:
                if tid in trays:
                    raise RuntimeError(f"tray already exists: {tid}")
                ensure_indicator(
                    tid,
                    msg.get("tooltip"),
                    msg.get("icon"),
                    msg.get("menu"),
                )
            emit({"type": "res", "id": req_id, "ok": True, "trayId": tid})
        elif op == "update":
            tid = str(msg["trayId"])
            with lock:
                if tid not in trays:
                    raise RuntimeError(f"unknown tray: {tid}")
                ensure_indicator(
                    tid,
                    msg.get("tooltip"),
                    msg.get("icon"),
                    msg.get("menu"),
                )
            emit({"type": "res", "id": req_id, "ok": True})
        elif op == "remove":
            tid = str(msg["trayId"])
            with lock:
                state = trays.pop(tid, None)
                if state is None:
                    raise RuntimeError(f"unknown tray: {tid}")
                ind = state["indicator"]
                ind.set_status(AppIndicator.IndicatorStatus.PASSIVE)
            emit({"type": "res", "id": req_id, "ok": True})
        elif op == "quit":
            emit({"type": "res", "id": req_id, "ok": True})
            GLib.idle_add(Gtk.main_quit)
        else:
            raise RuntimeError(f"unknown op: {op}")
    except Exception as exc:
        emit({"type": "res", "id": req_id, "ok": False, "error": str(exc)})


def stdin_loop() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError as exc:
            emit({"type": "res", "id": None, "ok": False, "error": f"bad json: {exc}"})
            continue
        if msg.get("type") != "req":
            continue
        GLib.idle_add(lambda m=msg: handle_req(m) or False)


def main() -> int:
    emit({"type": "ready", "platform": "linux", "pid": os.getpid()})
    t = threading.Thread(target=stdin_loop, daemon=True)
    t.start()
    Gtk.main()
    return 0


if __name__ == "__main__":
    sys.exit(main())
