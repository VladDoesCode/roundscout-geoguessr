(() => {
  "use strict";

  if (window.__ggStudyProbeActive) return;
  window.__ggStudyProbeActive = true;

  const INTERESTING_URL = /geoguessr\.com|game-server\.geoguessr\.com/i;
  const INTERESTING_BODY = /round|duel|guess|score|health|damage|lat|lng|country|gameId|playerId|userId|teams|panorama/i;
  const DUEL_URL = /duel|multiplayer|game-server|gamehub|signalr|socket|hub/i;
  const traceTimes = new Map();

  function safePath(url) {
    try {
      const parsed = new URL(String(url || ""), location.href);
      return `${parsed.host}${parsed.pathname}`.slice(0, 180);
    } catch (e) {
      return String(url || "").split(/[?#]/)[0].slice(0, 180);
    }
  }

  function payloadShape(value) {
    if (!value || typeof value !== "object") return { type: typeof value };
    if (Array.isArray(value)) {
      return {
        type: "array",
        length: value.length,
        itemKeys: value[0] && typeof value[0] === "object" ? Object.keys(value[0]).slice(0, 24) : []
      };
    }
    const keys = Object.keys(value).slice(0, 32);
    const arrays = {};
    const labels = {};
    for (const key of keys) {
      const item = value[key];
      if (Array.isArray(item)) arrays[key] = item.length;
      if (/^(?:type|event|target|status|phase|state|method)$/i.test(key) && ["string", "number", "boolean"].includes(typeof item)) {
        labels[key] = String(item).slice(0, 60);
      }
    }
    return { type: "object", keys, arrays, labels };
  }

  function trace(event, data = {}, minInterval = 0, signature = "") {
    const key = `${event}|${signature || JSON.stringify(data).slice(0, 500)}`;
    const now = Date.now();
    if (minInterval && now - (traceTimes.get(key) || 0) < minInterval) return;
    traceTimes.set(key, now);
    window.postMessage({ source: "GG_STUDY_DIAGNOSTIC", event, data }, window.location.origin);
  }

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

  function flatten(value, out, depth = 0) {
    if (depth > 6 || value == null) return;
    if (typeof value === "string") {
      const text = value.trim();
      if (text[0] !== "{" && text[0] !== "[") return;
      try { flatten(JSON.parse(text), out, depth + 1); } catch (e) {}
      return;
    }
    if (typeof value !== "object") return;
    out.push(value);
    if (Array.isArray(value)) value.forEach(item => flatten(item, out, depth + 1));
    else if (Array.isArray(value.arguments)) value.arguments.forEach(item => flatten(item, out, depth + 1));
  }

  function inspect(url, raw, direction = "response", method = "", meta = {}) {
    const payloads = parsePayloads(raw).slice(0, 16);
    for (const payload of payloads) emit(url, payload, direction, method);
    if (payloads.length || DUEL_URL.test(String(url || ""))) {
      const path = safePath(url);
      trace("network", {
        transport: meta.transport || "unknown",
        direction,
        method,
        path,
        status: meta.status || 0,
        parsed: payloads.length,
        shapes: payloads.slice(0, 3).map(payloadShape)
      }, 5000, `${meta.transport}|${direction}|${method}|${path}|${payloads.map(item => Object.keys(item || {}).slice(0, 12).join(",")).join(";")}`);
    }
    return payloads;
  }

  function inspectBody(url, body, method) {
    if (body == null) return;
    if (typeof body === "string") {
      inspect(url, body, "request", method, { transport: "request" });
    } else if (body instanceof URLSearchParams) {
      inspect(url, body.toString(), "request", method, { transport: "request" });
    } else if (body instanceof FormData) {
      const value = {};
      body.forEach((item, key) => { value[key] = typeof item === "string" ? item : item.name; });
      emit(url, value, "request", method);
      trace("network", { transport: "form", direction: "request", method, path: safePath(url), parsed: 1, shapes: [payloadShape(value)] }, 2500, `form|${method}|${safePath(url)}`);
    } else if (body instanceof Blob) {
      body.text().then(text => inspect(url, text, "request", method, { transport: "blob" })).catch(() => {});
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
      try { inspect(url, await response.clone().text(), "response", method, { transport: "fetch", status: response.status }); } catch (e) {}
    }
    return response;
  };

  window.addEventListener("message", async event => {
    if (event.source !== window) return;
    if (event.data?.source === "GG_STUDY_DIAGNOSTIC_PING") {
      trace("probe-pong", { build: "1.12.0", path: location.pathname.slice(0, 120) });
      return;
    }
    if (event.data?.source !== "GG_STUDY_FETCH_REQUEST") return;
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
      trace("page-fetch", { path: safePath(url), ok: response.ok, status: response.status, shape: payloadShape(payload) }, 3000, `${safePath(url)}|${response.status}|${Object.keys(payload || {}).slice(0, 20).join(",")}`);
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
            if (INTERESTING_URL.test(this.__ggStudyUrl || "")) inspect(this.__ggStudyUrl, this.responseText, "response", this.__ggStudyMethod, { transport: "xhr", status: this.status });
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

    const inspectedEvents = new WeakSet();

    function inspectSocketData(socket, event, data) {
      if (event && inspectedEvents.has(event)) return;
      if (event) inspectedEvents.add(event);
      const url = socket?.url || "websocket";
      if (typeof data === "string") inspect(url, data, "response", "", { transport: "websocket" });
      else if (data instanceof Blob) data.text().then(text => inspect(url, text, "response", "", { transport: "websocket" })).catch(() => {});
      else if (data instanceof ArrayBuffer) inspect(url, new TextDecoder("utf-8").decode(data), "response", "", { transport: "websocket" });
      else if (ArrayBuffer.isView(data)) inspect(url, new TextDecoder("utf-8").decode(data), "response", "", { transport: "websocket" });
    }

    function observe(socket) {
      if (!socket || socket.__ggStudyObserved) return;
      try { Object.defineProperty(socket, "__ggStudyObserved", { value: true }); } catch (e) { socket.__ggStudyObserved = true; }
      nativeAdd.call(socket, "message", event => {
        inspectSocketData(socket, event, event.data);
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

    const NativeMessageEvent = window.MessageEvent;
    const nativeData = NativeMessageEvent?.prototype && Object.getOwnPropertyDescriptor(NativeMessageEvent.prototype, "data");
    if (nativeData?.get && nativeData.configurable && !window.__ggStudyMessageDataPatched) {
      window.__ggStudyMessageDataPatched = true;
      Object.defineProperty(NativeMessageEvent.prototype, "data", {
        configurable: true,
        enumerable: nativeData.enumerable,
        get() {
          const data = nativeData.get.call(this);
          const socket = this.currentTarget || this.target;
          if (socket instanceof NativeWebSocket) inspectSocketData(socket, this, data);
          return data;
        }
      });
    }
  }

  const NativeEventSource = window.EventSource;
  if (NativeEventSource?.prototype && !window.__ggStudyEventSourceProbePatched) {
    window.__ggStudyEventSourceProbePatched = true;
    const nativeAdd = NativeEventSource.prototype.addEventListener;
    const nativeOnMessage = Object.getOwnPropertyDescriptor(NativeEventSource.prototype, "onmessage");

    function observe(source) {
      if (!source || source.__ggStudyObserved) return;
      try { Object.defineProperty(source, "__ggStudyObserved", { value: true }); } catch (e) { source.__ggStudyObserved = true; }
      nativeAdd.call(source, "message", event => inspect(source.url || "eventsource", event.data, "response", "", { transport: "eventsource" }));
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

  const reactVersions = new Map();
  let reactAnchor = null;

  function normalizedDuelContext(value) {
    if (!value || typeof value !== "object") return null;
    const containers = [value.activeGame, value].filter(Boolean);
    for (const container of containers) {
      const game = container.game || container.duel || container.match || container.gameState || container.currentGame || container;
      if (!game || typeof game !== "object") continue;
      const teams = game.teams || game.gameTeams;
      const rounds = game.rounds || game.gameRounds || game.roundList;
      const id = game.gameId || game.duelId || game.matchId || game.id;
      if (!id || !Array.isArray(teams) || !Array.isArray(rounds)) continue;
      return {
        game: game.gameId === id && game.teams === teams && game.rounds === rounds ? game : { ...game, gameId: id, teams, rounds },
        derived: container.derivedProps || value.derivedProps || null
      };
    }
    return null;
  }

  function duelContext(value, seen = new WeakSet(), depth = 0) {
    if (!value || typeof value !== "object" || seen.has(value) || depth > 7 || value.nodeType) return null;
    seen.add(value);
    const direct = normalizedDuelContext(value);
    if (direct) return direct;

    const preferred = [
      value.activeGame,
      value.value,
      value.memoizedState,
      value.baseState,
      value.lastRenderedState,
      value.state,
      value.data,
      value.payload
    ];
    for (const child of preferred) {
      const found = duelContext(child, seen, depth + 1);
      if (found) return found;
    }
    if (depth < 4) {
      for (const child of Object.values(value).slice(0, 80)) {
        const found = duelContext(child, seen, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function inspectFiber(fiber) {
    const seenFibers = new Set();
    for (let current = fiber, depth = 0; current && depth < 45 && !seenFibers.has(current); current = current.return, depth += 1) {
      seenFibers.add(current);
      for (const value of [current.memoizedProps, current.pendingProps, current.memoizedState]) {
        const found = duelContext(value);
        if (found) return found;
      }
      let hook = current.memoizedState;
      for (let index = 0; hook && typeof hook === "object" && index < 30; hook = hook.next, index += 1) {
        const found = duelContext(hook.memoizedState) || duelContext(hook.baseState) || duelContext(hook.queue?.lastRenderedState);
        if (found) return found;
      }
    }
    return null;
  }

  function stateHint(value, prefix, hints) {
    if (!value || typeof value !== "object" || hints.length >= 24) return;
    const keys = Object.keys(value).filter(key => /game|duel|match|round|team|player|guess|result|score|health/i.test(key)).slice(0, 12);
    if (!keys.length) return;
    hints.push(`${prefix}:${keys.map(key => `${key}${Array.isArray(value[key]) ? `[${value[key].length}]` : ""}`).join(",")}`.slice(0, 220));
  }

  function inspectFiberTree(root, stats) {
    const start = root?.current || root?._internalRoot?.current || root;
    if (!start || typeof start !== "object") return null;
    const stack = [start];
    const seen = new Set();
    const began = performance.now();
    while (stack.length && stats.fibers < 9000 && performance.now() - began < 35) {
      const fiber = stack.pop();
      if (!fiber || typeof fiber !== "object" || seen.has(fiber)) continue;
      seen.add(fiber);
      stats.fibers += 1;
      for (const [name, value] of [["props", fiber.memoizedProps], ["pending", fiber.pendingProps], ["state", fiber.memoizedState]]) {
        stateHint(value, name, stats.hints);
        const found = duelContext(value);
        if (found) return found;
      }
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
    stats.elapsedMs = Math.max(stats.elapsedMs, Math.round(performance.now() - began));
    return null;
  }

  function reactDuelSnapshot(context) {
    const game = context?.game;
    if (!game) return null;
    const derived = context.derived || {};
    const snapshot = {
      gameId: game.gameId,
      teams: game.teams,
      rounds: game.rounds,
      currentRoundNumber: game.currentRoundNumber,
      status: game.status,
      options: game.options,
      result: game.result,
      currentPlayer: derived.currentPlayer,
      playerTeam: derived.playerTeam,
      opponentTeam: derived.opponentTeam
    };
    try { return JSON.parse(JSON.stringify(snapshot)); } catch (e) { return null; }
  }

  function reactDuelVersion(snapshot) {
    const teamProgress = (snapshot.teams || []).map(team => [
      team.id,
      (team.roundResults || []).length,
      (team.roundResults || []).at(-1)?.score,
      (team.players || []).map(player => [player.playerId, (player.guesses || []).length, (player.guesses || []).at(-1)?.score])
    ]);
    return JSON.stringify([snapshot.currentRoundNumber, snapshot.status, snapshot.rounds?.length, teamProgress]);
  }

  function scanReactDuelState() {
    if (!/\/(?:multiplayer|duels?|team-duels)(?:\/|$)/i.test(location.pathname)) return;
    const stats = { elements: 0, reactHosts: 0, fibers: 0, elapsedMs: 0, hints: [] };
    const elements = [...new Set([
      reactAnchor?.isConnected === false ? null : reactAnchor,
      document.getElementById("__next"),
      ...document.querySelectorAll('[class*="duel" i], [class*="round" i], [class*="game" i], [class*="result" i], [data-qa]')
    ].filter(Boolean))].slice(0, 300);

    try {
      for (const element of elements) {
        stats.elements += 1;
        let context = null;
        for (const key of Object.getOwnPropertyNames(element)) {
          if (!key.startsWith("__react")) continue;
          stats.reactHosts += 1;
          if (key.startsWith("__reactProps$")) context = duelContext(element[key]);
          else if (key.startsWith("__reactContainer$")) context = inspectFiberTree(element[key], stats) || inspectFiber(element[key]);
          else if (key.startsWith("__reactFiber$")) context = inspectFiber(element[key]) || inspectFiberTree(element[key], stats);
          if (context) break;
        }
        const snapshot = reactDuelSnapshot(context);
        if (!snapshot?.gameId) continue;
        reactAnchor = element;
        const version = reactDuelVersion(snapshot);
        if (reactVersions.get(snapshot.gameId) === version) return;
        reactVersions.set(snapshot.gameId, version);
        trace("react-hit", {
          game: String(snapshot.gameId).slice(-10),
          currentRound: snapshot.currentRoundNumber || 0,
          status: String(snapshot.status || "").slice(0, 50),
          teams: snapshot.teams?.length || 0,
          rounds: snapshot.rounds?.length || 0,
          teamResults: (snapshot.teams || []).map(team => (team.roundResults || team.results || []).length),
          playerGuesses: (snapshot.teams || []).map(team => (team.players || []).map(player => (player.guesses || []).length)),
          scan: stats
        });
        emit("react://duel-state", snapshot);
        return;
      }
      trace("react-miss", { path: location.pathname.slice(0, 120), ...stats }, 5000, `${location.pathname}|${stats.reactHosts}|${stats.fibers}|${stats.hints.join(";")}`);
    } catch (e) {
      trace("react-error", { name: e?.name || "Error", message: String(e?.message || e).slice(0, 180), ...stats }, 5000);
    }
  }

  setInterval(scanReactDuelState, 700);
  trace("probe-boot", {
    build: "1.12.0",
    path: location.pathname.slice(0, 120),
    fetch: typeof window.fetch === "function",
    xhr: Boolean(window.XMLHttpRequest),
    websocket: Boolean(window.WebSocket),
    eventSource: Boolean(window.EventSource)
  });
})();
