# Qt composition notes

> **Type**: Research  
> **Status**: Current  
> **Audience**: Host implementers | Maintainers  
> **SoT**: Study only; product contracts live in `@vela/api` and Accepted ADRs

Vela does **not** embed Qt. It aims for the same *class of control*: multi-layer stacking, masks, partial event transparency, and foreign surfaces - with **WebView-first** UI and a **Bun** desktop host.

## Local Qt source tree

| Expected | Status on this machine |
|----------|------------------------|
| `../qt5` (classic monorepo name) | **Not present** |
| `../qt6` | Present as a Qt super-repo scaffold (`init-repository`, empty module dirs) |

`../qt6` currently holds only top-level tooling and **empty submodule directories** (`qtbase`, `qtdeclarative`, …). Source headers are not checked out until `./init-repository` (or equivalent) populates submodules.

**Authoritative references while sources are empty:**

- [QWidget](https://doc.qt.io/qt-6/qwidget.html)
- [Qt::WidgetAttribute](https://doc.qt.io/qt-6/qt.html#WidgetAttribute-enum)
- [Qt::WindowType](https://doc.qt.io/qt-6/qt.html#WindowType-enum) (`WindowTransparentForInput`, …)
- [QWindow](https://doc.qt.io/qt-6/qwindow.html) (`setMask`, opacity, flags)
- [QQuickItem](https://doc.qt.io/qt-6/qquickitem.html) (`z`, `clip`, `contains`, `containmentMask`)
- [QWidget::createWindowContainer](https://doc.qt.io/qt-6/qwidget.html#createWindowContainer)

When `qtbase` / `qtdeclarative` are checked out, prefer reading:

| Area | Typical paths under `qt6/` |
|------|----------------------------|
| Widget attributes | `qtbase/src/corelib/global/qnamespace.h` |
| `QWidget` API | `qtbase/src/widgets/kernel/qwidget.h` |
| Widget event delivery | `qtbase/src/widgets/kernel/qwidget.cpp` |
| `QWindow` mask / flags | `qtbase/src/gui/kernel/qwindow.h` |
| Quick item stack / hit | `qtdeclarative/src/quick/items/qquickitem.h` |
| MouseArea / Pointer handlers | `qtdeclarative/src/quick/items/…`, `handlers/` |

Map those mechanisms to Vela types - do **not** re-export Qt APIs.

---

## Concept map (Widgets + Quick)

| Qt idea | Typical Qt API | Vela analogue |
|---------|----------------|---------------|
| Widget / item tree | `QWidget`, `QQuickItem` | `Layer` tree per window |
| Stacking order | `raise()`, `lower()`, `stackUnder()`, Quick `z` | `zIndex`, `reorderLayer` |
| Geometry | `setGeometry`, anchors / layout | `bounds: Rect` (logical) |
| Clip / mask (visual + hit) | `QWidget::setMask(QRegion\|QBitmap)`, `QWindow::setMask` | `clip?: Region`, `HitPolicy.mask` |
| Regional hit shape (Quick) | `QQuickItem::contains`, `containmentMask` | `HitPolicy.mask` / `callback` / `web-shaped` |
| Ignore mouse for subtree | `Qt::WA_TransparentForMouseEvents` | `HitPolicy.transparent` |
| Stop mouse bubbling to parent | `Qt::WA_NoMousePropagation` | Shell single-delivery (no parent steal) |
| Partial interactive chrome | mask + child widgets / `MouseArea` | `mask` / `web-shaped` + children |
| Transparent *top-level* to OS | `Qt::WindowTransparentForInput`, platform click-through | `WindowInputMode` |
| Translucent look ≠ hit | `WA_TranslucentBackground`, `windowOpacity` | `opacity` **separate** from `HitPolicy` |
| Child chrome controls | child widgets / items | `chrome` layers + `mountChild` |
| Native / foreign surface | `QWidget::createWindowContainer(QWindow*)`, foreign windows | `kind: "native"` components |
| Embed Quick in Widgets | `createWindowContainer(QQuickView*)` or `QQuickWidget` | multi-`webview` / native siblings (different runtime) |
| Platform blur / acrylic | platform extras / DWM / macOS materials | `kind: "material"` + `MaterialId` |

---

## Mode → HitPolicy / WindowInputMode

| Qt mechanism | Level | Vela |
|--------------|-------|------|
| `WA_TransparentForMouseEvents` | child / subtree | `HitPolicy: { mode: "transparent" }` |
| `setMask(region)` on widget/window | shape of *this* surface | `HitPolicy: { mode: "mask", region }` and/or `clip` |
| Quick `contains` / `containmentMask` | custom hit shape | `HitPolicy.callback` or `mask` |
| Web content decides interactive pixels | (no direct Qt twin) | `HitPolicy: { mode: "web-shaped" }` + `vela.hit.setOpaqueRegions` |
| `WindowTransparentForInput` / full click-through | top-level → OS | `WindowInputMode: { mode: "click-through" }` |
| Masked top-level + holes to desktop | top-level → OS | `WindowInputMode: { mode: "region-through" \| "shaped", region }` |
| Default receiving hits | either | `HitPolicy.opaque` / `WindowInputMode.normal` |

**Critical split (same as ADR 0001):**

- Annotator “hole to desktop” → **`WindowInputMode`**
- “Web UI hole to map underlay” → **`HitPolicy`** on layers

Qt can do both; conflating them in product code is a common bug class (and a common forum thread). Vela makes the split explicit in types.

---

## Lessons imported from Qt

### 1. Stacking is not optional

Qt apps routinely mix video, web, OpenGL, and controls as siblings. Electron-class stacks often treat “one WebView fills the window” as the only model. Vela makes the **layer tree** the truth so underlays and glass chrome are first-class.

Qt anchors: `QWidget::raise` / `stackUnder`, `QQuickItem::z`, `stackBefore` / `stackAfter`.

### 2. Visual opacity ≠ hit participation

A translucent widget may still eat mouse events. `windowOpacity`, `WA_TranslucentBackground`, and glass materials change *appearance*, not necessarily *who gets the click*.

Vela keeps `opacity` separate from `HitPolicy` so glass can be fully opaque to hits while still sampling backdrop visually.

### 3. Masks beat whole-window ignore

Flutter desktop often exposes whole-window mouse ignore. Qt’s `setMask` and event attributes enable **regional** holes. Caveats from Qt practice that Vela must encode in host design:

| Qt pitfall | Implication for Vela |
|------------|----------------------|
| `setMask` can also clip **painting**, not only hits | Prefer separate `clip` (visual) vs `HitPolicy.mask` (hit) when platforms allow |
| `WA_TransparentForMouseEvents` applies to the widget **and its children** | `transparent` is whole-layer; partial holes need `mask` / `web-shaped` |
| Unsetting mouse-transparent may leave `WindowTransparentForInput` sticky | Host must track OS click-through flag separately from layer policy (`WindowInputMode`) |
| `setMask` holes often stop delivering events to *this* widget entirely | “See events but pass through” needs Shell policy, not only OS mask |

Vela’s `HitPolicy.mask` and `web-shaped` target the regional model without requiring apps to fight OS-level window masks for in-app holes.

### 4. Window-level vs child-level transparency

Qt:

- Child: `WA_TransparentForMouseEvents`, masks, Quick `contains`
- Top-level: `WindowTransparentForInput`, platform-specific click-through,
top-level `setMask`

Vela:

- Layer → layer: `HitPolicy`
- Window → OS: `WindowInputMode`

### 5. Event ownership must be single

Embedding foreign windows / web engines still requires care (focus and event paths). Qt’s `createWindowContainer` creates a **native child window** that paints and receives input somewhat independently of pure QWidget composition - similar failure modes to **WKWebView + sibling NSView**.

Vela makes **Shell ownership of hit routing** explicit: one `HitTarget` per pointer event; no dual delivery to WebView and sibling native.

### 6. Containment / custom hit shapes (Quick)

`QQuickItem::contains` and `containmentMask` show that production UIs need **non-rectangular** hit tests without full per-pixel alpha. Vela v1 covers this with:

- `Region` unions (`rect` / `roundedRect` / `capsule` / `circle`)
- `HitPolicy.callback` for platform `hitTest` (e.g. Swift shape)
- `web-shaped` for DOM-driven opaque regions

Per-pixel alpha threshold remains deferred (expensive).

### 7. Foreign surfaces are first-class siblings

`QWidget::createWindowContainer(QWindow*)` is the Widgets-era pattern for embedding another window (including Quick via `QQuickView`). Documented trade-offs match Vela native layers:

- Geometry must be driven by the container (resize / show)
- Stacking / clipping after embed is fragile
- Event focus can fight the surrounding tree

Vela maps this to `kind: "native"` + Shell-owned bounds + single hit router - not “drop HWND into the web page”.

---

## What Vela deliberately does differently

| Qt default path | Vela |
|-----------------|------|
| Primary UI often Qt widgets / QML | Primary UI is **WebView** |
| C++/QML application language | Web UI + **Bun** host orchestration |
| Pixel-ish platform styling | Semantic materials (`MaterialId`) with fallback |
| Deep in-process plugin load culture | Signed native factories; no page-JS `dlopen` |
| One framework owns paint + hit | Shell owns composition/hit; web owns document UI |
| `QQuickWidget` texture redirect vs window embed | Prefer platform WebView + native siblings (host-specific) |

---

## Worked mapping examples

### A. Glass toolbar over web + map

**Qt sketch:** underlay widget + web/container + translucent chrome widget on top with mask for rounded capsule; chrome not `WA_TransparentForMouseEvents`.

**Vela:**

```ts
// underlay native (map) z=5, web z=10 web-shaped, material glass z=30 opaque
```

See [Composition and layers](../composition-and-layers.md).

### B. Hole in web to underlay (not to desktop)

**Qt sketch:** top widget uses mask *or* event filter so points outside UI regions fall through; underlay still inside the same top-level window.

**Vela:** `HitPolicy.web-shaped` + `vela.hit.setOpaqueRegions` - **not** `WindowInputMode`.

### C. Annotator click-through to other apps

**Qt sketch:** `WindowTransparentForInput` and/or top-level mask; events leave the process.

**Vela:** `WindowInputMode.region-through` / `click-through`. Must not disable in-app `HitPolicy` semantics when only some regions go to the OS.

### D. Camera / GPU surface beside web

**Qt sketch:** `createWindowContainer` or platform view embed; careful z-order and focus.

**Vela:** `kind: "native"`, `component: "camera.preview"`, permissions `camera:preview`.

---

## Suggested reading order (for Shell implementers)

1. ADR 0001 + this document (product intent)
2. [Input and hit testing](../input-and-hit-testing.md) (algorithm + acceptance)
3. Qt docs: `WA_TransparentForMouseEvents`, `QWidget::setMask`,
`WindowTransparentForInput`, `QQuickItem::contains` / `containmentMask`
4. Qt embed docs: `createWindowContainer` vs `QQuickWidget` trade-offs
5. Platform notes: WKWebView sibling views; WebView2 composition; Linux limits
([Platform support](../platform-support.md))

---

## Acceptance for “Qt-class”

A host is Qt-class for composition when:

1. At least three layer kinds coexist (e.g. web + native + material).
2. Regional hit-through works **inside** the client area.
3. Window-level click-through is available **without** breaking (2).
4. Materials sample real content below (or explicitly degrade).
5. Event delivery is single-path and testable.
6. Visual opacity / material appearance does not silently change hit policy.
7. Foreign / native surfaces respect Shell bounds and zIndex truth.

See [Input and hit testing](../input-and-hit-testing.md), [Composition and layers](../composition-and-layers.md), and [Testing and acceptance](../testing-and-acceptance.md).
