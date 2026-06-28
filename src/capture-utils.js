((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RoundScoutCapture = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  function mergeObject(base, detail) {
    if (!base || typeof base !== "object") return detail;
    if (!detail || typeof detail !== "object") return base;
    const merged = { ...base };
    for (const [key, value] of Object.entries(detail)) {
      const old = merged[key];
      if (old && value && !Array.isArray(old) && !Array.isArray(value) && typeof old === "object" && typeof value === "object") {
        merged[key] = mergeObject(old, value);
      } else if (value != null && value !== "") {
        merged[key] = value;
      }
    }
    return merged;
  }

  function gameStates(root, out = [], seen = new Set(), depth = 0) {
    if (!root || typeof root !== "object" || seen.has(root) || depth > 5) return out;
    seen.add(root);
    if (Array.isArray(root.rounds) || Array.isArray(root.player?.guesses)) out.push(root);
    for (const key of ["data", "payload", "result", "game", "state", "currentGame"]) {
      gameStates(root[key], out, seen, depth + 1);
    }
    return out;
  }

  function selectClassic(primary, supplemental = [], submittedGuess = null) {
    const states = gameStates(primary);
    for (const item of supplemental) gameStates(item, states);
    if (!states.length && primary && typeof primary === "object") states.push(primary);

    const roundNumbers = [];
    for (const state of states) {
      for (const value of [state.round, state.currentRoundNumber, state.roundNumber, state.player?.guesses?.length]) {
        const number = Number(value);
        if (Number.isFinite(number) && number > 0) roundNumbers.push(number);
      }
    }
    const submittedRound = Number(submittedGuess?.roundNumber ?? submittedGuess?.round);
    if (Number.isFinite(submittedRound) && submittedRound > 0) roundNumbers.push(submittedRound);
    const roundNumber = Math.max(1, ...roundNumbers);
    const index = roundNumber - 1;
    let round = null;
    let guess = null;
    let token = "";
    let mode = "";

    for (const state of states) {
      token ||= String(state.token || state.gameToken || state.id || "");
      mode ||= String(state.mode || state.gameMode || "");
      round = mergeObject(round, state.rounds?.[index]);
      guess = mergeObject(guess, state.player?.guesses?.[index]);
    }
    guess = mergeObject(guess, submittedGuess);
    return { token, mode, roundNumber, index, round, guess };
  }

  function directGameId(value) {
    if (!value || typeof value !== "object") return "";
    for (const key of ["gameId", "duelId", "matchId", "token"]) {
      if (value[key] != null && typeof value[key] !== "object") return String(value[key]);
    }
    if (value.id != null && typeof value.id !== "object" && (Array.isArray(value.teams) || Array.isArray(value.rounds))) {
      return String(value.id);
    }
    return "";
  }

  function collectDuelFragments(root, activeId = "") {
    const result = { id: "", teams: [], rounds: [] };
    const seen = new Set();

    function walk(value, inheritedId = "", depth = 0) {
      if (!value || typeof value !== "object" || seen.has(value) || depth > 7) return;
      seen.add(value);
      const localId = directGameId(value) || inheritedId;
      if (activeId && localId && localId !== activeId) return;
      if (!result.id && localId) result.id = localId;
      if (Array.isArray(value.teams)) result.teams.push(value.teams);
      if (Array.isArray(value.rounds)) result.rounds.push(value.rounds);

      if (Array.isArray(value)) {
        value.forEach(child => walk(child, localId, depth + 1));
        return;
      }
      for (const child of Object.values(value)) {
        if (child && typeof child === "object") walk(child, localId, depth + 1);
      }
    }

    walk(root);
    return result;
  }

  return { collectDuelFragments, mergeObject, selectClassic };
});
