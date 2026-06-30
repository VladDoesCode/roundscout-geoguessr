const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const capture = require("../src/capture-utils.js");

test("Classic ignores a stale game payload and saves the active round metrics", async () => {
  const listeners = new Map();
  const saved = [];
  const panel = { style: { display: "none" }, dataset: {}, innerText: "" };
  const resultMarker = {};
  const document = {
    body: { innerText: "Round 2", appendChild() {} },
    getElementById(id) { return id === "ggs-overlay-panel" ? panel : null; },
    querySelector(selector) { return selector.includes('data-qa="close-round-result"') ? resultMarker : null; },
    querySelectorAll() { return []; }
  };
  const location = {
    pathname: "/game/new-classic",
    href: "https://www.geoguessr.com/game/new-classic",
    origin: "https://www.geoguessr.com"
  };
  const window = {
    RoundScoutCapture: capture,
    RoundScoutCountryResolver: {
      countryCode: async () => "DE",
      region: async () => ({ name: "Baden-Württemberg" })
    },
    location,
    addEventListener(type, handler) { listeners.set(type, handler); },
    postMessage() {}
  };
  const chrome = {
    runtime: {
      id: "roundscout-test",
      lastError: null,
      sendMessage(message, callback) {
        if (message.type === "SAVE_ROUND") {
          saved.push(message.row);
          callback({ ok: true, row: message.row, total: saved.length });
        } else callback?.({ ok: true });
      }
    },
    storage: {
      local: {
        get(key, callback) { callback({ [key]: [] }); },
        set(_value, callback) { callback?.(); }
      }
    }
  };
  const context = vm.createContext({
    window,
    document,
    location,
    chrome,
    localStorage: { length: 0, key() { return null; }, getItem() { return null; } },
    fetch: async () => ({ ok: true, async json() { return { userId: "me", nick: "RoundScout Tester" }; } }),
    getComputedStyle: () => ({ display: "block", visibility: "visible", pointerEvents: "auto", opacity: "1" }),
    innerWidth: 1920,
    innerHeight: 1080,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
    URL,
    Intl,
    console
  });
  vm.runInContext(fs.readFileSync("src/content.js", "utf8"), context);

  const stale = {
    token: "old-classic",
    round: 2,
    rounds: [{}, { countryCode: "TH", lat: 15.8, lng: 100.9 }],
    player: { guesses: [{}, { roundNumber: 2, lat: 49.2, lng: 8.1, score: 0, distanceInMeters: 8460000 }] }
  };
  listeners.get("message")({
    source: window,
    data: { source: "GG_STUDY_PROBE", url: "https://www.geoguessr.com/api/v3/games/old-classic", payload: stale }
  });

  const current = {
    token: "new-classic",
    round: 2,
    currentRoundNumber: 2,
    rounds: [{}, { countryCode: "DE", lat: 48.5, lng: 8.5 }],
    player: { guesses: [{}, { roundNumber: 2, lat: 49.2, lng: 8.1, score: 3370, distanceInMeters: 589000 }] }
  };
  listeners.get("message")({
    source: window,
    data: { source: "GG_STUDY_PROBE", url: "https://www.geoguessr.com/api/v3/games/new-classic", payload: current }
  });
  await new Promise(resolve => setTimeout(resolve, 40));

  assert.equal(saved.length, 1);
  assert.equal(saved[0].gameId, "new-classic");
  assert.equal(saved[0].roundNumber, 2);
  assert.equal(saved[0].actualCode, "DE");
  assert.equal(saved[0].guessedCode, "DE");
  assert.equal(saved[0].score, 3370);
  assert.equal(saved[0].distance, 589000);
  assert.equal(saved[0].actualRegion, "Baden-Württemberg");
  assert.equal(saved[0].guessedRegion, "Baden-Württemberg");
});
