#!/usr/bin/env swift
// Vela tray helper (macOS): NSStatusItem, JSON-lines on stdio.

import AppKit
import Foundation

final class TrayHost: NSObject {
  static let shared = TrayHost()

  private var items: [String: NSStatusItem] = [:]
  private let lock = NSLock()
  private var reqCounterHandlers: [String: () -> Void] = [:]

  func emit(_ obj: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(obj),
          let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
          let line = String(data: data, encoding: .utf8) else { return }
    fputs(line + "\n", stdout)
    fflush(stdout)
  }

  func handle(req: [String: Any]) {
    let reqId = req["id"]
    let op = req["op"] as? String ?? ""
    do {
      switch op {
      case "create":
        guard let trayId = req["trayId"] as? String else {
          throw NSError(domain: "vela", code: 1, userInfo: [NSLocalizedDescriptionKey: "missing trayId"])
        }
        lock.lock()
        defer { lock.unlock() }
        if items[trayId] != nil {
          throw NSError(domain: "vela", code: 2, userInfo: [NSLocalizedDescriptionKey: "tray already exists: \(trayId)"])
        }
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        configure(item: item, trayId: trayId, req: req)
        items[trayId] = item
        emit(["type": "res", "id": reqId as Any, "ok": true, "trayId": trayId])
      case "update":
        guard let trayId = req["trayId"] as? String, let item = items[trayId] else {
          throw NSError(domain: "vela", code: 3, userInfo: [NSLocalizedDescriptionKey: "unknown tray"])
        }
        configure(item: item, trayId: trayId, req: req)
        emit(["type": "res", "id": reqId as Any, "ok": true])
      case "remove":
        guard let trayId = req["trayId"] as? String else {
          throw NSError(domain: "vela", code: 1, userInfo: [NSLocalizedDescriptionKey: "missing trayId"])
        }
        lock.lock()
        if let item = items.removeValue(forKey: trayId) {
          NSStatusBar.system.removeStatusItem(item)
        } else {
          lock.unlock()
          throw NSError(domain: "vela", code: 3, userInfo: [NSLocalizedDescriptionKey: "unknown tray: \(trayId)"])
        }
        lock.unlock()
        emit(["type": "res", "id": reqId as Any, "ok": true])
      case "quit":
        emit(["type": "res", "id": reqId as Any, "ok": true])
        DispatchQueue.main.async {
          NSApp.terminate(nil)
        }
      default:
        throw NSError(domain: "vela", code: 4, userInfo: [NSLocalizedDescriptionKey: "unknown op: \(op)"])
      }
    } catch {
      emit(["type": "res", "id": reqId as Any, "ok": false, "error": error.localizedDescription])
    }
  }

  private func configure(item: NSStatusItem, trayId: String, req: [String: Any]) {
    if let tooltip = req["tooltip"] as? String {
      item.button?.toolTip = tooltip
      item.button?.title = tooltip.isEmpty ? "V" : String(tooltip.prefix(1))
    } else if item.button?.title == nil || item.button?.title?.isEmpty == true {
      item.button?.title = "V"
    }
    if let iconPath = req["icon"] as? String, FileManager.default.fileExists(atPath: iconPath) {
      let image = NSImage(contentsOfFile: iconPath)
      image?.isTemplate = true
      item.button?.image = image
      item.button?.title = ""
    }

    if let menuSpec = req["menu"] as? [[String: Any]] {
      let menu = NSMenu()
      for entry in menuSpec {
        if (entry["type"] as? String) == "separator" {
          menu.addItem(NSMenuItem.separator())
          continue
        }
        let id = entry["id"] as? String ?? ""
        let label = entry["label"] as? String ?? id
        let mi = NSMenuItem(title: label, action: #selector(menuClicked(_:)), keyEquivalent: "")
        mi.target = self
        mi.representedObject = ["trayId": trayId, "itemId": id]
        if let enabled = entry["enabled"] as? Bool {
          mi.isEnabled = enabled
        }
        if let checked = entry["checked"] as? Bool {
          mi.state = checked ? .on : .off
        }
        menu.addItem(mi)
      }
      item.menu = menu
    }

    item.button?.target = self
    item.button?.action = #selector(statusClicked(_:))
    item.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
  }

  @objc private func menuClicked(_ sender: NSMenuItem) {
    guard let info = sender.representedObject as? [String: String],
          let trayId = info["trayId"],
          let itemId = info["itemId"] else { return }
    emit([
      "type": "event",
      "payload": [
        "id": trayId,
        "action": "menu",
        "itemId": itemId,
      ],
    ])
  }

  @objc private func statusClicked(_ sender: NSStatusBarButton) {
    // Find tray id by button identity is awkward; use first item match.
    lock.lock()
    let pair = items.first { $0.value.button === sender }
    lock.unlock()
    guard let trayId = pair?.key else { return }
    let action: String
    if NSApp.currentEvent?.type == .rightMouseUp {
      action = "right-click"
    } else {
      action = "click"
    }
    emit([
      "type": "event",
      "payload": [
        "id": trayId,
        "action": action,
      ],
    ])
  }
}

final class StdinReader: NSObject {
  private let handle = FileHandle.standardInput

  func start() {
    handle.readabilityHandler = { handle in
      let data = handle.availableData
      if data.isEmpty {
        DispatchQueue.main.async { NSApp.terminate(nil) }
        return
      }
      guard let text = String(data: data, encoding: .utf8) else { return }
      for line in text.split(whereSeparator: \.isNewline) {
        let s = String(line).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty,
              let raw = s.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
              (obj["type"] as? String) == "req" else { continue }
        DispatchQueue.main.async {
          TrayHost.shared.handle(req: obj)
        }
      }
    }
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
TrayHost.shared.emit(["type": "ready", "platform": "macos", "pid": ProcessInfo.processInfo.processIdentifier])
let reader = StdinReader()
reader.start()
app.run()
