const test = require("node:test");
const assert = require("node:assert/strict");
const capture = require("../src/capture-utils.js");

test("Classic capture joins a score-only result to the submitted map pin", () => {
  const result = capture.selectClassic({
    token: "classic-1",
    round: 2,
    rounds: [{}, { lat: -33.86, lng: 151.21 }],
    player: { guesses: [{}, { score: 3044, distanceInMeters: 740000 }] }
  }, [], { lat: -27.47, lng: 153.03, roundNumber: 2 });

  assert.equal(result.roundNumber, 2);
  assert.equal(result.guess.score, 3044);
  assert.equal(result.guess.lat, -27.47);
  assert.equal(result.guess.lng, 153.03);
});

test("Classic capture prefers richer authenticated result details", () => {
  const result = capture.selectClassic({
    token: "classic-2",
    currentRoundNumber: 1,
    rounds: [{ lat: 48.2, lng: 16.37 }],
    player: { guesses: [{ score: 4100 }] }
  }, [{
    token: "classic-2",
    round: 1,
    rounds: [{ countryCode: "AT" }],
    player: { guesses: [{ lat: 47.8, lng: 13.04, distanceInMeters: 210000 }] }
  }]);

  assert.equal(result.round.countryCode, "AT");
  assert.equal(result.guess.score, 4100);
  assert.equal(result.guess.lat, 47.8);
});

test("Duel capture accepts teams and rounds arriving in separate messages", () => {
  const teams = capture.collectDuelFragments({ gameId: "duel-1", data: { teams: [{ id: "mine" }] } }, "duel-1");
  const rounds = capture.collectDuelFragments({ gameId: "duel-1", payload: { rounds: [{ roundNumber: 1 }] } }, "duel-1");

  assert.equal(teams.id, "duel-1");
  assert.deepEqual(teams.teams[0], [{ id: "mine" }]);
  assert.deepEqual(rounds.rounds[0], [{ roundNumber: 1 }]);
});

test("Duel capture rejects fragments from a stale match", () => {
  const result = capture.collectDuelFragments({ gameId: "old-duel", teams: [{ id: "old" }] }, "new-duel");
  assert.deepEqual(result.teams, []);
  assert.equal(result.id, "");
});

test("Duel capture ignores match ids found only in competitive metadata", () => {
  const result = capture.collectDuelFragments({
    currentSet: { completedSets: [{ latestGameId: "old-match" }], games: [{ gameId: "old-match" }] }
  });

  assert.equal(result.id, "");
  assert.deepEqual(result.teams, []);
  assert.deepEqual(result.rounds, []);
});

test("Duel capture preserves separately stored round score and player pin", () => {
  const result = capture.collectDuelFragments({
    gameId: "duel-live",
    teams: [{
      players: [{ playerId: "me", pin: { lat: 41.01, lng: 28.97 } }],
      roundResults: [{ roundNumber: 1, score: 4200 }]
    }],
    rounds: [{ roundNumber: 1, panorama: { lat: 40.9, lng: 29.1 } }]
  }, "duel-live");

  assert.equal(result.teams[0][0].players[0].pin.lat, 41.01);
  assert.equal(result.teams[0][0].roundResults[0].score, 4200);
  assert.equal(result.rounds[0][0].panorama.lng, 29.1);
});

test("Duel lifecycle detects the next active round before stale result markup disappears", () => {
  const teams = [
    { roundResults: [{ roundNumber: 1, score: 4200 }] },
    { roundResults: [{ roundNumber: 1, score: 3900 }] }
  ];

  assert.equal(capture.duelRoundInProgress(1, teams), false);
  assert.equal(capture.duelRoundInProgress(2, teams), true);
  teams[0].roundResults.push({ roundNumber: 2, score: 3500 });
  teams[1].roundResults.push({ roundNumber: 2, score: 3600 });
  assert.equal(capture.duelRoundInProgress(2, teams), false);
});

test("Duel payload driver does not leak fragment locals into another function", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync("src/content.js", "utf8");
  const start = source.indexOf("async function processPayload");
  const end = source.indexOf("async function syncClassicHistory", start);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /\b(?:fragments|snapshots)\b/);
});
