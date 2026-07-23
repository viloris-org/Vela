# App load and startup

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: Host implementers | App authors | Maintainers  
> **SoT**: [Run modes](run-modes.md) and [ADR 0007](adr/0007-typescript-full-stack-host.md) for where JS runs; this page for load-cost model and host-side tactics

How Vela thinks about **App first load** when the UI engine is the **system WebView** (V8, JSC, WebKit, …), not Bun. Bun stays on **build machines** and optional **desktop instant Host**; release clients must not require Bun on device. Startup quality comes from **prewarm**, **cache-friendly packaging**, and **shell-layer snapshots** — not from shipping a second JS runtime.

External systems (for example Cloudflare Workers) are cited only as **design parallels**. They are not product contracts.

## Product rule

| Rule | Meaning |
|------|---------|
| **No Bun in the client package for App execution** | Static/release trees do not depend on a Bun binary on the user’s machine or in the app package |
| **No “user must install Bun”** | Instant desktop Host may use Bun on a developer machine; that is not a product prerequisite for end users |
| **App JS always runs in the system WebView** | Same path on desktop and mobile ([run modes](run-modes.md), [ADR 0007](adr/0007-typescript-full-stack-host.md) D7) |
| **Do not embed Bun to “fix” App cold start** | Host speed does not move WebView parse/compile/first paint; dual runtimes add package and isolation cost |

**Principle:** Bun is a **developer and build-machine tool** (and the desktop **instant** reference Host). End-user devices need the **system WebView**, the **Shell/Host binaries** Vela ships, and optional native kernels — not a global or embedded Bun.

## Startup cost layers

Do not collapse every delay into “V8 is slow.” Profile and optimize by layer.

| Layer | What costs time | Typical payer |
|-------|-----------------|---------------|
| **A. Process / engine** | WebView or content-process cold create; environment init | First window / first WebView on a process |
| **B. Context / bridge** | JS world, preload / user scripts, `window.vela` injection | Per WebView (or per navigation policy) |
| **C. User code** | Read or fetch assets → parse → compile → run to first useful paint | Per content load; reduced by cache and smaller bundles |

| Related but separate | Notes |
|----------------------|--------|
| **Host process** | Instant desktop may already have a Bun Host warm; static/mobile use a ship backend. Host warm does **not** substitute for App layers A–C. |
| **Shell native** | Windowing, layer tree, materials — native work outside the page engine |

Cloudflare-class edge runtimes mostly **amortize A** (long-lived runtime, cheap isolates per tenant). Vela App load usually **pays A once per WebView lifetime** and is often dominated by **A + C** on first open.

## Snapshot and cache vocabulary

“Snapshot” is overloaded. Use these terms in design and reviews.

| Kind | What it is | Who controls it | Vela App path |
|------|------------|-----------------|---------------|
| **Engine startup snapshot** | Serialized V8 (or similar) heap after bootstrap; new isolates **deserialize** instead of full bootstrap | Embedder of the engine (Chrome, Node, Workers runtime) | **System WebView owns this.** App code does not inject a custom full-heap blob for the page. |
| **Code / bytecode cache** | Cached compile result for a script identity (URL / hash) | Engine + host resource protocol | **Primary engine lever** for repeat loads (stable URLs, persistent data store, platform flags) |
| **Speculative / process prewarm** | Create WebView or load code **before** the user-visible request finishes | Shell / platform scheduler | **Primary host lever** for first open |
| **Shell / first-paint snapshot** | Static shell HTML, prerendered frame, progressive hydrate | App packaging + Shell | **Primary product lever** for perceived load without custom V8 snapshots |

### What not to plan for (App WebView)

| Approach | Why it is out of default scope |
|----------|--------------------------------|
| Custom **V8 startup snapshot of the full App heap** shipped with the app | System WebView does not expose embedder `CreateParams` / snapshot injection for arbitrary page heaps |
| Embed Bun (or a second V8) only to run App UI from a snapshot | Violates the product rule; still leaves dual-runtime packaging |
| Per-request restore of a full mutable JS heap as the App cold-start story | State, security, and engine-version binding; not how system WebViews ship |

Custom engine startup snapshots may matter later for a **self-embedded Host** JS engine (plugins), not for the WebView App path. See [ADR 0007](adr/0007-typescript-full-stack-host.md) pluggable Host backends.

## Design parallel: edge Workers (Cloudflare-class)

This section is **research-shaped**. It explains industry tactics; it does not bind Vela APIs.

Typical stack:

1. **Long-lived runtime process** — pay JS engine process cost once per machine (or pool), not per request.
2. **Lightweight isolate / context** — tenant or script boundary inside that process (order-of-magnitude cheaper than a new container or Node process).
3. **Speculative prewarm** — for example load the Worker during TLS ClientHello so handshake RTT hides single-digit-millisecond isolate load.
4. **Code / bytecode cache (and related)** — reduce compile cost for scripts or Wasm; often version- and arch-sensitive when prebuilt centrally.

Public “zero cold start” stories usually combine **(1)+(2)+(3)**. They are **not** “every request deserializes a full user-heap snapshot instead of isolates.” Engine-level startup snapshots (table above) are infrastructure for the **runtime**, not a product API for each tenant app.

### Map to Vela

