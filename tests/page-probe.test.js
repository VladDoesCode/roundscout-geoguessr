const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadProbe() {
  const listeners = new Map();
  const messages = [];
  const requests = [];
  const response = body => ({ ok: true, status: 200, clone() { return response(body); }, async text() { return body; } });
  const nativeFetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return response(JSON.stringify({ gameId: "duel-1", rounds: [] }));
  };

  class MockTransport {
    addEventListener() {}
  }
  class MockXHR extends MockTransport {
    open() {}
    send() {}
  }
  const location = { href: "https://www.geoguessr.com/multiplayer", origin: "https://www.geoguessr.com" };
  const window = {
    location,
    fetch: nativeFetch,
    XMLHttpRequest: MockXHR,
    WebSocket: MockTransport,
    EventSource: MockTransport,
    addEventListener(type, handler) { listeners.set(type, handler); },
    postMessage(data) { messages.push(data); }
  };
  const context = vm.createContext({
    window,
    location,
    URL,
    URLSearchParams,
    Request,
    Blob,
    FormData,
    TextDecoder,
    console,
    setTimeout,
    clearTimeout
  });
  vm.runInContext(fs.readFileSync("src/page-probe.js", "utf8"), context);
  return { window, listeners, messages, requests };
}

test("page probe captures an outbound guess without touching WebSocket.send", async () => {
  const probe = loadProbe();
  await probe.window.fetch("https://www.geoguessr.com/api/v3/games/classic-1", {
    method: "POST",
    body: JSON.stringify({ lat: -27.47, lng: 153.03, roundNumber: 2 })
  });

  const message = probe.messages.find(item => item.source === "GG_STUDY_PROBE" && item.direction === "request");
  assert.equal(message.method, "POST");
  assert.equal(message.payload.roundNumber, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(probe.window.WebSocket.prototype, "send"), false);
});

test("page probe performs authenticated result reads in the page session", async () => {
  const probe = loadProbe();
  await probe.listeners.get("message")({
    source: probe.window,
    data: {
      source: "GG_STUDY_FETCH_REQUEST",
      requestId: "request-1",
      url: "https://game-server.geoguessr.com/api/duels/duel-1"
    }
  });

  const request = probe.requests.at(-1);
  assert.equal(request.options.credentials, "include");
  assert.equal(request.options.headers["X-Client"], "web");
  const result = probe.messages.find(item => item.source === "GG_STUDY_FETCH_RESULT");
  assert.equal(result.ok, true);
  assert.equal(result.payload.gameId, "duel-1");
});
