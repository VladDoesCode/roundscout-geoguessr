(() => {
  "use strict";

  if (window.__ggStudyLoaded) return;
  window.__ggStudyLoaded = true;

  const me = { id: "", name: "" };
  const cache = [];
  const geoMemo = new Map();
  const guideMemo = new Map();
  const memoryStore = { ggStudyRounds: [] };
  const duelState = { id: "", teams: null, rounds: null, guesses: new Map(), completed: new Set(), lastFetch: 0, lastUpdate: 0, revealUntil: 0, latestGuess: null };
  const classicState = { token: "", submissions: new Map(), latestSubmission: null, details: new Map(), fetching: new Map(), lastFetch: new Map() };
  const pageRequests = new Map();
  const capture = window.RoundScoutCapture;
  const savedFingerprints = new Map();
  let lastShownFingerprint = "";
  let dismissedFingerprint = "";
  let dismissedRoundKey = "";
  let replayAt = 0;
  let meLoading = false;
  let duelStateLoading = "";
  let duelDiscoveryAt = 0;
  let duelDiscoveryLoading = false;
  let visualRenderToken = 0;

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
        <section class="ggs-visual-debrief" aria-labelledby="ggs-visual-title">
          <div class="ggs-section-heading">
            <div>
              <span class="ggs-eyebrow">Visual debrief</span>
              <h3 id="ggs-visual-title">Why this location fits</h3>
            </div>
            <a id="ggs-guide-link" class="ggs-source-button" href="#" target="_blank" rel="noopener noreferrer">Full guide</a>
          </div>
          <p id="ggs-visual-context" class="ggs-visual-context"></p>
          <div id="ggs-visual-cards" class="ggs-visual-cards" aria-live="polite">
            <div class="ggs-visual-loading"><span></span><span></span><span></span></div>
          </div>
          <div id="ggs-takeaway" class="ggs-takeaway"></div>
        </section>
        <details class="ggs-tips-container">
          <summary>More beginner clues</summary>
          <ul id="ggs-tips-list"><li>Waiting for round result...</li></ul>
        </details>
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
    tips.innerHTML = "";
    const localClues = window.GG_STUDY_CLUE_ENGINE?.localClues(code, guessedCode, 5) || [];
    const fallbackTips = window.GG_STUDY_COUNTRIES?.find(c => c.code === code)?.tips || [];
    const tipItems = localClues.length ? localClues.map(clue => clue.text) : fallbackTips;
    (tipItems.length ? tipItems : ["No targeted country notes are available yet."]).forEach(tip => {
      const li = document.createElement("li");
      li.textContent = tip;
      tips.appendChild(li);
    });
    renderVisualDebrief(round, nextFingerprint);
  }

  function countryProfile(code) {
    return window.GG_STUDY_CLUE_ENGINE?.profile(code) || window.GG_STUDY_COUNTRIES?.find(country => country.code === cc(code)) || null;
  }

  async function fetchVisualGuide(code) {
    const profile = countryProfile(code);
    if (!profile?.slug) return null;
    if (guideMemo.has(profile.slug)) return guideMemo.get(profile.slug);
    const pending = sendMessage({ type: "FETCH_PLONKIT_GUIDE", slug: profile.slug })
      .then(response => response?.ok ? response.data : null)
      .catch(() => null);
    guideMemo.set(profile.slug, pending);
    const guide = await pending;
    if (guide) guideMemo.set(profile.slug, guide);
    else guideMemo.delete(profile.slug);
    return guide;
  }

  async function renderVisualDebrief(round, fingerprint) {
    const token = ++visualRenderToken;
    const actual = cc(round.actualCode);
    const guessed = cc(round.guessedCode);
    const cardsRoot = document.getElementById("ggs-visual-cards");
    const context = document.getElementById("ggs-visual-context");
    const title = document.getElementById("ggs-visual-title");
    const takeaway = document.getElementById("ggs-takeaway");
    const guideLink = document.getElementById("ggs-guide-link");
    if (!cardsRoot || !actual) return;
    const pairKey = `${actual}|${guessed || "NO_GUESS"}`;
    if (cardsRoot.dataset.pairKey === pairKey && cardsRoot.dataset.ready === "true") return;
    cardsRoot.dataset.pairKey = pairKey;
    cardsRoot.dataset.ready = "false";

    title.textContent = guessed && guessed !== actual
      ? `${countryName(actual)} vs ${countryName(guessed)}`
      : `Recognizing ${countryName(actual)}`;
    context.textContent = guessed && guessed !== actual
      ? `Matched visual clues for the exact country pair from this round.`
      : `The strongest visual clues to make this country easier next time.`;
    cardsRoot.innerHTML = `<div class="ggs-visual-loading" aria-label="Loading matched visual clues"><span></span><span></span><span></span></div>`;
    takeaway.textContent = "Building your visual lesson...";
    const profile = countryProfile(actual);
    guideLink.href = profile?.plonkit || plonkitUrl(actual);

    const [actualGuide, guessedGuide] = await Promise.all([
      fetchVisualGuide(actual),
      guessed && guessed !== actual ? fetchVisualGuide(guessed) : Promise.resolve(null)
    ]);
    if (token !== visualRenderToken || fingerprint !== lastShownFingerprint) return;

    const engine = window.GG_STUDY_CLUE_ENGINE;
    const lesson = engine?.buildLesson(actual, guessed, actualGuide, guessedGuide);
    if (!lesson) {
      cardsRoot.innerHTML = `<div class="ggs-visual-empty">Visual guide unavailable. The beginner clues below are still matched to ${escapeHtml(countryName(actual))}.</div>`;
      cardsRoot.dataset.ready = "true";
      takeaway.textContent = studyFocus(round);
      return;
    }

    guideLink.href = lesson.sourceUrl || guideLink.href;
    cardsRoot.innerHTML = lesson.cards.map(card => renderLessonCard(card, actual, guessed)).join("");
    if (!cardsRoot.innerHTML) {
      cardsRoot.innerHTML = `<div class="ggs-visual-empty">No visual clue is available for this guide yet.</div>`;
    }
    takeaway.innerHTML = `<strong>Remember this</strong><span>${escapeHtml(lesson.takeaway)}</span>`;
    cardsRoot.dataset.ready = "true";
    bindVisualFallbacks(cardsRoot);
  }

  function renderLessonCard(card, actual, guessed) {
    const type = escapeHtml(card.title || window.GG_STUDY_CLUE_ENGINE?.typeLabel(card.type) || "High-value clue");
    if (card.kind === "compare" && card.guessed) {
      return `
        <article class="ggs-clue-card ggs-clue-compare">
          <div class="ggs-clue-card-header"><span>${type}</span><small>Compare the evidence</small></div>
          <div class="ggs-comparison-grid">
            ${renderClueSide(card.actual, actual, "Target")}
            ${renderClueSide(card.guessed, guessed, "Your guess")}
          </div>
        </article>`;
    }
    return `
      <article class="ggs-clue-card ggs-clue-target">
        <div class="ggs-clue-card-header"><span>${type}</span><small>Look for this</small></div>
        ${renderClueSide(card.actual, actual, "Target")}
      </article>`;
  }

  function renderClueSide(clue, code, role) {
    const image = clue?.imageUrl
      ? `<a class="ggs-clue-image" href="${escapeAttr(clue.imageLink || clue.sourceUrl || plonkitUrl(code))}" target="_blank" rel="noopener noreferrer"><img src="${escapeAttr(clue.imageUrl)}" alt="${escapeAttr(`${clue.title || "GeoGuessr clue"} for ${countryName(code)}`)}" loading="eager" decoding="async" referrerpolicy="no-referrer"><span>Open source image</span></a>`
      : `<a class="ggs-clue-image ggs-clue-image-missing" href="${escapeAttr(clue?.sourceUrl || plonkitUrl(code))}" target="_blank" rel="noopener noreferrer"><span>Open visual source</span></a>`;
    return `
      <div class="ggs-clue-side">
        ${image}
        <div class="ggs-clue-copy">
          <div class="ggs-country-label"><span>${escapeHtml(role)}</span>${flagImg(code)}<strong>${escapeHtml(countryName(code))}</strong></div>
          <p>${escapeHtml(shortClueText(clue?.text))}</p>
          <a href="${escapeAttr(clue?.sourceUrl || plonkitUrl(code))}" target="_blank" rel="noopener noreferrer">${escapeHtml(clue?.sourceLabel || "Open source")}</a>
        </div>
      </div>`;
  }

  function shortClueText(value) {
    const text = String(value || "Visual example from the country guide.").trim();
    if (text.length <= 220) return text;
    const cut = text.slice(0, 217).replace(/\s+\S*$/, "");
    return `${cut}...`;
  }

  function bindVisualFallbacks(root) {
    root.querySelectorAll(".ggs-clue-image img").forEach(img => {
      img.addEventListener("error", () => {
        const link = img.closest(".ggs-clue-image");
        if (!link) return;
        link.classList.add("ggs-clue-image-missing");
        img.remove();
      }, { once: true });
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
    const profile = countryProfile(code);
    return profile?.plonkit || `https://www.plonkit.net/${countryName(code).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
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

  function visibleControl(element) {
    if (!element || element.disabled || element.getAttribute("aria-disabled") === "true" || element.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return false;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return !top || top === element || element.contains(top);
  }

  function activeGuessVisible() {
    return Array.from(document.querySelectorAll('[data-qa="perform-guess"], [data-testid*="guess" i], [class*="guess-button"], button'))
      .filter(element => element.matches('[data-qa="perform-guess"], [data-testid*="guess" i], [class*="guess-button"]') || /^(?:make\s+)?guess(?:\s+now)?$/i.test(element.textContent.trim()))
      .some(visibleControl);
  }

  function resultVisible() {
    if (!gamePath()) return false;

    // Strict block: if guess button is on screen, round results are not active.
    if (activeGuessVisible()) {
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

  function visibleRoundNumber() {
    let text = document.body?.innerText || "";
    const panel = document.getElementById("ggs-overlay-panel");
    if (panel) text = text.replace(panel.innerText, "");
    const rounds = Array.from(text.matchAll(/\bround\s*(\d+)\b/gi), match => Number(match[1])).filter(Number.isFinite);
    return rounds.length ? Math.max(...rounds) : 0;
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
    return n(
      value?.score,
      value?.points,
      value?.roundScore,
      value?.scoreInPoints,
      value?.roundScoreInPoints,
      value?.guessScoreInPoints,
      value?.result?.score,
      value?.guess?.score
    );
  }

  function hasScore(value) {
    if (!value || typeof value !== "object") return false;
    if (noGuess(value)) return true;
    return [
      value.score,
      value.points,
      value.roundScore,
      value.scoreInPoints,
      value.roundScoreInPoints,
      value.guessScoreInPoints,
      value.result?.score,
      value.guess?.score
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
      value.guessScoreInPoints,
      value.result?.score,
      value.guess?.score
    ].some(item => Number.isFinite(Number(item)));
  }

  function distance(value) {
    return n(
      value?.distanceInMeters,
      value?.distanceMeters,
      value?.distanceInMetres,
      typeof value?.distance === "number" ? value.distance : undefined,
      value?.distance?.meters,
      value?.distance?.amount,
      value?.distance?.value,
      value?.guess?.distanceInMeters,
      value?.result?.distanceInMeters,
      value?.result?.distance?.meters
    );
  }

  function hasDistance(value) {
    if (!value || typeof value !== "object") return false;
    const values = [
      value.distanceInMeters,
      value.distanceMeters,
      value.distanceInMetres,
      typeof value.distance === "number" ? value.distance : undefined,
      value.distance?.meters,
      value.distance?.amount,
      value.distance?.value,
      value.guess?.distanceInMeters,
      value.result?.distanceInMeters,
      value.result?.distance?.meters
    ];
    return values.some(item => Number.isFinite(Number(item)));
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

    if (!guessedPoint || reportedDistance == null) {
      const fallbackPoint = candidates
        .filter(candidate => candidate.point)
        .sort((a, b) => a.priority - b.priority)[0];
      if (fallbackPoint) return fallbackPoint;
    }

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
          // Only cache successful lookups; a transient bigdatacloud failure should not poison every later round.
          if (result.countryCode || result.region) geoMemo.set(key, result);
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

  function pageFetchJson(url, timeoutMs = 6000) {
    if (!isContextValid()) return Promise.resolve(null);
    const requestId = `ggs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        pageRequests.delete(requestId);
        resolve(null);
      }, timeoutMs);
      pageRequests.set(requestId, value => {
        clearTimeout(timer);
        resolve(value);
      });
      window.postMessage({ source: "GG_STUDY_FETCH_REQUEST", requestId, url }, window.location.origin);
    });
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
      const res = await fetch("/api/v3/profiles", { credentials: "include", headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const profile = data.user || data;
          remember(profile);
          learn(data);
        }
      }
    } catch (e) {
      console.error("[GeoGuessr Tracker] Failed to fetch profile:", e);
    } finally {
      meLoading = false;
    }
  }

  async function fetchClassicDetails(token, wantedRound = 0) {
    if (!token) return [];
    const now = Date.now();
    const cached = classicState.details.get(token) || [];
    const cachedFrame = capture?.selectClassic(cached[0] || {}, cached) || {};
    if (cachedFrame.roundNumber >= wantedRound && (guessCoords(cachedFrame.guess) || code(cachedFrame.guess) || noGuess(cachedFrame.guess))) {
      return cached;
    }
    if (classicState.fetching.has(token)) return classicState.fetching.get(token);
    if (now - (classicState.lastFetch.get(token) || 0) < 700) return cached;

    const task = (async () => {
      classicState.lastFetch.set(token, Date.now());
      const details = [];
      const urls = [
        `${location.origin}/api/v3/games/${encodeURIComponent(token)}?client=web`,
        `${location.origin}/api/v3/results/${encodeURIComponent(token)}`
      ];
      for (const url of urls) {
        const data = await pageFetchJson(url);
        if (!data) continue;
        details.push(data);
        const frame = capture?.selectClassic(data, details) || {};
        if (guessCoords(frame.guess) || code(frame.guess) || noGuess(frame.guess)) break;
      }
      if (details.length) classicState.details.set(token, details);
      return details.length ? details : (classicState.details.get(token) || []);
    })();
    classicState.fetching.set(token, task);
    try {
      return await task;
    } finally {
      classicState.fetching.delete(token);
    }
  }

  async function fetchDuelState(id) {
    if (!id || duelStateLoading === id) return;
    duelState.lastFetch = Date.now();
    duelStateLoading = id;
    try {
      if (duelState.id && duelState.id !== id) return;
      duelState.id = id;
      const encoded = encodeURIComponent(id);
      const urls = [
        `https://game-server.geoguessr.com/api/duels/${encoded}`,
        `https://game-server.geoguessr.com/api/duels/${encoded}/summary`,
        `${location.origin}/api/v4/duels/${encoded}`
      ];
      for (const url of urls) {
        const data = await pageFetchJson(url);
        if (!data) continue;
        if (duelState.id !== id) return;
        rememberDuelParts(data);
        if (duelState.teams?.length && duelState.rounds?.length) break;
      }
    } catch (e) {
      console.error("[GeoGuessr Tracker] Failed to fetch duel state:", e);
    } finally {
      if (duelStateLoading === id) duelStateLoading = "";
    }
  }

  async function discoverOngoingDuel() {
    if (!duelPath() || duelDiscoveryLoading || Date.now() - duelDiscoveryAt < 1800) return "";
    duelDiscoveryAt = Date.now();
    duelDiscoveryLoading = true;
    try {
      const urls = [
        `${location.origin}/api/duels/ongoing`,
        "https://game-server.geoguessr.com/api/duels/ongoing",
        `${location.origin}/api/v4/duels/ongoing`
      ];
      for (const url of urls) {
        const data = await pageFetchJson(url, 4000);
        if (!data) continue;
        rememberDuelParts(data);
        const id = gameId(data) || duelState.id;
        if (id) {
          await fetchDuelState(id);
          return id;
        }
      }
    } finally {
      duelDiscoveryLoading = false;
    }
    return "";
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
    return Boolean(value && (
      (me.id && ids(value).includes(me.id)) ||
      (me.name && names(value).includes(me.name)) ||
      value.isMe === true || value.isViewer === true || value.isCurrentUser === true ||
      value.isSelf === true || value.isLocalPlayer === true
    ));
  }

  function myTeam(teams) {
    if (!Array.isArray(teams) || !teams.length) return null;
    if (teams.length === 1) return teams[0];
    return teams.find(team => mine(team) || team.isMe || team.isViewer || team.isCurrentUser || team.isSelf || team.isLocalPlayer ||
      (team.players || []).some(player => mine(player) || player.isMe || player.isViewer || player.isCurrentUser || player.isSelf || player.isLocalPlayer)) || null;
  }

  function teamPlayers(team) {
    return Array.isArray(team?.players) ? team.players : [];
  }

  function teamHasMultiplePlayers(team) {
    return teamPlayers(team).length > 1;
  }

  function ownPlayers(team) {
    return teamPlayers(team).filter(player => mine(player) || player.isMe || player.isCurrentUser || player.isSelf || player.isLocalPlayer);
  }

  function playerPinGuess(player, fallbackRound = 0) {
    const pin = player?.pin || player?.guessPin || player?.currentGuess?.pin || player?.currentGuess;
    if (!pin || !guessCoords(pin)) return null;
    return {
      ...pin,
      playerId: player.playerId || player.userId || player.id,
      userId: player.userId,
      roundNumber: roundNo(pin, fallbackRound)
    };
  }

  function guessPools(value) {
    return [value?.guesses, value?.playerGuesses, value?.results, value?.roundResults].filter(Array.isArray);
  }

  function pushGuessPool(out, pool, index, mineOnly = false, currentOnly = false) {
    if (!Array.isArray(pool)) return;
    if (pool[index] && (!mineOnly || mine(pool[index]))) out.push(pool[index]);
    if (currentOnly) return;
    pool.forEach(item => {
      if (item && (!mineOnly || mine(item))) out.push(item);
    });
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

  function classicToken(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 5) return "";
    for (const key of ["token", "gameToken"]) {
      if (value[key] && typeof value[key] !== "object") return String(value[key]);
    }
    for (const key of ["payload", "data", "result", "game", "state", "currentGame"]) {
      const found = classicToken(value[key], depth + 1);
      if (found) return found;
    }
    return "";
  }

  function tokenFromUrl(url = location.href) {
    const api = String(url).match(/\/api\/v3\/(?:games|results)\/([^/?#]+)/i);
    if (api?.[1]) return decodeURIComponent(api[1]);
    const path = String(url).match(/\/(?:game|challenge)\/([^/?#]+)/i);
    return path?.[1] ? decodeURIComponent(path[1]) : "";
  }

  function duelIdFromUrl(url) {
    const match = String(url || "").match(/\/api\/duels\/([^/?#]+)/i);
    const id = match?.[1] ? decodeURIComponent(match[1]) : "";
    return id && !/^(?:ongoing|matchmaking|queue|history|summary)$/i.test(id) ? id : "";
  }

  function noGuess(value) {
    if (!value || typeof value !== "object") return false;
    // Strict boolean checks so a serialized "false" string or 0/1 flag cannot fake a no-guess.
    return Boolean(
      value.noGuess === true || value.isNoGuess === true || value.noGuessMade === true || value.didNotGuess === true ||
      value.hasGuess === false || value.timedOut === true || value.timedout === true || value.isTimedOut === true
    );
  }

  function submissionKey(token, roundNumber) {
    return `${token || "current"}:${roundNumber || "latest"}`;
  }

  function rememberSubmittedGuess(url, payload) {
    if (!payload || typeof payload !== "object") return;
    const candidate = payload.guess || payload.pin || payload.position || payload;
    if (!guessCoords(candidate) && !noGuess(candidate)) return;
    const roundNumber = roundNo(payload, roundNo(candidate, 0));

    if (duelPath()) {
      const id = duelIdFromUrl(url) || gameId(payload);
      if (id && duelState.id && id !== duelState.id) resetDuelState(id);
      else if (id) duelState.id = id;
      const storeRound = roundNumber || duelState.rounds?.length || 1;
      rememberGuess(storeRound, candidate);
      duelState.latestGuess = { value: candidate, at: Date.now() };
      return;
    }

    const token = classicToken(payload) || tokenFromUrl(url) || classicState.token || tokenFromUrl();
    if (!token) return;
    classicState.token = token;
    classicState.latestSubmission = { value: candidate, at: Date.now(), pageToken: tokenFromUrl() };
    const exact = submissionKey(token, roundNumber);
    classicState.submissions.set(exact, mergeObject(classicState.submissions.get(exact), candidate));
    classicState.submissions.set(submissionKey(token, 0), mergeObject(classicState.submissions.get(submissionKey(token, 0)), candidate));
  }

  function submittedClassicGuess(token, roundNumber) {
    return classicState.submissions.get(submissionKey(token, roundNumber)) ||
      classicState.submissions.get(submissionKey(token, 0)) ||
      (Date.now() - (classicState.latestSubmission?.at || 0) < 120000 && classicState.latestSubmission?.pageToken === tokenFromUrl()
        ? classicState.latestSubmission.value
        : null);
  }

  function resetDuelState(id = "") {
    duelState.id = id;
    duelState.teams = null;
    duelState.rounds = null;
    duelState.guesses = new Map();
    duelState.completed = new Set();
    duelState.lastFetch = 0;
    duelState.lastUpdate = 0;
    duelState.revealUntil = 0;
    duelState.latestGuess = null;
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
    const team = myTeam(teams);
    const ownTeamMode = teamHasMultiplePlayers(team);
    const out = ownTeamMode ? roundGuesses(round).filter(mine) : [...roundGuesses(round)];
    if (team) {
      for (const pool of guessPools(team)) pushGuessPool(out, pool, index, ownTeamMode, ownTeamMode);
      const players = ownTeamMode ? ownPlayers(team) : teamPlayers(team);
      for (const player of players) {
        for (const pool of guessPools(player)) pushGuessPool(out, pool, index, false, ownTeamMode);
        const pin = playerPinGuess(player, 0);
        const pinRound = roundNo(pin, 0);
        if (pin && (pinRound ? pinRound === index + 1 : index === (duelState.rounds?.length || 1) - 1)) out.push(pin);
      }
    } else if (Array.isArray(teams) && teams.length) {
      // Identity not resolved yet: surface every team's results and pins so coordinate matching can attribute the guess.
      for (const anyTeam of teams) {
        if (!anyTeam) continue;
        for (const pool of guessPools(anyTeam)) pushGuessPool(out, pool, index, false, false);
        for (const player of teamPlayers(anyTeam)) {
          for (const pool of guessPools(player)) pushGuessPool(out, pool, index, false, false);
          const pin = playerPinGuess(player, 0);
          if (pin) out.push(pin);
        }
      }
    }
    const banked = duelState.guesses.get(index + 1);
    if (banked) out.push(banked);
    // Include every banked pin in case the submission landed under the wrong round index (rounds not yet loaded).
    duelState.guesses.forEach((guess) => { if (guess && guess !== banked) out.push(guess); });
    return out.filter(Boolean);
  }

  function pointsSame(a, b) {
    if (!a || !b) return false;
    return metersBetween(a, b) <= 25;
  }

  function compatibleGuess(base, candidate) {
    if (!base || !candidate || base === candidate) return false;
    if (!guessCoords(candidate) && !code(candidate)) return false;
    // Same map pin = same guess, even when the player identity could not be resolved.
    const basePoint = guessCoords(base);
    const candidatePoint = guessCoords(candidate);
    if (basePoint && candidatePoint && pointsSame(basePoint, candidatePoint)) return true;
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
    const candidates = guessDetailCandidates(round, teams, index);

    // Phase 1: standard compatible merge (coords / score / identity matching)
    for (const candidate of candidates) {
      if (compatibleGuess(merged, candidate)) merged = mergeGuess(merged, candidate);
    }

    // Phase 2: complementary merge.
    // In duels the player pin (lat/lng, no score) and the round result (score, no coords)
    // arrive as separate objects that compatibleGuess cannot join.  When we still lack
    // coords or score, scan the candidates for the missing piece.
    const mergedPoint = guessCoords(merged);
    const needsCoords = !mergedPoint;
    const needsScore = !hasNumericScore(merged) && !hasDistance(merged);
    if (needsCoords || needsScore) {
      const team = myTeam(teams);
      for (const candidate of candidates) {
        if (candidate === merged) continue;
        const candidatePoint = guessCoords(candidate);
        // Skip candidates whose coords conflict with what we already have.
        if (mergedPoint && candidatePoint && !pointsSame(mergedPoint, candidatePoint)) continue;
        const givesCoords = needsCoords && candidatePoint;
        const givesScore = needsScore && (hasNumericScore(candidate) || hasDistance(candidate));
        if (!givesCoords && !givesScore) continue;
        // When identity is resolved, all candidates already belong to my team.
        // When unresolved, only accept coord-bearing candidates (pin) or score-only
        // candidates whose value is consistent with the base.
        merged = mergeGuess(merged, candidate);
        if (!needsCoords || guessCoords(merged)) break;
      }
    }

    return merged;
  }

  function rememberGuess(roundNumber, guess) {
    if (!roundNumber || !guessReady(guess)) return;
    duelState.guesses.set(roundNumber, mergeGuess(duelState.guesses.get(roundNumber), guess));
  }

  function rememberTeamGuesses(team) {
    if (!team) return;
    const ownTeamMode = teamHasMultiplePlayers(team);
    // Determine the most-recently completed round from this team's results so the
    // live pin is banked under the SAME round number as its score.  Using
    // duelState.rounds.length (total rounds) put the pin under the wrong key.
    const teamResults = guessPools(team).flat();
    const maxResultRound = teamResults.map(g => roundNo(g, 0)).filter(Boolean).reduce((max, r) => Math.max(max, r), 0);
    const pinFallbackRound = maxResultRound || duelState.rounds?.length || 1;

    for (const pool of guessPools(team)) {
      pool.forEach((guess, index) => {
        if (!ownTeamMode || mine(guess)) rememberGuess(roundNo(guess, index + 1), guess);
      });
    }
    const players = ownTeamMode ? ownPlayers(team) : teamPlayers(team);
    for (const player of players) {
      for (const pool of guessPools(player)) pool.forEach((guess, index) => rememberGuess(roundNo(guess, index + 1), guess));
      const pin = playerPinGuess(player, pinFallbackRound);
      if (pin) rememberGuess(roundNo(pin, pinFallbackRound), pin);
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
      if (teamHasMultiplePlayers(value) && mineOwner(value)) {
        rememberTeamGuesses(value);
        continue;
      }
      if (!mineOwner(value)) continue;
      for (const pool of guessPools(value)) {
        pool.forEach((guess, index) => {
          const fallbackRound = pool.length === 1 && ownerRound ? ownerRound : index + 1;
          rememberGuess(roundNo(guess, fallbackRound), guess);
        });
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
      const fromTeam = teamGuess(team, index, { ownOnly: true });
      if (fromTeam) return mergeGuess(fromTeam, banked);
    }

    if (banked) return banked;
    // Fall back to the most recently submitted pin (it may have been banked before the round index was known).
    if (duelState.latestGuess && Date.now() - duelState.latestGuess.at < 180000) {
      return duelState.latestGuess.value;
    }
    // Last resort: pull a player pin directly from the teams (handles the case
    // where the submission wasn't captured but the WebSocket state includes it).
    if (team) {
      for (const player of teamPlayers(team)) {
        const pin = playerPinGuess(player, index + 1);
        if (pin) return pin;
      }
    }
    return null;
  }

  function roundGuesses(round) {
    return [
      ...(round?.guesses || []),
      ...(round?.playerGuesses || []),
      ...(round?.results || []),
      ...(round?.roundResults || [])
    ].filter(Boolean);
  }

  function teamGuess(team, index, options = {}) {
    if (!team) return null;
    const ownOnly = Boolean(options.ownOnly);
    const ownTeamMode = ownOnly && teamHasMultiplePlayers(team);

    for (const player of ownPlayers(team)) {
      for (const pool of guessPools(player)) if (pool[index]) return pool[index];
    }

    for (const pool of guessPools(team)) {
      if (pool[index] && (!ownTeamMode || mine(pool[index]))) return pool[index];
      if (ownTeamMode) {
        const explicit = pool.find(item => mine(item) && roundNo(item, 0) === index + 1);
        if (explicit) return explicit;
      }
    }

    if (ownTeamMode) return null;

    for (const player of teamPlayers(team)) {
      for (const pool of guessPools(player)) if (pool[index]) return pool[index];
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
    let newlyResolved = null;
    for (let i = 0; i < activeRounds.length; i += 1) {
      const round = activeRounds[i];
      if (!round) continue;
      
      const roundNumber = n(round.roundNumber, round.round, i + 1);
      
      const guess = enrichGuess(guessFor(round, state, activeTeams, i), round, activeTeams, i);
      if (!guess) continue;
      if (!hasScore(guess) && !hasDistance(guess)) continue;
      const playerGuess = guess;
      
      const guessedPoint = guessCoords(playerGuess);
      const reportedDistance = hasDistance(playerGuess) ? distance(playerGuess) : null;
      const target = duelTarget(round, guessedPoint, reportedDistance);
      const actualPoint = target.point;
      const actualMeta = await geoMeta(actualPoint);
      let actual = target.code || actualMeta.countryCode;
      if (!actual) continue;

      const guessedMeta = await geoMeta(guessedPoint);
      let guessed = code(playerGuess) || code(playerGuess.guess) || guessedMeta.countryCode;
      if (!guessed && !noGuess(playerGuess)) continue;
      
      const baseDamage = getRoundDamage(round, activeTeams, i, playerGuess);
      const dist = reportedDistance || metersBetween(actualPoint, guessedPoint);
      
      const saved = await save({
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
      if (!saved) continue;
      latest = saved;
      const resolvedKey = `${activeId}_${roundNumber}`;
      if (!duelState.completed.has(resolvedKey)) {
        duelState.completed.add(resolvedKey);
        newlyResolved = saved;
      }
    }
    
    // A newly scored round is the authoritative reveal signal. GeoGuessr can leave
    // stale result controls in the DOM, so resultVisible() is intentionally not required.
    if (newlyResolved && !activeGuessVisible()) {
      duelState.revealUntil = Date.now() + 15000;
      show(newlyResolved);
    }
    else if (latest && resultVisible()) show(latest);
    return latest;
  }

  async function processClassic(payload) {
    if (duelPath() || !capture) return null;
    const initial = capture.selectClassic(payload);
    const token = initial.token || classicToken(payload) || classicState.token || tokenFromUrl();
    if (!token || !resultVisible()) return null;
    classicState.token = token;

    const wantedRound = Math.max(initial.roundNumber, visibleRoundNumber());
    const earlySubmission = submittedClassicGuess(token, wantedRound);
    const earlyFrame = capture.selectClassic(payload, [], earlySubmission);
    const needsDetails = !earlyFrame.round || !earlyFrame.guess ||
      (!guessCoords(earlyFrame.guess) && !code(earlyFrame.guess) && !noGuess(earlyFrame.guess));
    const details = needsDetails
      ? await fetchClassicDetails(token, wantedRound)
      : (classicState.details.get(token) || []);
    const provisional = capture.selectClassic(payload, details);
    const submitted = submittedClassicGuess(token, provisional.roundNumber);
    const frame = capture.selectClassic(payload, details, submitted);
    const { roundNumber, round, guess } = frame;
    const actualPoint = correctCoords(round);
    let guessedPoint = guessCoords(guess);
    // Recover the pin when the API guess slot lacks coordinates (GeoGuessr sometimes omits lat/lng from the result payload).
    if (!guessedPoint && submitted) guessedPoint = guessCoords(submitted);
    if (!guessedPoint && round) {
      const roundPin = roundGuesses(round).map(guessCoords).find(Boolean);
      if (roundPin) guessedPoint = roundPin;
    }
    const actualMeta = await geoMeta(actualPoint);
    const guessedMeta = await geoMeta(guessedPoint);
    let actual = code(round) || actualMeta.countryCode;
    let guessed = code(guess) || code(guess?.guess) || guessedMeta.countryCode;
    if (!actual || !guess) return null;
    if (!guessed && !noGuess(guess)) return null;
    const saved = await save({
      gameId: token,
      roundNumber,
      mode: frame.mode || payload.mode || "classic",
      actualCode: actual,
      guessedCode: guessed,
      actualRegion: actualMeta.region,
      guessedRegion: guessedMeta.region,
      distance: distance(guess) || metersBetween(actualPoint, guessedPoint),
      score: score(guess),
      damage: 0
    });
    if (saved && resultVisible()) {
      show(saved);
    }
    return saved;
  }

  function rememberDuelParts(root) {
    if (!root || typeof root !== "object") return;
    const loose = capture?.collectDuelFragments(root) || { id: "", teams: [], rounds: [] };
    const snapshots = duelSnapshots(root);
    const id = loose.id || snapshots.map(gameId).find(Boolean) || gameId(root);
    if (id && duelState.id && id !== duelState.id) {
      resetDuelState(id);
    }
    if (id) duelState.id = id;
    const fragments = capture?.collectDuelFragments(root, duelState.id) || loose;
    for (const teams of fragments.teams) duelState.teams = mergeArray(duelState.teams, teams);
    for (const rounds of fragments.rounds) duelState.rounds = mergeArray(duelState.rounds, rounds);
    for (const snapshot of snapshots) {
      duelState.teams = mergeArray(duelState.teams, snapshot.teams);
      duelState.rounds = mergeArray(duelState.rounds, snapshot.rounds);
      rememberTeamGuesses(myTeam(snapshot.teams));
    }
    rememberTeamGuesses(myTeam(duelState.teams));
    rememberLooseGuesses(root);
    // If identity is still unresolved, try to learn it by matching the submitted
    // guess pin to a player pin in the duel state.
    if (!me.id && !me.name && duelState.latestGuess) {
      identifyMeByPin(duelState.teams, duelState.latestGuess.value);
    }
    if (fragments.teams.length || fragments.rounds.length || snapshots.length) duelState.lastUpdate = Date.now();
  }

  function identifyMeByPin(teams, submittedGuess) {
    const pin = guessCoords(submittedGuess);
    if (!pin || !Array.isArray(teams)) return;
    for (const team of teams) {
      if (!team) continue;
      for (const player of teamPlayers(team)) {
        const playerPin = playerPinGuess(player, 0);
        if (playerPin && pointsSame(guessCoords(playerPin), pin)) {
          remember(player);
          return;
        }
      }
    }
  }

  async function processPayload(payload, replay = false) {
    if (!payload || !isContextValid()) return;
    loadMe();
    learn(payload);
    if (!replay) cache.unshift(payload);
    cache.length = Math.min(cache.length, 24);
    if (duelPath()) {
      rememberDuelParts(payload);
      let id = getActiveGameId();
      if (resultVisible()) id = (await discoverOngoingDuel()) || id;
      const stale = Date.now() - duelState.lastFetch > 1800;
      if (id && ((!duelState.teams || !duelState.rounds) || (resultVisible() && stale))) {
        await fetchDuelState(id);
      }
      await processDuel(duelState);
    } else {
      await processClassic(payload);
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
    if (!isContextValid() || event.source !== window) return;
    if (event.data?.source === "GG_STUDY_FETCH_RESULT") {
      const resolve = pageRequests.get(String(event.data.requestId || ""));
      if (!resolve) return;
      pageRequests.delete(String(event.data.requestId));
      resolve(event.data.ok ? event.data.payload : null);
      return;
    }
    if (event.data?.source !== "GG_STUDY_PROBE") return;

    const id = duelIdFromUrl(event.data.url);
    if (id && duelPath()) {
      if (duelState.id && duelState.id !== id) resetDuelState(id);
      else duelState.id = id;
    }
    const token = !duelPath() ? tokenFromUrl(event.data.url) : "";
    if (token) classicState.token = token;
    if (event.data.direction === "request") {
      rememberSubmittedGuess(event.data.url, event.data.payload);
      return;
    }
    processPayload(event.data.payload);
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

    const result = resultVisible();
    const duelGrace = duelPath() && Date.now() < duelState.revealUntil && !activeGuessVisible();
    if (duelPath()) {
      const id = getActiveGameId();
      if (!id) discoverOngoingDuel();
      if (id && (!duelState.teams || !duelState.rounds || ((result || duelGrace) && Date.now() - duelState.lastFetch > 1800))) {
        fetchDuelState(id);
      }
      // Always process duel state for saving — even when the result screen has
      // already passed.  processDuel internally gates the popup on result visibility.
      if (duelState.teams && duelState.rounds) processDuel(duelState);
    }

    if (!result && !duelGrace) {
      const el = document.getElementById("ggs-overlay-panel");
      if (el) el.style.display = "none";
      return;
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
