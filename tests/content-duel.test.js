const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const capture = require("../src/capture-utils.js");

test("a multi-round React Duel keeps each guess scoped and reaches SAVE_ROUND", async () => {
  const listeners = new Map();
  const saved = [];
  const guessButton = {
    disabled: false,
    textContent: "Guess",
    getAttribute() { return null; },
    getBoundingClientRect() { return { left: 10, top: 10, right: 110, bottom: 50, width: 100, height: 40 }; },
    matches() { return true; },
    contains(node) { return node === this; }
  };
  const document = {
    body: { innerText: "", appendChild() {} },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector.includes("guess") || selector.includes("button") ? [guessButton] : []; },
    elementFromPoint() { return guessButton; }
  };
  const location = { pathname: "/multiplayer", href: "https://www.geoguessr.com/multiplayer", origin: "https://www.geoguessr.com" };
  const window = {
    RoundScoutCapture: capture,
    RoundScoutCountryResolver: {
      countryCode: async point => point.lat > 49 ? "BE" : "FR",
      region: async (_point, country) => ({ name: country === "BE" ? "Wallonia" : "Grand Est" })
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
          callback({ ok: true, row: message.row });
        } else callback?.({ ok: true });
      }
    },
    storage: {
      local: {
        get(key, callback) { callback({ [key]: [] }); },
        set(value, callback) { callback?.(); }
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

  const snapshot = {
    gameId: "duel-e2e",
    currentRoundNumber: 1,
    status: "Started",
    currentPlayer: { playerId: "me" },
    teams: [
      {
        id: "blue",
        players: [{ playerId: "me", guesses: [
          { roundNumber: 1, lat: 50.5, lng: 4.2, score: 4200, distance: 580105 },
          { roundNumber: 2, lat: 40.5, lng: 2.2, score: 3000, distance: 7563 }
        ] }],
        roundResults: [{ roundNumber: 1, score: 4200 }, { roundNumber: 2, score: 3000 }]
      },
      {
        id: "red",
        players: [{ playerId: "opponent", guesses: [
          { roundNumber: 1, lat: 46.5, lng: 2.2, score: 3500 },
          { roundNumber: 2, lat: 51.5, lng: 4.5, score: 2500 }
        ] }],
        roundResults: [{ roundNumber: 1, score: 3500 }, { roundNumber: 2, score: 2500 }]
      }
    ],
    rounds: [
      { roundNumber: 1, panorama: { lat: 48.5, lng: 2.3, countryCode: "fr" } },
      { roundNumber: 2, panorama: { lat: 52.5, lng: 4.3, countryCode: "be" } }
    ]
  };
  listeners.get("message")({ source: window, data: { source: "GG_STUDY_PROBE", url: "react://duel-state", payload: snapshot } });
  await new Promise(resolve => setTimeout(resolve, 30));

  assert.equal(saved.length, 2);
  assert.equal(saved[0].gameId, "duel-e2e");
  assert.equal(saved[0].actualCode, "FR");
  assert.equal(saved[0].guessedCode, "BE");
  assert.equal(saved[0].score, 4200);
  assert.equal(saved[0].damage, 700);
  assert.equal(saved[0].actualRegion, "Grand Est");
  assert.equal(saved[0].guessedRegion, "Wallonia");
  assert.equal(saved[1].roundNumber, 2);
  assert.equal(saved[1].actualCode, "BE");
  assert.equal(saved[1].guessedCode, "FR");
  assert.equal(saved[1].score, 3000);
  assert.equal(saved[1].damage, 500);
  assert.equal(saved[1].actualRegion, "Wallonia");
  assert.equal(saved[1].guessedRegion, "Grand Est");
});
