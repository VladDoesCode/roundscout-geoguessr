(() => {
  "use strict";

  if (window.__ggStudyProbeActive) return;
  window.__ggStudyProbeActive = true;

  const INTERESTING_URL = /geoguessr\.com|game-server\.geoguessr\.com/i;
  const INTERESTING_BODY = /round|duel|guess|score|health|damage|lat|lng|country|gameId|playerId|userId|teams|panorama/i;

  function emit(url, payload, direction = "response", method = "") {
    if (!interesting(payload)) return;
    window.postMessage({ source: "GG_STUDY_PROBE", url: String(url || ""), direction, method, payload }, window.location.origin);
  }

  function interesting(payload) {
    try {
      return payload && INTERESTING_BODY.test(JSON.stringify(payload).slice(0, 8000));
    } catch (e) {
      return false;
    }
  }

  function parsePayloads(raw) {
    const text = typeof raw === "string" ? raw : String(raw || "");
    const out = [];
    const seen = new Set();

    for (const segment of text.split(/\x1e/)) {
      const trimmed = segment.trim();
      if (!trimmed) continue;

      const starts = [0, trimmed.indexOf("{"), trimmed.indexOf("[")]
        .filter(index => index >= 0)
        .sort((a, b) => a - b);

      for (const start of starts) {
        const candidate = trimmed.slice(start);
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);

        try {
          flatten(JSON.parse(candidate), out);
        } catch (e) {}
      }
    }

    return out;
  }

  function flatten(value, out) {
    if (!value || typeof value !== "object") return;
    out.push(value);
    if (Array.isArray(value)) value.forEach(item => flatten(item, out));
    else if (Array.isArray(value.arguments)) value.arguments.forEach(item => flatten(item, out));
  }

  function inspect(url, raw, direction = "response", method = "") {
    for (const payload of parsePayloads(raw).slice(0, 16)) emit(url, payload, direction, method);
  }

  function inspectBody(url, body, method) {
    if (body == null) return;
    if (typeof body === "string") {
      inspect(url, body, "request", method);
    } else if (body instanceof URLSearchParams) {
      inspect(url, body.toString(), "request", method);
    } else if (body instanceof FormData) {
      const value = {};
      body.forEach((item, key) => { value[key] = typeof item === "string" ? item : item.name; });
      emit(url, value, "request", method);
    } else if (body instanceof Blob) {
      body.text().then(text => inspect(url, text, "request", method)).catch(() => {});
    }
  }

  function fullUrl(input) {
    try {
      const raw = input?.url || String(input || "");
      return new URL(raw, location.href).href;
    } catch (e) {
      return String(input?.url || input || "");
    }
  }

  const nativeFetch = window.fetch;
  window.fetch = async function patchedFetch(...args) {
    const url = fullUrl(args[0]);
    const method = String(args[1]?.method || args[0]?.method || "GET").toUpperCase();
    if (INTERESTING_URL.test(url)) {
      const body = args[1]?.body;
      if (body != null) inspectBody(url, body, method);
      else if (typeof Request !== "undefined" && args[0] instanceof Request) {
        try { args[0].clone().text().then(text => inspect(url, text, "request", method)).catch(() => {}); } catch (e) {}
      }
    }
    const response = await nativeFetch.apply(this, args);
    if (INTERESTING_URL.test(url)) {
      try { inspect(url, await response.clone().text(), "response", method); } catch (e) {}
    }
    return response;
  };

  window.addEventListener("message", async event => {
    if (event.source !== window || event.data?.source !== "GG_STUDY_FETCH_REQUEST") return;
    const requestId = String(event.data.requestId || "");
    const url = fullUrl(event.data.url);
    if (!requestId || !/^https:\/\/(?:www\.)?geoguessr\.com\/|^https:\/\/game-server\.geoguessr\.com\//i.test(url)) return;
    try {
      const response = await nativeFetch.call(window, url, {
        credentials: "include",
        headers: { Accept: "application/json", "X-Client": "web" }
      });
      const text = await response.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch (e) {}
      window.postMessage({ source: "GG_STUDY_FETCH_RESULT", requestId, ok: response.ok, status: response.status, payload }, window.location.origin);
    } catch (error) {
      window.postMessage({ source: "GG_STUDY_FETCH_RESULT", requestId, ok: false, error: String(error?.message || error) }, window.location.origin);
    }
  });

  const NativeXHR = window.XMLHttpRequest;
  if (NativeXHR?.prototype && !window.__ggStudyXhrProbePatched) {
    window.__ggStudyXhrProbePatched = true;
    const nativeOpen = NativeXHR.prototype.open;
    const nativeSend = NativeXHR.prototype.send;

    NativeXHR.prototype.open = function patchedOpen(method, url) {
      this.__ggStudyUrl = fullUrl(url);
      this.__ggStudyMethod = String(method || "GET").toUpperCase();
      return nativeOpen.apply(this, arguments);
    };

    NativeXHR.prototype.send = function patchedSend(body) {
      try {
        if (INTERESTING_URL.test(this.__ggStudyUrl || "")) inspectBody(this.__ggStudyUrl, body, this.__ggStudyMethod);
        this.addEventListener("load", function onLoad() {
          try {
            if (INTERESTING_URL.test(this.__ggStudyUrl || "")) inspect(this.__ggStudyUrl, this.responseText, "response", this.__ggStudyMethod);
          } catch (e) {}
        });
      } catch (e) {}
      return nativeSend.apply(this, arguments);
    };
  }

  const NativeWebSocket = window.WebSocket;
  if (NativeWebSocket?.prototype && !window.__ggStudySocketProbePatched) {
    window.__ggStudySocketProbePatched = true;
    const nativeAdd = NativeWebSocket.prototype.addEventListener;
    const nativeOnMessage = Object.getOwnPropertyDescriptor(NativeWebSocket.prototype, "onmessage");

    function observe(socket) {
      if (!socket || socket.__ggStudyObserved) return;
      try { Object.defineProperty(socket, "__ggStudyObserved", { value: true }); } catch (e) { socket.__ggStudyObserved = true; }
      nativeAdd.call(socket, "message", event => {
        const data = event.data;
        if (typeof data === "string") inspect(socket.url || "websocket", data);
        else if (data instanceof Blob) data.text().then(text => inspect(socket.url || "websocket", text)).catch(() => {});
        else if (data instanceof ArrayBuffer) inspect(socket.url || "websocket", new TextDecoder("utf-8").decode(data));
      });
    }

    NativeWebSocket.prototype.addEventListener = function patchedAdd(type) {
      if (String(type).toLowerCase() === "message") observe(this);
      return nativeAdd.apply(this, arguments);
    };

    Object.defineProperty(NativeWebSocket.prototype, "onmessage", {
      configurable: true,
      enumerable: nativeOnMessage ? nativeOnMessage.enumerable : true,
      get() { return nativeOnMessage?.get ? nativeOnMessage.get.call(this) : this.__ggStudyOnMessage; },
      set(handler) {
        observe(this);
        if (nativeOnMessage?.set) nativeOnMessage.set.call(this, handler);
        else this.__ggStudyOnMessage = handler;
      }
    });
  }

  const NativeEventSource = window.EventSource;
  if (NativeEventSource?.prototype && !window.__ggStudyEventSourceProbePatched) {
    window.__ggStudyEventSourceProbePatched = true;
    const nativeAdd = NativeEventSource.prototype.addEventListener;
    const nativeOnMessage = Object.getOwnPropertyDescriptor(NativeEventSource.prototype, "onmessage");

    function observe(source) {
      if (!source || source.__ggStudyObserved) return;
      try { Object.defineProperty(source, "__ggStudyObserved", { value: true }); } catch (e) { source.__ggStudyObserved = true; }
      nativeAdd.call(source, "message", event => inspect(source.url || "eventsource", event.data));
    }

    NativeEventSource.prototype.addEventListener = function patchedEventSourceAdd(type) {
      if (String(type).toLowerCase() === "message") observe(this);
      return nativeAdd.apply(this, arguments);
    };

    Object.defineProperty(NativeEventSource.prototype, "onmessage", {
      configurable: true,
      enumerable: nativeOnMessage ? nativeOnMessage.enumerable : true,
      get() { return nativeOnMessage?.get ? nativeOnMessage.get.call(this) : this.__ggStudyOnMessage; },
      set(handler) {
        observe(this);
        if (nativeOnMessage?.set) nativeOnMessage.set.call(this, handler);
        else this.__ggStudyOnMessage = handler;
      }
    });
  }
})();