| Edge / Workers idea | Vela analogue (no Bun on device) |
|---------------------|-----------------------------------|
| Long-lived runtime | Long-lived **Shell** process; early or pooled **WebView** / WebView2 environment |
| Fast isolate create | New page context inside an **already created** WebView (still not free, but not a full process) |
| Handshake-time warm | Create WebView and inject preload **before** first user-visible navigation completes |
| Small script + edge-resident code | Build-machine **tight bundles** (Bun as bundler only); **local / custom-scheme** assets in static mode |
| Code cache | Stable resource identity + WebView bytecode / disk caches |
| Keep-warm isolate | Optional hidden prewarm WebView or environment reuse |

## Vela tactics (priority order)

Implement and review in this order unless measurement shows a different bottleneck.

### 1. Shell prewarm (cost layers A and B)

| Action | Intent |
|--------|--------|
| Create the primary WebView **early** in Shell startup (or reuse a process-wide environment) | Amortize process/engine create |
| Inject preload / user scripts **before** or at first navigation | Bridge ready in parallel with content |
| Prefer one **WebView2 environment** (or platform equivalent) shared across views when the toolkit allows | Avoid repeated environment cold starts |
| Optional: hidden warm WebView or pool for multi-window apps | Trade memory for open latency |

Instant mode may already have a warm desktop Host; still prewarm the **WebView** for App load.

### 2. Code / bytecode cache (cost layer C, repeat loads)

| Action | Intent |
|--------|--------|
| **Stable resource identity** for release assets (fixed path + content hash, or equivalent) | Cache keys must hit across launches |
| Prefer **packaged / custom-scheme / virtual-host** loads over unnecessary network hops in static mode | Local identity + offline |
| Keep platform **website data / code caches** unless the user or security policy clears them | Second and later opens get compile savings |
| Use platform features when available (for example WebView2 code-cache eligibility for virtual host and intercepted responses) | Engine-owned bytecode cache |
| **Build machine (Bun):** tight bundles, predictable chunk names, avoid needless cache-busting of unchanged modules | Smaller C; better hit rate |

First cold open after install may still compile; design for **good second-open** and for **small first-open** bundles.

### 3. Shell / first-paint snapshot (perceived load)

| Action | Intent |
|--------|--------|
| Ship a **thin shell HTML** (or prerendered frame) that paints structure before full App JS | First paint without waiting on the full graph |
| Keep **critical path** state in Host/Shell where appropriate; App hydrates | Less JS on the startup critical path |
| Defer non-critical App modules | Same as any web performance practice |

This is a **product** snapshot of UI readiness, not a V8 heap dump.

### 4. Build-time only (Bun on CI / developer machines)

| Action | Intent |
|--------|--------|
| Bundle App TS to browser JS for WebView | Devices never need Bun to parse TypeScript |
| Tree-shake, split, minify as release policy allows | Shrink layer C |
| Never encode “spawn `bun` on device” in static packaging | [Run modes](run-modes.md) |

### 5. Out of scope for App cold start

| Action | Why |
|--------|-----|
| Ship Bun inside the app to run UI | Product rule; dual engine |
| Custom full-heap V8 snapshot for page JS via system WebView | No embedder control |
| Move heavy work into Host TS **only** because a desktop Host is “fast” | Host is not the App engine; use T1.5 / Zig when measured ([ADR 0006](adr/0006-ts-first-capabilities.md), [ADR 0007](adr/0007-typescript-full-stack-host.md) D8) |

## Host plugins (separate path)

Privileged Host TS is **not** App load. If a platform embeds a JS engine for Host plugins:

- Prefer a **long-lived** Host process or embed and cheap script load (Workers-like density), not process-per-call.
- Engine startup snapshots or code caches may apply to **that** embed when Vela controls it.
- Mobile and static still must not require **Bun** specifically; backends stay pluggable ([ADR 0007](adr/0007-typescript-full-stack-host.md) D4–D5).

Do not fold Host plugin warm strategy into App WebView first-paint metrics without labeling both.

## Profiling checklist (hosts)

When optimizing “slow load,” capture a timeline with at least:

1. Shell process start  
2. WebView / environment create  
3. Preload inject complete  
4. First navigation / content commit  
5. First `window.vela` usable  
6. First meaningful paint (product-defined)  
7. Whether assets were cache hits (second launch comparison)

Assign each gap to layers **A / B / C** before changing packaging or runtimes.

## Acceptance implications

| Expectation | Mode |
|-------------|------|
| Static package runs App JS with **no Bun** on device | Required ([run modes](run-modes.md)) |
| Hosts document or implement **early WebView create + preload** for dogfood windows | Target for Shell spikes and Phase 2+ |
| Release asset layout preserves **stable identities** for engine caches | Packaging design |
| First-paint shell strategy is optional product polish, not a substitute for correct privilege boundaries | App authors |

Concrete host smoke gates remain in [testing and acceptance](testing-and-acceptance.md) as packaging and WebView lifecycle land.

## Related

- [Run modes](run-modes.md): instant vs static; Bun compile-only on the static path  
- [ADR 0007](adr/0007-typescript-full-stack-host.md): App vs Host, pluggable Host, D7/D8  
- [Technology stack](technology-stack.md): WebView and Host runtime choices  
- [Architecture](architecture.md): process split and trust boundaries  
- [Testing and acceptance](testing-and-acceptance.md): host gates  
- [Tauri comparison](research/tauri-comparison.md): system WebView mindset (not a runtime claim)
