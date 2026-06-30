const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadProbe() {
  const listeners = new Map();
  const messages = [];
  const requests = [];
  const intervals = [];
  const elements = [];
  const response = body => ({ ok: true, status: 200, clone() { return response(body); }, async text() { return body; } });
  const nativeFetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return response(JSON.stringify({ gameId: "duel-1", rounds: [] }));
  };

  class MockTransport {
    constructor() { this.url = "wss://game-server.geoguessr.com/hub"; }
    addEventListener() {}
  }
  class MockMessageEvent {
    constructor(data, target) {
      this._data = data;
      this.target = target;
      this.currentTarget = target;
    }
  }
  Object.defineProperty(MockMessageEvent.prototype, "data", {
    configurable: true,
    enumerable: true,
    get() { return this._data; }
  });
  class MockXHR extends MockTransport {
    open() {}
    send() {}
  }
  const location = { href: "https://www.geoguessr.com/multiplayer", origin: "https://www.geoguessr.com" };
  location.pathname = "/multiplayer";
  const document = {
    getElementById() { return null; },
    querySelectorAll() { return elements; }
  };
  const window = {
    location,
    fetch: nativeFetch,
    XMLHttpRequest: MockXHR,
    WebSocket: MockTransport,
    EventSource: MockTransport,
    MessageEvent: MockMessageEvent,
    addEventListener(type, handler) { listeners.set(type, handler); },
    postMessage(data) { messages.push(data); }
  };
  const context = vm.createContext({
    window,
    document,
    location,
    URL,
    URLSearchParams,
    Request,
    Blob,
    FormData,
    TextDecoder,
    performance,
    console,
    setTimeout,
    clearTimeout,
    setInterval(handler) { intervals.push(handler); return intervals.length; },
    clearInterval() {}
  });
  vm.runInContext(fs.readFileSync("src/page-probe.js", "utf8"), context);
  return { window, listeners, messages, requests, intervals, elements };
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

test("page probe sees Duel messages when the app reads MessageEvent.data directly", () => {
  const probe = loadProbe();
  const socket = new probe.window.WebSocket();
  const nested = JSON.stringify({ code: "DuelRoundFinished", gameId: "duel-2", duel: { state: { teams: [], rounds: [] } } });
  const event = new probe.window.MessageEvent(JSON.stringify({ type: 1, arguments: [nested] }) + "\x1e", socket);

  void event.data;

  const result = probe.messages.find(item => item.source === "GG_STUDY_PROBE" && item.payload?.code === "DuelRoundFinished");
  assert.equal(result.payload.gameId, "duel-2");
  assert.equal(Object.prototype.hasOwnProperty.call(probe.window.WebSocket.prototype, "send"), false);
});

test("page probe extracts the live Duel from React state without network hooks", () => {
  const probe = loadProbe();
  const activeGame = {
    game: {
      gameId: "duel-react",
      currentRoundNumber: 2,
      status: "Started",
      options: { isTeamDuels: false },
      teams: [{ id: "blue", players: [{ playerId: "me", guesses: [{ roundNumber: 2, lat: 1, lng: 2, score: 4100 }] }], roundResults: [{ roundNumber: 2, score: 4100 }] }],
      rounds: [{ roundNumber: 2, panorama: { lat: 3, lng: 4, countryCode: "fr" } }]
    },
    derivedProps: { currentPlayer: { playerId: "me" } }
  };
  const element = {};
  element["__reactFiber$roundscout"] = { memoizedProps: null, pendingProps: null, memoizedState: { memoizedState: activeGame, next: null }, return: null };
  probe.elements.push(element);

  probe.intervals.at(-1)();

  const result = probe.messages.find(item => item.url === "react://duel-state");
  assert.equal(result.payload.gameId, "duel-react");
  assert.equal(result.payload.currentPlayer.playerId, "me");
  assert.equal(result.payload.teams[0].players[0].guesses[0].score, 4100);
});

test("page probe walks down from the React root after multiplayer UI class changes", () => {
  const probe = loadProbe();
  const game = {
    gameId: "duel-root-tree",
    currentRoundNumber: 3,
    status: "Started",
    teams: [{ id: "one", players: [], roundResults: [] }, { id: "two", players: [], roundResults: [] }],
    rounds: [{ roundNumber: 3, panorama: { countryCode: "ca" } }]
  };
  const child = { memoizedProps: { activeGame: { game, derivedProps: { currentPlayer: { playerId: "me" } } } }, pendingProps: null, memoizedState: null, child: null, sibling: null };
  const root = { memoizedProps: null, pendingProps: null, memoizedState: null, child, sibling: null };
  const element = {};
  element["__reactContainer$roundscout"] = root;
  probe.elements.push(element);

  probe.intervals.at(-1)();

  const result = probe.messages.find(item => item.url === "react://duel-state");
  assert.equal(result.payload.gameId, "duel-root-tree");
  assert.equal(result.payload.currentRoundNumber, 3);
});
