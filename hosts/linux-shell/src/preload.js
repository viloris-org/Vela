/**
 * Phase 1L preload subset for hosts/linux-shell.
 * Message-pass only via window.webkit.messageHandlers.vela.
 * Host injects this at document-start; must not assume Node.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.vela) return;

  const handlers = new Map();

  function post(msg) {
    try {
      if (
        window.webkit &&
        window.webkit.messageHandlers &&
        window.webkit.messageHandlers.vela
      ) {
        window.webkit.messageHandlers.vela.postMessage(msg);
      }
    } catch (e) {
      console.warn("[vela preload] postMessage failed", e);
    }
  }

  function request(method, args) {
    const id =
      "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        handlers.delete(id);
        reject(new Error("vela bridge timeout: " + method));
      }, 8000);
      handlers.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
      post({ type: "req", id, method, args: args === undefined ? null : args });
    });
  }

  // Host → page replies and events
  window.__velaHostDispatch = function (payload) {
    try {
      const msg = typeof payload === "string" ? JSON.parse(payload) : payload;
      if (msg && msg.type === "res" && msg.id && handlers.has(msg.id)) {
        const h = handlers.get(msg.id);
        handlers.delete(msg.id);
        if (msg.ok) h.resolve(msg.result);
        else
          h.reject(
            Object.assign(new Error(msg.error && msg.error.message
              ? msg.error.message
              : "denied"), { code: msg.error && msg.error.code }),
          );
        return;
      }
      if (msg && msg.type === "event" && msg.channel) {
        const set = eventSubs.get(msg.channel);
        if (set) {
          for (const fn of set) {
            try {
              fn(msg.payload);
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.warn("[vela preload] host dispatch failed", e);
    }
  };

  const eventSubs = new Map();

  window.vela = {
    version: "0.0.1-linux-shell",

    call(method, args) {
      return request("call", { method, args });
    },

    layers: {
      insert(spec) {
        return request("layers.insert", spec);
      },
      update(id, patch) {
        return request("layers.update", { id, patch });
      },
      remove(id) {
        return request("layers.remove", { id });
      },
    },

    hit: {
      setOpaqueRegions(update) {
        post({ type: "hit.setOpaqueRegions", update });
      },
      setMainOpaqueRegions(region) {
        post({ type: "hit.setMainOpaqueRegions", region });
      },
    },

    events: {
      subscribe(channel, handler) {
        if (!eventSubs.has(channel)) eventSubs.set(channel, new Set());
        eventSubs.get(channel).add(handler);
        return () => {
          const set = eventSubs.get(channel);
          if (set) set.delete(handler);
        };
      },
    },
  };

  console.info("[vela] preload bridge installed", window.vela.version);
})();
