importScripts("guide-parser.js");

const guideCache = new Map();
const GUIDE_CACHE_KEY = "ggStudyVisualGuides";
const GUIDE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function cc(value) {
  return String(value || "").trim().toUpperCase();
}

function roundQuality(round) {
  return [
    round.actualCode,
    round.guessedCode,
    round.actualRegion,
    round.guessedRegion,
    round.distance,
    round.score,
    round.damage
  ].filter(Boolean).length;
}

function pickValue(primary, secondary, fallback = "") {
  return primary != null && primary !== "" ? primary : secondary != null && secondary !== "" ? secondary : fallback;
}

function pickNumber(primary, secondary) {
  return Number(primary) || Number(secondary) || 0;
}

function mergeRound(oldRound, newRound) {
  if (!oldRound) return newRound;
  const primary = roundQuality(newRound) >= roundQuality(oldRound) ? newRound : oldRound;
  const secondary = primary === newRound ? oldRound : newRound;
  return {
    ...secondary,
    ...primary,
    actualCode: pickValue(primary.actualCode, secondary.actualCode),
    guessedCode: pickValue(primary.guessedCode, secondary.guessedCode),
    actualRegion: pickValue(primary.actualRegion, secondary.actualRegion),
    guessedRegion: pickValue(primary.guessedRegion, secondary.guessedRegion),
    distance: pickNumber(primary.distance, secondary.distance),
    score: pickNumber(primary.score, secondary.score),
    damage: pickNumber(primary.damage, secondary.damage),
    timestamp: pickValue(primary.timestamp, secondary.timestamp, Date.now())
  };
}

function dedupeRounds(list) {
  const byId = new Map();
  for (const round of list) {
    const previous = byId.get(round.id);
    byId.set(round.id, !previous || roundQuality(round) >= roundQuality(previous) ? round : previous);
  }

  const result = [];
  const seen = new Map();
  for (const round of byId.values()) {
    const bucket = round.timestamp ? Math.floor(round.timestamp / 300000) : 0;
    const key = [
      round.mode,
      round.roundNumber,
      round.actualCode || "",
      round.guessedCode || "",
      round.score || 0,
      round.distance || 0,
      round.damage || 0,
      bucket
    ].join("|");
    const index = seen.get(key);
    if (index == null) {
      seen.set(key, result.length);
      result.push(round);
    } else if (roundQuality(round) > roundQuality(result[index])) {
      result[index] = round;
    }
  }
  return result;
}

function saveRound(row, sendResponse) {
  chrome.storage.local.get("ggStudyRounds", res => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }

    const list = Array.isArray(res.ggStudyRounds) ? res.ggStudyRounds : [];
    const old = list.find(item => item.id === row.id);
    const saved = mergeRound(old, row);
    if (old) Object.assign(old, saved);
    else list.push(saved);

    const cleaned = dedupeRounds(list);
    chrome.storage.local.set({ ggStudyRounds: cleaned }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true, row: saved, total: cleaned.length });
    });
  });
}

async function fetchPlonkitGuide(slug) {
  const clean = String(slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!clean) throw new Error("Invalid country guide");
  if (guideCache.has(clean)) return guideCache.get(clean);
  try {
    const stored = await chrome.storage.local.get(GUIDE_CACHE_KEY);
    const entry = stored?.[GUIDE_CACHE_KEY]?.[clean];
    if (entry?.guide && Date.now() - Number(entry.fetchedAt) < GUIDE_CACHE_TTL) {
      guideCache.set(clean, entry.guide);
      return entry.guide;
    }
  } catch (e) {}
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  let html;
  try {
    const response = await fetch(`https://www.plonkit.net/${clean}`, { credentials: "omit", signal: controller.signal });
    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }
  const guide = globalThis.RoundScoutGuideParser?.guideFromHtml(html, clean);
  if (!guide) throw new Error("Country guide unavailable");
  guideCache.set(clean, guide);
  try {
    const stored = await chrome.storage.local.get(GUIDE_CACHE_KEY);
    const cache = stored?.[GUIDE_CACHE_KEY] && typeof stored[GUIDE_CACHE_KEY] === "object" ? stored[GUIDE_CACHE_KEY] : {};
    cache[clean] = { fetchedAt: Date.now(), guide };
    await chrome.storage.local.set({ [GUIDE_CACHE_KEY]: cache });
  } catch (e) {}
  return guide;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_STATS_PAGE") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/stats.html") });
    sendResponse({ ok: true });
  } else if (message.type === "SAVE_ROUND") {
    const raw = message.row || {};
    const row = {
      id: raw.id || `${raw.gameId}_${raw.roundNumber}`,
      gameId: raw.gameId,
      roundNumber: raw.roundNumber,
      mode: raw.mode,
      actualCode: cc(raw.actualCode),
      guessedCode: cc(raw.guessedCode),
      actualRegion: raw.actualRegion || "",
      guessedRegion: raw.guessedRegion || "",
      distance: Math.round(raw.distance || 0),
      score: Math.round(raw.score || 0),
      damage: Math.round(raw.damage || 0),
      timestamp: raw.timestamp || Date.now()
    };
    saveRound(row, sendResponse);
    return true;
  } else if (message.type === "FETCH_MATCH_DETAILS") {
    fetch(message.url)
      .then(res => res.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // Keeps channel open for async response
  } else if (message.type === "FETCH_PLONKIT_GUIDE") {
    fetchPlonkitGuide(message.slug)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/stats.html") });
});
