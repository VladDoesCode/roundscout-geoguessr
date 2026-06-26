(() => {
  "use strict";

  if (window.__ggStudyLoaded) return;
  window.__ggStudyLoaded = true;

  const me = { id: "", name: "" };
  const cache = [];
  const geoMemo = new Map();
  const memoryStore = { ggStudyRounds: [] };
  const duelState = { id: "", teams: null, rounds: null, guesses: new Map(), lastFetch: 0 };
  const savedFingerprints = new Map();
  let lastShownFingerprint = "";
  let dismissedFingerprint = "";
  let dismissedRoundKey = "";
  let replayAt = 0;
  let meLoading = false;
  let duelStateLoading = false;

  const countryDisplay = (() => {
    try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { return null; }
  })();

  function isContextValid() {
    return typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id;
  }

  function hasStorage() {
    return isContextValid() && chrome.storage && chrome.storage.local;
  }

  function makeElementDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.style.cursor = "move";
    handle.addEventListener("mousedown", dragMouseDown);

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      
      const rect = el.getBoundingClientRect();
      el.style.left = rect.left + "px";
      el.style.top = rect.top + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
      
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.addEventListener("mouseup", closeDragElement);
      document.addEventListener("mousemove", elementDrag);
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      let newTop = el.offsetTop - pos2;
      let newLeft = el.offsetLeft - pos1;
      
      const maxLeft = window.innerWidth - el.offsetWidth;
      const maxTop = window.innerHeight - el.offsetHeight;
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      
      el.style.top = newTop + "px";
      el.style.left = newLeft + "px";
    }

    function closeDragElement() {
      document.removeEventListener("mouseup", closeDragElement);
      document.removeEventListener("mousemove", elementDrag);
    }
  }

  function panel() {
    if (!document.body) return null;
    let el = document.getElementById("ggs-overlay-panel");
    if (el) return el;
    el = document.createElement("div");
    el.id = "ggs-overlay-panel";
    el.innerHTML = `
      <div class="ggs-panel-titlebar" id="ggs-panel-dragbar">
        <span>RoundScout</span>
        <button class="ggs-close-btn" id="ggs-close-panel-btn">&times;</button>
      </div>
      <div class="ggs-panel-body">
        <div class="ggs-meta-header">
          <span id="ggs-mode-badge" class="ggs-mode-badge">-</span>
          <h2 id="ggs-round-title">Round -</h2>
        </div>
        <div class="ggs-stat-row">
          <div>Score<strong id="ggs-stat-score">-</strong></div>
          <div>Miss<strong id="ggs-stat-dist">-</strong></div>
          <div>Result<strong id="ggs-stat-acc">-</strong></div>
        </div>
        <div id="ggs-round-details" class="ggs-round-details"></div>
        <div class="ggs-tips-container">
          <h3>Country Meta & Tips</h3>
          <ul id="ggs-tips-list"><li>Waiting for round result...</li></ul>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.getElementById("ggs-close-panel-btn").addEventListener("click", () => {
      dismissedFingerprint = lastShownFingerprint;
      dismissedRoundKey = el.dataset.roundKey || "";
      el.style.display = "none";
    });
    
    const dragbar = el.querySelector("#ggs-panel-dragbar");
    if (dragbar) {
      makeElementDraggable(el, dragbar);
    }
    return el;
  }

  function show(round) {
    const el = panel();
    if (!el) return;
    const nextFingerprint = displayFingerprint(round);
    const nextRoundKey = displayRoundKey(round);
    if (nextRoundKey && nextRoundKey === dismissedRoundKey) return;
    if (nextFingerprint === dismissedFingerprint) return;
    if (nextFingerprint === lastShownFingerprint && el.style.display !== "none") return;
    lastShownFingerprint = nextFingerprint;
    el.dataset.roundKey = nextRoundKey;
    el.style.display = "flex";
    text("ggs-mode-badge", round.mode.toUpperCase());
    text("ggs-round-title", `Round ${round.roundNumber}`);
    text("ggs-stat-score", round.score ? Math.round(round.score) : "-");
    
    const miles = round.distance ? (round.distance * 0.000621371).toFixed(1) : null;
    text("ggs-stat-dist", miles ? `${miles} mi` : "-");
    const actualCode = cc(round.actualCode);
    const guessedCode = cc(round.guessedCode);
    text("ggs-stat-acc", guessedCode ? (actualCode === guessedCode ? "Hit" : "Miss") : "No guess");

    const details = document.getElementById("ggs-round-details");
    if (details) {
      const scorePct = round.score ? `${Math.round((round.score / 5000) * 100)}% of max score` : "Score unknown";
      const damageText = round.mode === "duel" ? `${round.damage > 0 ? "+" : ""}${Math.round(round.damage || 0)} base dmg` : "-";
      const focus = studyFocus(round);
      details.innerHTML = `
        <div><strong>Target</strong><span>${flagImg(actualCode)} ${countryName(actualCode)} ${actualCode ? `(${actualCode})` : ""}${round.actualRegion ? ` - ${escapeHtml(round.actualRegion)}` : ""}</span></div>
        <div><strong>Your guess</strong><span>${flagImg(guessedCode)} ${guessedCode ? countryName(guessedCode) : "Unknown"} ${guessedCode ? `(${guessedCode})` : ""}${round.guessedRegion ? ` - ${escapeHtml(round.guessedRegion)}` : ""}</span></div>
        <div><strong>Round quality</strong><span>${round.score ? `${Math.round(round.score)}/5000 - ${scorePct}` : scorePct}</span></div>
        <div><strong>Base damage</strong><span>${damageText}</span></div>
        <div><strong>Study focus</strong><span>${escapeHtml(focus)}</span></div>
        <div><strong>Links</strong><span><a href="${escapeAttr(location.href)}" target="_blank" rel="noopener noreferrer" class="ggs-link">match</a>${actualCode ? ` - <a href="${escapeAttr(plonkitUrl(actualCode))}" target="_blank" rel="noopener noreferrer" class="ggs-link">Plonkit ${actualCode}</a>` : ""}</span></div>
      `;
    }

    const code = cc(round.actualCode);
    const tips = document.getElementById("ggs-tips-list");
    if (!tips) return;
    tips.innerHTML = `<li class="ggs-tip-target">Target: ${countryName(code)}${code ? ` (${code})` : ""}</li>`;
    const meta = window.GG_STUDY_COUNTRIES?.find(c => c.code === code);
    (meta?.tips?.length ? meta.tips : ["No targeted country notes available for this region."]).forEach(tip => {
      const li = document.createElement("li");
      li.textContent = tip;
      li.style.marginBottom = "4px";
      tips.appendChild(li);
    });
  }

  function studyFocus(round) {
    const actual = cc(round.actualCode);
    const guessed = cc(round.guessedCode);
    if (!actual) return "Wait for confirmed target before saving conclusions.";
    if (!guessed) return `No guess logged: review the strongest ${countryName(actual)} clues.`;
    if (actual === guessed) {
      if (round.actualRegion && round.guessedRegion && round.actualRegion !== round.guessedRegion) {
        return `Country right. Narrow ${countryName(actual)} regions: ${round.actualRegion} vs ${round.guessedRegion}.`;
      }
      return `Country right. Next EV: region clues inside ${countryName(actual)}.`;
    }
    return `${countryName(actual)} vs ${countryName(guessed)}: ${studyTopicForPair(actual, guessed)}.`;
  }

  function studyTopicForPair(actual, guessed) {
    const pair = [actual, guessed];
    const europe = ["AL","AD","AT","BA","BE","BG","CH","CZ","DE","DK","EE","ES","FI","FR","GB","GR","HR","HU","IE","IS","IT","LT","LU","LV","ME","MK","NL","NO","PL","PT","RO","RS","SE","SI","SK","UA"];
    const balkans = ["AL","BA","BG","GR","HR","ME","MK","RO","RS","SI"];
    const baltics = ["EE","LT","LV"];
    const asia = ["BD","BT","KH","ID","IN","LA","LK","MY","NP","PH","SG","TH","VN"];
    const southAmerica = ["AR","BO","BR","CL","CO","EC","PE","PY","UY"];
    if (pair.every(code => balkans.includes(code))) return "compare Balkan scripts, bollards, plates, and mountain road feel";
    if (pair.every(code => baltics.includes(code))) return "drill Baltic language endings, road signs, and pole/roadside differences";
    if (pair.every(code => europe.includes(code))) return "learn European bollards, plates, road lines, and sign color systems";
    if (pair.every(code => asia.includes(code))) return "compare South/Southeast Asia scripts, driving side, poles, and tropical road style";
    if (pair.every(code => southAmerica.includes(code))) return "compare South American road lines, plates, soil, and vegetation zones";
    if (pair.some(code => ["US","CA"].includes(code))) return "separate North American road shields, plates, lane width, and regional landscape";
    if (pair.some(code => ["AU","NZ"].includes(code))) return "separate Oceania road lines, bollards, poles, and dry-vs-green landscapes";
    return "review language, road furniture, plates, and landscape separators";
  }

  function text(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  }

  function countryName(code) {
    return code ? (countryDisplay?.of(code) || code) : "Unknown";
  }

  function flagImg(code) {
    const clean = cc(code);
    if (!/^[A-Z]{2}$/.test(clean)) return "";
    const name = escapeAttr(countryName(clean));
    return `<img src="https://flagcdn.com/${clean.toLowerCase()}.svg" width="20" height="14" alt="${name}" title="${name}" style="vertical-align:-2px;border-radius:2px;margin-right:4px">`;
  }

  function plonkitUrl(code) {
    return `https://www.plonkit.net/${countryName(code).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function cleanPath() {
    return location.pathname.replace(new RegExp("^/[a-zA-Z]{2}/"), "/");
  }

  function gamePath() {
    const p = cleanPath();
    return /\/(game|challenge|multiplayer|duels?|team-duels|live-challenge)(\/|$)/i.test(p);
  }

  function duelPath() {
    const p = cleanPath();
    return /\/(multiplayer|duels?|team-duels)(\/|$)/i.test(p);
  }

  function resultVisible() {
    if (!gamePath()) return false;

    // Strict block: if guess button is on screen, round results are not active.
    if (document.querySelector('[data-qa="perform-guess"]') || document.querySelector('[class*="guess-button"]')) {
      return false;
    }

    const path = cleanPath();
    if (path.endsWith("/summary") || path.includes("/results/")) {
      return true;
    }

    if (
      document.querySelector('[data-qa="close-round-result"]') ||
      document.querySelector('[data-qa="results-map"]') ||
      document.querySelector('[data-qa="play-again-button"]') ||
      document.querySelector('[data-qa="result-view-top"]')
    ) {
      return true;
    }

    if (
      document.querySelector('[class*="result-layout_root__"]') ||
      document.querySelector('[class*="result-overlay_overlay"]') ||
      document.querySelector('[class*="game-summary_container__"]') ||
      document.querySelector('[class*="game-summary_root__"]') ||
      document.querySelector('[class*="round-result-"]') ||
      document.querySelector('[class*="styles_roundResultWrapper__"]') ||
      document.querySelector('[class*="duel-summary_"]')
    ) {
      return true;
    }

    let textSource = document.body?.innerText || "";
    const ourPanel = document.getElementById("ggs-overlay-panel");
    if (ourPanel) {
      textSource = textSource.replace(ourPanel.innerText, "");
    }
    const t = textSource.toLowerCase();

    const hasDuelResultText = 
      t.includes("damage multiplier") || 
      t.includes("your score") ||
      t.includes("from location") ||
      t.includes("next") ||
      t.includes("continue") ||
      t.includes("view summary") ||
      t.includes("view results") ||
      t.includes("victory") || 
      t.includes("defeat") || 
      t.includes("victory!") ||
      t.includes("defeat!") ||
      t.includes("game summary") ||
      /\br\d+\b/.test(t) ||
      /\b\d[\d,.]*\s*(?:points|pts|miles|mi|km)\b/.test(t) ||
      (t.includes("hp") && (t.includes("round 1") || t.includes("round 2") || t.includes("round 3")));

    if (hasDuelResultText && duelPath()) {
      return true;
    }

    return false;
  }

  function cc(value) {
    return String(value || "").trim().toUpperCase();
  }

  function n(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return 0;
  }

  function score(value) {
    return n(value?.score, value?.points, value?.roundScore, value?.scoreInPoints, value?.roundScoreInPoints, value?.guessScoreInPoints);
  }

  function hasScore(value) {
    if (!value || typeof value !== "object") return false;
    if (value.noGuess || value.noGuessMade || value.didNotGuess || value.timedOut || value.timedout) return true;
    return [
      value.score,
      value.points,
      value.roundScore,
      value.scoreInPoints,
      value.roundScoreInPoints,
      value.guessScoreInPoints
    ].some(item => Number.isFinite(Number(item)));
  }

  function hasNumericScore(value) {
    if (!value || typeof value !== "object") return false;
    return [
      value.score,
      value.points,
      value.roundScore,
      value.scoreInPoints,
      value.roundScoreInPoints,
      value.guessScoreInPoints
    ].some(item => Number.isFinite(Number(item)));
  }

  function distance(value) {
    return n(value?.distanceInMeters, value?.distanceMeters, value?.distanceInMetres, value?.distance, value?.guess?.distanceInMeters, value?.result?.distanceInMeters);
  }

  function code(value) {
    return cc(value?.countryCode || value?.country || value?.streakLocationCode || value?.panorama?.countryCode || value?.correctLocation?.countryCode || value?.location?.countryCode || value?.guess?.countryCode);
  }

  function correctCoords(round) {
    if (!round || typeof round !== "object") return null;
    const source = round.panorama || round.correctLocation || round.location || round;
    const lat = n(source.lat, source.latitude);
    const lng = n(source.lng, source.lon, source.long, source.longitude);
    if ((lat || lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    
    for (const key of ["correctLocation", "panorama", "location"]) {
      if (round[key]) {
        const found = correctCoords(round[key]);
        if (found) return found;
      }
    }
    return null;
  }

  function pointFrom(value, depth = 0) {
    if (!value || typeof value !== "object") return null;
    if (depth > 3) return null;
    if (Array.isArray(value) && value.length >= 2) {
      const first = Number(value[0]);
      const second = Number(value[1]);
      if (Number.isFinite(first) && Number.isFinite(second)) {
        if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return { lat: first, lng: second };
        if (Math.abs(second) <= 90 && Math.abs(first) <= 180) return { lat: second, lng: first };
      }
    }

    const lat = n(value.lat, value.latitude);
    const lng = n(value.lng, value.lon, value.long, value.longitude);
    if ((lat || lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };

    for (const key of ["latLng", "lngLat", "point", "position", "coordinate", "coordinates", "location"]) {
      const found = pointFrom(value[key], depth + 1);
      if (found) return found;
    }
    return null;
  }

  function addTargetCandidate(candidates, source, priority, value) {
    if (!value || typeof value !== "object") return;
    const targetCode = priority <= 2 ? code(value) : "";
    const point = pointFrom(value);
    if (!targetCode && !point) return;
    const key = `${targetCode || ""}|${point ? point.lat.toFixed(5) + "," + point.lng.toFixed(5) : ""}`;
    if (candidates.some(candidate => candidate.key === key)) return;
    candidates.push({ code: targetCode, point, source, priority, key });
  }

  function duelTargetCandidates(round) {
    const candidates = [];
    if (!round || typeof round !== "object") return candidates;
    const explicitCode = cc(round.correctCountryCode || round.targetCountryCode || round.answerCountryCode);
    if (explicitCode) candidates.push({ code: explicitCode, point: null, source: "countryCode", priority: 0, key: explicitCode });

    addTargetCandidate(candidates, "correctLocation", 1, round.correctLocation);
    addTargetCandidate(candidates, "targetLocation", 1, round.targetLocation);
    addTargetCandidate(candidates, "answer", 1, round.answer);
    addTargetCandidate(candidates, "correctAnswer", 1, round.correctAnswer);
    addTargetCandidate(candidates, "target", 2, round.target);
    addTargetCandidate(candidates, "location", 5, round.location);
    addTargetCandidate(candidates, "panorama", 6, round.panorama);

    const directPoint = pointFrom(round);
    if (directPoint) addTargetCandidate(candidates, "round", 7, { ...round, lat: directPoint.lat, lng: directPoint.lng });
    return candidates;
  }

  function targetDistanceDelta(point, guessedPoint, reportedDistance) {
    if (!point || !guessedPoint || reportedDistance == null) return false;
    return Math.abs(metersBetween(point, guessedPoint) - reportedDistance);
  }

  function distanceMatches(candidate, guessedPoint, reportedDistance) {
    const delta = targetDistanceDelta(candidate.point, guessedPoint, reportedDistance);
    if (delta === false) return false;
    const trusted = candidate.priority <= 2;
    const tolerance = trusted
      ? Math.min(Math.max(25000, reportedDistance * 0.04), 200000)
      : Math.min(Math.max(10000, reportedDistance * 0.01), 50000);
    return delta <= tolerance;
  }

  function duelTarget(round, guessedPoint, reportedDistance) {
    const candidates = duelTargetCandidates(round);
    const hasPointCandidates = candidates.some(candidate => candidate.point);
    const matched = candidates
      .filter(candidate => candidate.point && distanceMatches(candidate, guessedPoint, reportedDistance))
      .sort((a, b) => a.priority - b.priority || targetDistanceDelta(a.point, guessedPoint, reportedDistance) - targetDistanceDelta(b.point, guessedPoint, reportedDistance))[0];
    if (matched) return matched;

    const canUseCodeOnly = !guessedPoint || reportedDistance == null || !hasPointCandidates;
    const explicit = candidates
      .filter(candidate => candidate.code && !candidate.point)
      .sort((a, b) => a.priority - b.priority)[0];
    if (explicit && canUseCodeOnly) return explicit;

    const trustedCode = candidates
      .filter(candidate => candidate.code && candidate.priority <= 2)
      .sort((a, b) => a.priority - b.priority)[0];
    if (trustedCode && canUseCodeOnly) return trustedCode;

    return { code: "", point: null };
  }

  function guessCoords(guess) {
    if (!guess || typeof guess !== "object") return null;
    const direct = pointFrom(guess);
    if (direct) return direct;
    
    for (const key of ["guess", "pin", "marker", "location", "position", "coordinate", "coordinates", "guessLocation", "guessPosition"]) {
      if (guess[key]) {
        const found = guessCoords(guess[key]);
        if (found) return found;
      }
    }
    return null;
  }

  function metersBetween(a, b) {
    if (!a || !b) return 0;
    const toRad = value => value * Math.PI / 180;
    const earth = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earth * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function storageGet(key) {
    if (!hasStorage()) return Promise.resolve({ [key]: memoryStore[key] });
    return new Promise(resolve => {
      try {
        chrome.storage.local.get(key, value => resolve(value || { [key]: memoryStore[key] }));
      } catch (e) {
        resolve({ [key]: memoryStore[key] });
      }
    });
  }

  function storageSet(value) {
    Object.assign(memoryStore, value);
    if (!hasStorage()) return Promise.resolve();
    return new Promise(resolve => {
      try {
        chrome.storage.local.set(value, resolve);
      } catch (e) {
        resolve();
      }
    });
  }

  function sendMessage(message) {
    if (!isContextValid()) return Promise.resolve(null);
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime?.lastError) {
            resolve(null);
            return;
          }
          resolve(response || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function geoMeta(point) {
    if (!point || !isContextValid()) return { countryCode: "", region: "" };
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    if (geoMemo.has(key)) return geoMemo.get(key);
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${point.lat}&longitude=${point.lng}&localityLanguage=en`;
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ type: "FETCH_MATCH_DETAILS", url }, res => {
          if (chrome.runtime?.lastError) {
            resolve({ countryCode: "", region: "" });
            return;
          }
          const data = res?.data || {};
          const result = {
            countryCode: cc(data.countryCode),
            region: data.principalSubdivision || data.locality || data.city || ""
          };
          geoMemo.set(key, result);
          resolve(result);
        });
      } catch (err) {
        resolve({ countryCode: "", region: "" });
      }
    });
  }

  async function geocode(point) {
    return (await geoMeta(point)).countryCode;
  }

  function rowFromRound(round) {
    return {
      id: `${round.gameId}_${round.roundNumber}`,
      gameId: round.gameId,
      roundNumber: round.roundNumber,
      mode: round.mode,
      actualCode: cc(round.actualCode),
      guessedCode: cc(round.guessedCode),
      actualRegion: round.actualRegion || "",
      guessedRegion: round.guessedRegion || "",
      distance: Math.round(round.distance || 0),
      score: Math.round(round.score || 0),
      damage: Math.round(round.damage || 0),
      timestamp: Date.now()
    };
  }

  function rowFingerprint(row) {
    return [
      row.id,
      row.mode,
      row.actualCode,
      row.guessedCode,
      row.actualRegion,
      row.guessedRegion,
      row.distance,
      row.score,
      row.damage
    ].join("|");
  }

  function displayFingerprint(round) {
    return [
      round.id || `${round.gameId}_${round.roundNumber}`,
      round.actualCode,
      round.guessedCode,
      round.actualRegion,
      round.guessedRegion,
      Math.round(round.distance || 0),
      Math.round(round.score || 0),
      Math.round(round.damage || 0)
    ].join("|");
  }

  function displayRoundKey(round) {
    return String(round.id || `${round.gameId || ""}_${round.roundNumber || ""}`);
  }

  async function saveDirect(row) {
    const res = await storageGet("ggStudyRounds");
    const list = res.ggStudyRounds || [];
    const old = list.find(item => item.id === row.id);
    if (old) {
      const primary = roundQuality(row) >= roundQuality(old) ? row : old;
      const secondary = primary === row ? old : row;
      Object.assign(old, {
        ...secondary,
        ...primary,
        actualCode: primary.actualCode || secondary.actualCode || "",
        guessedCode: primary.guessedCode || secondary.guessedCode || "",
        actualRegion: primary.actualRegion || secondary.actualRegion || "",
        guessedRegion: primary.guessedRegion || secondary.guessedRegion || "",
        distance: Number(primary.distance) || Number(secondary.distance) || 0,
        score: Number(primary.score) || Number(secondary.score) || 0,
        damage: Number(primary.damage) || Number(secondary.damage) || 0,
        timestamp: primary.timestamp || secondary.timestamp
      });
    }
    else list.push(row);
    const cleaned = dedupeRounds(list);
    await storageSet({ ggStudyRounds: cleaned });
    return old || row;
  }

  async function save(round) {
    if (!isContextValid()) return null;
    const row = rowFromRound(round);
    const fingerprint = rowFingerprint(row);
    if (savedFingerprints.get(row.id) === fingerprint) return row;
    const response = await sendMessage({ type: "SAVE_ROUND", row });
    if (response?.ok && response.row) {
      savedFingerprints.set(row.id, rowFingerprint(response.row));
      return response.row;
    }
    if (!hasStorage()) return null;
    const saved = await saveDirect(row);
    if (saved) savedFingerprints.set(row.id, rowFingerprint(saved));
    return saved;
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

  function dedupeRounds(list) {
    const byId = new Map();
    for (const round of list) {
      const previous = byId.get(round.id);
      byId.set(round.id, !previous || roundQuality(round) >= roundQuality(previous) ? round : previous);
    }

    const result = [];
    const seen = new Map();
    for (const round of byId.values()) {
      const t = round.timestamp ? Math.floor(round.timestamp / 300000) : 0;
      const key = [
        round.mode,
        round.roundNumber,
        round.actualCode || "",
        round.guessedCode || "",
        round.score || 0,
        round.distance || 0,
        round.damage || 0,
        t
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

  function remember(value) {
    if (!value || typeof value !== "object") return;
    const id = value.id || value.userId || value.playerId || value.player?.id || value.user?.id;
    const name = value.nick || value.nickname || value.name || value.username || value.displayName || value.player?.nick || value.user?.nick;
    if (id) me.id = String(id);
    if (name) me.name = norm(name);
  }

  function learn(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 5) return;
    for (const key of ["me", "viewer", "currentUser", "currentPlayer", "localPlayer"]) remember(value[key]);
    if (value.viewerId || value.currentUserId || value.currentPlayerId || value.localPlayerId) {
      me.id = String(value.viewerId || value.currentUserId || value.currentPlayerId || value.localPlayerId);
    }
    if (value.isMe || value.isViewer || value.isCurrentUser || value.isSelf || value.isLocalPlayer) remember(value);
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object" && !/round|guess|opponent|enemy|rival/i.test(key)) learn(child, depth + 1);
    }
  }

  async function fetchMe() {
    if (me.id || meLoading) return;
    meLoading = true;
    try {
      const res = await fetch("/api/v3/profiles");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const profile = data.user || data;
          remember(profile);
        }
      }
    } catch (e) {
      console.error("[GeoGuessr Tracker] Failed to fetch profile:", e);
    } finally {
      meLoading = false;
    }
  }

  async function fetchDuelState(id) {
    if (!id || duelStateLoading) return;
    duelState.lastFetch = Date.now();
    duelStateLoading = true;
    try {
      const res = await fetch(`https://game-server.geoguessr.com/api/duels/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.id) duelState.id = String(data.id);
          if (Array.isArray(data.teams)) duelState.teams = mergeArray(duelState.teams, data.teams);
          if (Array.isArray(data.rounds)) duelState.rounds = mergeArray(duelState.rounds, data.rounds);
        }
      }
    } catch (e) {
      console.error("[GeoGuessr Tracker] Failed to fetch duel state:", e);
    } finally {
      duelStateLoading = false;
    }
  }

  function loadMeFromDOM() {
    if (me.id && me.name) return;
    try {
      const profileLink = document.querySelector('a[href^="/user/"], a[href^="/profile/"], [class*="header_avatar"] a');
      if (profileLink) {
        const match = profileLink.getAttribute("href").match(/\/(?:user|profile)\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          const foundId = match[1];
          if (!me.id) me.id = foundId;
        }
      }
    } catch (e) {}
  }

  function loadMe() {
    try {
      loadMeFromDOM();
      fetchMe();
      const next = document.getElementById("__NEXT_DATA__");
      if (next) {
        const data = JSON.parse(next.textContent || "{}");
        const userId = data?.props?.accountProps?.account?.user?.userId || data?.props?.pageProps?.user?.id;
        const nickname = data?.props?.accountProps?.account?.user?.nick || data?.props?.pageProps?.user?.nick;
        
        if (userId) me.id = String(userId);
        if (nickname) me.name = norm(nickname);
        
        remember(data?.props?.pageProps?.user);
        learn(data);
      }
      for (let i = 0; i < localStorage.length && i < 100; i += 1) {
        const key = localStorage.key(i);
        const raw = /user|profile|session|account|geoguessr/i.test(key) ? localStorage.getItem(key) : "";
        if (raw && raw[0] === "{" && raw.length < 250000) {
          const data = JSON.parse(raw);
          remember(data.user || data.profile || data.account);
          learn(data);
        }
      }
    } catch (e) {}
  }

  function norm(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9_.-]+/g, "");
  }

  function ids(value) {
    return [value?.id, value?.userId, value?.playerId, value?.accountId, value?.player?.id, value?.player?.userId, value?.user?.id].filter(Boolean).map(String);
  }

  function names(value) {
    return [value?.nick, value?.nickname, value?.name, value?.username, value?.displayName, value?.playerName, value?.player?.nick, value?.player?.name, value?.user?.nick, value?.user?.name].filter(Boolean).map(norm);
  }

  function mine(value) {
    return Boolean(value && ((me.id && ids(value).includes(me.id)) || (me.name && names(value).includes(me.name))));
  }

  function myTeam(teams) {
    if (!Array.isArray(teams) || !teams.length) return null;
    if (teams.length === 1) return teams[0];
    return teams.find(team => mine(team) || team.isMe || team.isCurrentUser || (team.players || []).some(player => mine(player) || player.isMe || player.isCurrentUser)) || null;
  }

  function mineOwner(value) {
    return Boolean(value && (mine(value) || value.isMe || value.isCurrentUser || value.isSelf || value.isLocalPlayer || (value.players || []).some(player => mine(player) || player.isMe || player.isCurrentUser)));
  }

  function gameId(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 4) return "";
    for (const key of ["gameId", "duelId", "matchId", "token"]) {
      if (value[key] && typeof value[key] !== "object") return String(value[key]);
    }
    if (depth === 0 && value.id && typeof value.id !== "object" && (Array.isArray(value.teams) || Array.isArray(value.rounds) || value.currentRoundNumber || value.gameStatus || value.status)) {
      return String(value.id);
    }
    for (const key of ["payload", "data", "state", "game", "duel", "match", "gameState", "currentGame"]) {
      const child = value[key];
      const found = child && typeof child === "object" ? gameId(child, depth + 1) : "";
      if (found) return found;
    }
    return "";
  }

  function getGameIdFromUrl() {
    const parts = location.pathname.split("/");
    const idx = parts.findIndex(p => /^(game|challenge|duels|team-duels)$/i.test(p));
    if (idx !== -1 && parts[idx + 1]) {
      return parts[idx + 1];
    }
    const mIdx = parts.indexOf("multiplayer");
    if (mIdx !== -1 && parts[mIdx + 1] === "duels" && parts[mIdx + 2]) {
      return parts[mIdx + 2];
    }
    return "";
  }

  function getActiveGameId() {
    return getGameIdFromUrl() || duelState.id;
  }

  function mergeObject(oldValue, newValue) {
    if (!oldValue || typeof oldValue !== "object") return newValue;
    if (!newValue || typeof newValue !== "object") return oldValue;
    const merged = { ...oldValue };
    for (const [key, value] of Object.entries(newValue)) {
      const old = oldValue[key];
      if (Array.isArray(old) || Array.isArray(value)) {
        merged[key] = mergeArray(old, value);
      } else if (old && value && typeof old === "object" && typeof value === "object") {
        merged[key] = mergeObject(old, value);
      } else if (value === "" || value === 0 || value == null) {
        merged[key] = old != null && old !== "" && old !== 0 ? old : value;
      } else {
        merged[key] = value;
      }
    }
    return merged;
  }

  function mergeArray(oldArray, newArray) {
    if (!Array.isArray(oldArray)) return newArray;
    if (!Array.isArray(newArray)) return oldArray;
    const max = Math.max(oldArray.length, newArray.length);
    return Array.from({ length: max }, (_, index) => mergeObject(oldArray[index], newArray[index]));
  }

  function unwrap(value, out = [], depth = 0) {
    if (!value || typeof value !== "object" || depth > 5) return out;
    out.push(value);
    if (Array.isArray(value)) value.forEach(item => unwrap(item, out, depth + 1));
    for (const key of ["arguments", "payload", "data", "state", "value", "body", "game", "duel", "match", "gameState", "currentGame"]) {
      if (value[key] && typeof value[key] === "object") unwrap(value[key], out, depth + 1);
    }
    return out;
  }

  function duelSnapshots(root) {
    const activeId = getGameIdFromUrl() || gameId(root) || duelState.id;
    return unwrap(root)
      .filter(value => value && typeof value === "object" && Array.isArray(value.teams) && Array.isArray(value.rounds))
      .filter(value => value.teams.length && value.rounds.length)
      .filter(value => {
        const id = gameId(value);
        return !activeId || !id || id === activeId;
      });
  }

  function roundNo(value, fallback) {
    const explicit = n(value?.roundNumber, value?.round, value?.currentRoundNumber);
    if (explicit) return explicit;
    const roundIndex = Number(value?.roundIndex);
    if (Number.isFinite(roundIndex)) return roundIndex + 1;
    return fallback || 0;
  }

  function guessReady(value) {
    return Boolean(value && typeof value === "object" && (hasScore(value) || distance(value) || code(value) || guessCoords(value)));
  }

  function mergeGuess(oldGuess, newGuess) {
    if (!oldGuess) return newGuess;
    if (!newGuess) return oldGuess;
    return mergeObject(oldGuess, newGuess);
  }

  function scoreClose(a, b) {
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1;
  }

  function distanceClose(a, b) {
    return Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 && Math.abs(a - b) <= Math.max(50, Math.min(a, b) * 0.01);
  }

  function guessDetailCandidates(round, teams, index) {
    const out = [...roundGuesses(round)];
    const team = myTeam(teams);
    if (team) {
      for (const pool of [team.guesses, team.playerGuesses, team.results, team.roundResults].filter(Array.isArray)) {
        if (pool[index]) out.push(pool[index]);
        pool.forEach(item => out.push(item));
      }
      for (const player of team.players || []) {
        for (const pool of [player.guesses, player.playerGuesses, player.results, player.roundResults].filter(Array.isArray)) {
          if (pool[index]) out.push(pool[index]);
          pool.forEach(item => out.push(item));
        }
      }
    }
    const banked = duelState.guesses.get(index + 1);
    if (banked) out.push(banked);
    return out.filter(Boolean);
  }

  function compatibleGuess(base, candidate) {
    if (!base || !candidate || base === candidate) return false;
    if (!guessCoords(candidate) && !code(candidate)) return false;
    const baseScore = score(base);
    const candidateScore = score(candidate);
    const baseDistance = distance(base);
    const candidateDistance = distance(candidate);
    return (hasNumericScore(base) && hasNumericScore(candidate) && scoreClose(baseScore, candidateScore)) ||
      distanceClose(baseDistance, candidateDistance) ||
      mine(candidate);
  }

  function enrichGuess(base, round, teams, index) {
    if (!base) return null;
    let merged = base;
    for (const candidate of guessDetailCandidates(round, teams, index)) {
      if (compatibleGuess(merged, candidate)) merged = mergeGuess(merged, candidate);
    }
    return merged;
  }

  function rememberGuess(roundNumber, guess) {
    if (!roundNumber || !guessReady(guess)) return;
    duelState.guesses.set(roundNumber, mergeGuess(duelState.guesses.get(roundNumber), guess));
  }

  function rememberTeamGuesses(team) {
    if (!team) return;
    const pools = [team.guesses, team.playerGuesses, team.results, team.roundResults].filter(Array.isArray);
    for (const pool of pools) pool.forEach((guess, index) => rememberGuess(roundNo(guess, index + 1), guess));
    for (const player of team.players || []) {
      const playerPools = [player.guesses, player.playerGuesses, player.results, player.roundResults].filter(Array.isArray);
      for (const pool of playerPools) pool.forEach((guess, index) => rememberGuess(roundNo(guess, index + 1), guess));
    }
  }

  function rememberLooseGuesses(root) {
    const activeId = getGameIdFromUrl() || duelState.id;
    const rootId = gameId(root);
    if (activeId && rootId && rootId !== activeId) return;

    for (const value of unwrap(root)) {
      if (!value || typeof value !== "object") continue;
      const ownerRound = roundNo(value);
      if (mine(value) && guessReady(value)) rememberGuess(ownerRound, value);
      if (!mineOwner(value)) continue;
      for (const key of ["guesses", "playerGuesses", "results", "roundResults"]) {
        const pool = value[key];
        if (Array.isArray(pool)) {
          pool.forEach((guess, index) => {
            const fallbackRound = pool.length === 1 && ownerRound ? ownerRound : index + 1;
            rememberGuess(roundNo(guess, fallbackRound), guess);
          });
        }
      }
    }
  }

  function guessFor(round, root, teams, index) {
    const banked = duelState.guesses.get(index + 1);
    const guesses = roundGuesses(round);
    const direct = guesses.find(mine);
    if (direct) return mergeGuess(direct, banked);

    const team = myTeam(teams);
    if (team) {
      const fromTeam = teamGuess(team, index);
      if (fromTeam) return mergeGuess(fromTeam, banked);
    }

    return banked || null;
  }

  function roundGuesses(round) {
    return [
      ...(round?.guesses || []),
      ...(round?.playerGuesses || []),
      ...(round?.results || []),
      ...(round?.roundResults || [])
    ].filter(Boolean);
  }

  function teamGuess(team, index) {
    if (!team) return null;
    const pools = [team.guesses, team.playerGuesses, team.results, team.roundResults].filter(Array.isArray);
    for (const pool of pools) if (pool[index]) return pool[index];
    for (const player of team.players || []) {
      const playerPools = [player.guesses, player.playerGuesses, player.results, player.roundResults].filter(Array.isArray);
      for (const pool of playerPools) if (pool[index]) return pool[index];
    }
    return null;
  }

  function opponentGuessFor(round, activeTeams, index) {
    const ownTeam = myTeam(activeTeams);
    if (!ownTeam) return (me.id || me.name) ? roundGuesses(round).find(guess => !mine(guess)) || null : null;
    const oppTeam = activeTeams.find(team => team !== ownTeam);
    const fromTeam = teamGuess(oppTeam, index);
    if (fromTeam) return fromTeam;
    return (me.id || me.name) ? roundGuesses(round).find(guess => !mine(guess)) || null : null;
  }

  function getRoundDamage(round, activeTeams, index, knownGuess) {
    const myGuess = knownGuess || enrichGuess(guessFor(round, null, activeTeams, index), round, activeTeams, index);
    const oppGuess = opponentGuessFor(round, activeTeams, index);
    if (!myGuess || !oppGuess) return 0;
    const myScore = score(myGuess);
    const oppScore = score(oppGuess);

    if (hasNumericScore(myGuess) && hasNumericScore(oppGuess)) {
      return Math.round(myScore - oppScore);
    }

    return 0;
  }

  async function processDuel(state) {
    if (!duelPath()) return null;
    
    const activeId = state.id || getActiveGameId();
    const activeRounds = state.rounds;
    const activeTeams = state.teams;
    
    if (!activeId || !Array.isArray(activeRounds) || !activeRounds.length || !Array.isArray(activeTeams) || !activeTeams.length) {
      return null;
    }

    let latest = null;
    for (let i = 0; i < activeRounds.length; i += 1) {
      const round = activeRounds[i];
      if (!round) continue;
      
      const roundNumber = n(round.roundNumber, round.round, i + 1);
      
      const guess = enrichGuess(guessFor(round, state, activeTeams, i), round, activeTeams, i);
      if (!guess) continue;
      if (!hasScore(guess) && !distance(guess)) continue;
      const playerGuess = guess;
      
      const guessedPoint = guessCoords(playerGuess);
      const reportedDistance = distance(playerGuess);
      const target = duelTarget(round, guessedPoint, reportedDistance);
      const actualPoint = target.point;
      const actualMeta = await geoMeta(actualPoint);
      let actual = target.code || actualMeta.countryCode;
      if (!actual) continue;

      const guessedMeta = await geoMeta(guessedPoint);
      let guessed = code(playerGuess) || code(playerGuess.guess);
      if (!guessed && !playerGuess.noGuess) {
        guessed = guessedMeta.countryCode;
      }
      
      const baseDamage = getRoundDamage(round, activeTeams, i, playerGuess);
      const dist = reportedDistance || metersBetween(actualPoint, guessedPoint);
      
      latest = await save({
        gameId: activeId,
        roundNumber,
        mode: "duel",
        actualCode: cc(actual),
        guessedCode: cc(guessed),
        actualRegion: actualMeta.region,
        guessedRegion: guessedMeta.region,
        distance: dist,
        score: score(playerGuess),
        damage: baseDamage
      });
    }
    
    if (latest && resultVisible()) {
      show(latest);
    }
    return latest;
  }

  async function processClassic(payload) {
    if (duelPath() || !payload?.token) return null;
    const roundNumber = n(payload.round, payload.currentRoundNumber, payload.player?.guesses?.length, 1);
    const index = Math.max(0, roundNumber - 1);
    const round = payload.rounds?.[index];
    const guess = payload.player?.guesses?.[index];
    const actualPoint = correctCoords(round);
    const guessedPoint = guessCoords(guess);
    const actualMeta = await geoMeta(actualPoint);
    const guessedMeta = await geoMeta(guessedPoint);
    let actual = code(round) || actualMeta.countryCode;
    let guessed = code(guess) || guessedMeta.countryCode;
    if (!actual || !guess) return null;
    const saved = await save({
      gameId: payload.token,
      roundNumber,
      mode: payload.mode || "classic",
      actualCode: actual,
      guessedCode: guessed,
      actualRegion: actualMeta.region,
      guessedRegion: guessedMeta.region,
      distance: distance(guess) || metersBetween(actualPoint, guessedPoint),
      score: score(guess),
      damage: 0
    });
    if (resultVisible()) {
      show(saved);
    }
    return saved;
  }

  function rememberDuelParts(root) {
    if (!root || typeof root !== "object") return;
    const snapshots = duelSnapshots(root);
    const id = snapshots.map(gameId).find(Boolean) || gameId(root);
    if (id && duelState.id && id !== duelState.id) {
      duelState.teams = null;
      duelState.rounds = null;
      duelState.guesses = new Map();
    }
    if (id) duelState.id = id;
    for (const snapshot of snapshots) {
      duelState.teams = mergeArray(duelState.teams, snapshot.teams);
      duelState.rounds = mergeArray(duelState.rounds, snapshot.rounds);
      rememberTeamGuesses(myTeam(snapshot.teams));
    }
    rememberTeamGuesses(myTeam(duelState.teams));
    rememberLooseGuesses(root);
  }

  async function processPayload(payload, replay = false) {
    if (!payload || !isContextValid()) return;
    loadMe();
    learn(payload);
    if (!replay) cache.unshift(payload);
    cache.length = Math.min(cache.length, 24);
    await processClassic(payload);
    
    if (duelPath()) {
      rememberDuelParts(payload);
      const id = getActiveGameId();
      if (id && resultVisible() && (!duelState.teams || !duelState.rounds || Date.now() - duelState.lastFetch > 2500)) {
        await fetchDuelState(id);
      }
      await processDuel(duelState);
    }
  }

  async function syncClassicHistory(btn) {
    let added = 0;
    const feed = await fetch("https://www.geoguessr.com/api/v4/feed/private?count=50").then(r => r.json());
    const stored = (await storageGet("ggStudyRounds")).ggStudyRounds || [];
    const existing = new Set(stored.map(round => round.id));
    for (const activity of Array.isArray(feed) ? feed : []) {
      const token = activity.type === "GameExecuted" ? activity.payload?.token : "";
      if (!token) continue;
      const game = await fetch(`https://www.geoguessr.com/api/v3/games/${token}`).then(r => r.json());
      for (let i = 0; i < (game.player?.guesses?.length || 0); i += 1) {
        const id = `${token}_${i + 1}`;
        const actual = code(game.rounds?.[i]);
        const guess = game.player.guesses[i];
        if (!actual || existing.has(id)) continue;
        stored.push({
          id,
          gameId: token,
          roundNumber: i + 1,
          mode: game.mode || "classic",
          actualCode: actual,
          guessedCode: code(guess),
          distance: Math.round(distance(guess)),
          score: Math.round(score(guess)),
          damage: 0,
          timestamp: Date.now()
        });
        existing.add(id);
        added += 1;
        if (btn) btn.innerText = `Synced ${added} rounds...`;
      }
    }
    await storageSet({ ggStudyRounds: stored });
    return added;
  }

  function manageProfileImporter() {
    if (!location.pathname.includes("/user/") || document.getElementById("ggs-history-import-btn")) return;
    const host = document.querySelector('[class*="profile__activities"], [class*="user-summary"], h1');
    if (!host) return;
    const btn = document.createElement("button");
    btn.id = "ggs-history-import-btn";
    btn.className = "ggs-profile-import-btn";
    btn.innerText = "Sync Full Match History";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerText = "Syncing...";
      try {
        const added = await syncClassicHistory(btn);
        btn.innerText = `Synced! Added ${added}`;
      } catch (e) {
        btn.innerText = "Sync failed";
      }
      setTimeout(() => {
        btn.disabled = false;
        btn.innerText = "Sync Full Match History";
      }, 3000);
    });
    host.appendChild(btn);
  }

  window.addEventListener("message", event => {
    if (isContextValid() && event.source === window && event.data?.source === "GG_STUDY_PROBE") {
      processPayload(event.data.payload);
    }
  });

  fetchMe();

  setInterval(() => {
    if (!isContextValid()) {
      const el = document.getElementById("ggs-overlay-panel");
      if (el) el.style.display = "none";
      return;
    }
    loadMe();
    manageProfileImporter();

    if (!gamePath()) {
      const el = document.getElementById("ggs-overlay-panel");
      if (el) el.style.display = "none";
      return;
    }

    if (!resultVisible()) {
      const el = document.getElementById("ggs-overlay-panel");
      if (el) el.style.display = "none";
      return;
    }

    if (duelPath()) {
      const id = getActiveGameId();
      if (id && (!duelState.teams || !duelState.rounds || Date.now() - duelState.lastFetch > 2500)) {
        fetchDuelState(id);
      }
    }

    if (Date.now() - replayAt > 1000) {
      replayAt = Date.now();
      if (cache.length > 0) {
        processPayload(cache[0], true);
      } else if (duelPath() && duelState.teams && duelState.rounds) {
        processDuel(duelState);
      }
    }
  }, 500);
})();
