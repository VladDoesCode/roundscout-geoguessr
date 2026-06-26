(() => {
  "use strict";

  if (window.__ggStudyProbeActive) return;
  window.__ggStudyProbeActive = true;

  const INTERESTING_URL = /geoguessr\.com|game-server\.geoguessr\.com/i;
  const INTERESTING_BODY = /round|duel|guess|score|health|damage|lat|lng|country|gameId|playerId|userId|teams|panorama/i;

  function emit(url, payload) {
    if (!interesting(payload)) return;
    window.postMessage({ source: "GG_STUDY_PROBE", url: String(url || ""), payload }, window.location.origin);
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

  function inspect(url, raw) {
    for (const payload of parsePayloads(raw).slice(0, 16)) emit(url, payload);
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
    const response = await nativeFetch.apply(this, args);
    const url = fullUrl(args[0]);
    if (INTERESTING_URL.test(url)) {
      try { inspect(url, await response.clone().text()); } catch (e) {}
    }
    return response;
  };

  const NativeXHR = window.XMLHttpRequest;
  if (NativeXHR?.prototype && !window.__ggStudyXhrProbePatched) {
    window.__ggStudyXhrProbePatched = true;
    const nativeOpen = NativeXHR.prototype.open;
    const nativeSend = NativeXHR.prototype.send;

    NativeXHR.prototype.open = function patchedOpen(method, url) {
      this.__ggStudyUrl = fullUrl(url);
      return nativeOpen.apply(this, arguments);
    };

    NativeXHR.prototype.send = function patchedSend() {
      try {
        this.addEventListener("load", function onLoad() {
          if (INTERESTING_URL.test(this.__ggStudyUrl || "")) inspect(this.__ggStudyUrl, this.responseText);
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
