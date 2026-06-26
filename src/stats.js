(() => {
  "use strict";

  const METERS_TO_MILES = 0.000621371;
  const UNKNOWN = "UNKNOWN";
  const displayNames = (() => {
    try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { return null; }
  })();

  let masterRounds = [];
  let currentFilter = "all";
  let sortColumn = "ev";
  let sortAscending = false;
  let lastDataSignature = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    setupEventListeners();
    refreshData();

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes.ggStudyRounds) return;
        const nextRounds = dedupeRounds(changes.ggStudyRounds.newValue || []);
        const signature = dataSignature(nextRounds);
        if (signature === lastDataSignature) return;
        masterRounds = nextRounds;
        lastDataSignature = signature;
        renderDashboard();
      });
    }

    setInterval(refreshData, 3000);
  }

  function setupEventListeners() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", event => {
        document.querySelectorAll(".nav-btn").forEach(item => item.classList.remove("active"));
        event.currentTarget.classList.add("active");
        currentFilter = event.currentTarget.dataset.filter || "all";
        renderDashboard();
      });
    });

    document.querySelectorAll("#matrix-table th").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (!col) return;
        if (sortColumn === col) {
          sortAscending = !sortAscending;
        } else {
          sortColumn = col;
          sortAscending = col === "country";
        }
        renderDashboard();
      });
    });

    document.getElementById("export-btn")?.addEventListener("click", exportData);
    document.getElementById("import-btn")?.addEventListener("click", () => document.getElementById("file-input")?.click());
    document.getElementById("file-input")?.addEventListener("change", importData);
    document.getElementById("clear-btn")?.addEventListener("click", wipeData);
  }

  async function refreshData() {
    const res = await chrome.storage.local.get("ggStudyRounds");
    const raw = Array.isArray(res.ggStudyRounds) ? res.ggStudyRounds : [];
    const nextRounds = dedupeRounds(raw);
    const signature = dataSignature(nextRounds);
    if (nextRounds.length !== raw.length) {
      await chrome.storage.local.set({ ggStudyRounds: nextRounds });
    }
    if (signature === lastDataSignature) return;
    masterRounds = nextRounds;
    lastDataSignature = signature;
    renderDashboard();
  }

  function dataSignature(rounds) {
    return rounds.map(round => [
      round.id,
      round.mode,
      round.roundNumber,
      cc(round.actualCode),
      cc(round.guessedCode),
      round.actualRegion || "",
      round.guessedRegion || "",
      Math.round(num(round.distance)),
      Math.round(num(round.score)),
      Math.round(num(round.damage))
    ].join("|")).join(";");
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
    ].filter(value => value != null && value !== "" && value !== UNKNOWN).length;
  }

  function dedupeRounds(rounds) {
    const byId = new Map();
    for (const round of rounds) {
      if (!round || typeof round !== "object") continue;
      const id = round.id || fallbackRoundKey(round);
      const normalized = { ...round, id };
      const previous = byId.get(id);
      if (!previous || roundQuality(normalized) >= roundQuality(previous)) byId.set(id, normalized);
    }

    const result = [];
    const seen = new Map();
    byId.forEach(round => {
      const bucket = round.timestamp ? Math.floor(Number(round.timestamp) / 240000) : 0;
      const key = [
        round.mode || "",
        round.gameId || "",
        round.roundNumber || "",
        cc(round.actualCode),
        cc(round.guessedCode),
        Math.round(Number(round.score) || 0),
        Math.round(Number(round.distance) || 0),
        Math.round(Number(round.damage) || 0),
        bucket
      ].join("|");
      const existingIndex = seen.get(key);
      if (existingIndex == null) {
        seen.set(key, result.length);
        result.push(round);
      } else if (roundQuality(round) > roundQuality(result[existingIndex])) {
        result[existingIndex] = round;
      }
    });
    return result;
  }

  function fallbackRoundKey(round) {
    return [
      round.mode || "",
      round.gameId || "",
      round.roundNumber || "",
      round.timestamp || "",
      cc(round.actualCode),
      cc(round.guessedCode)
    ].join(":");
  }

  function renderDashboard() {
    const filtered = masterRounds.filter(r => currentFilter === "all" || r.mode === currentFilter);
    const analysis = analyzeRounds(filtered);
    document.body.classList.toggle("filter-classic", currentFilter === "classic");

    setMetric("stat-total-rounds", analysis.totalRounds, scoreHeat(Math.min(analysis.totalRounds / 100, 1)));
    setMetric("stat-accuracy", `${analysis.accuracyPct.toFixed(1)}%`, scoreHeat(analysis.accuracyPct / 100));
    safeSetText("stat-accuracy-sub", `${analysis.countryCorrect} correct / ${analysis.countryWrong} wrong`);
    setMetric("stat-avg-distance", `${analysis.avgDistanceMiles.toFixed(1)} mi`, scoreHeat(1 - Math.min(analysis.avgDistanceMiles / 4500, 1)));
    setMetric("stat-avg-score", String(analysis.avgScore), scoreHeat(Math.min(analysis.avgScore / 5000, 1)));
    const avgDamage = analysis.duelRounds ? Math.round(analysis.totalDamage / analysis.duelRounds) : null;
    setMetric("stat-avg-damage", avgDamage == null ? "N/A" : signed(avgDamage), avgDamage == null ? "" : scoreHeat(Math.min(Math.max((avgDamage + 2000) / 4000, 0), 1)));

    renderStudyPlan(analysis);
    renderCountryTable(analysis.countryRows);
    renderConfusions(analysis.confusions);
    renderLogs(filtered);
    updateSortHeaders();
  }

  function analyzeRounds(rounds) {
    const countryStats = new Map();
    const confusionStats = new Map();
    const regionStats = new Map();
    let totalDistance = 0;
    let totalScore = 0;
    let totalDamage = 0;
    let duelRounds = 0;
    let countryCorrect = 0;

    for (const round of rounds) {
      const actual = cc(round.actualCode) || UNKNOWN;
      const guessed = cc(round.guessedCode) || UNKNOWN;
      const distance = num(round.distance);
      const score = num(round.score);
      const damage = num(round.damage);
      const countryHit = actual !== UNKNOWN && actual === guessed;

      totalDistance += distance;
      totalScore += score;
      if (countryHit) countryCorrect++;
      if (round.mode === "duel" && Number.isFinite(damage)) {
        totalDamage += damage;
        duelRounds++;
      }

      if (actual !== UNKNOWN) {
        if (!countryStats.has(actual)) countryStats.set(actual, freshCountryStat(actual));
        const stat = countryStats.get(actual);
        stat.samples++;
        stat.totalDist += distance;
        stat.totalScore += score;
        if (!guessed || guessed === UNKNOWN) stat.unknownGuesses++;
        if (countryHit) stat.hits++;
        if (round.mode === "duel" && Number.isFinite(damage)) {
          stat.totalDmg += damage;
          stat.duelRounds++;
        }

        if (countryHit && round.actualRegion) {
          stat.regionsEligible++;
          if (round.actualRegion === round.guessedRegion) {
            stat.regionsCorrect++;
          } else if (round.guessedRegion) {
            const key = `${actual}|${round.actualRegion}|${round.guessedRegion}`;
            const region = regionStats.get(key) || { country: actual, actualRegion: round.actualRegion, guessedRegion: round.guessedRegion, count: 0, totalDist: 0 };
            region.count++;
            region.totalDist += distance;
            regionStats.set(key, region);
          }
        }
      }

      if (actual !== UNKNOWN && actual !== guessed) {
        const key = `${actual}|${guessed || UNKNOWN}`;
        const item = confusionStats.get(key) || { actual, guessed: guessed || UNKNOWN, count: 0, totalDist: 0, totalDamage: 0, totalScore: 0 };
        item.count++;
        item.totalDist += distance;
        item.totalDamage += damage;
        item.totalScore += score;
        confusionStats.set(key, item);
      }
    }

    const countryRows = [...countryStats.values()].map(stat => {
      const misses = stat.samples - stat.hits;
      const accuracy = stat.samples ? (stat.hits / stat.samples) * 100 : 0;
      const avgDistance = stat.samples ? (stat.totalDist / stat.samples) * METERS_TO_MILES : 0;
      const avgDamage = stat.duelRounds ? stat.totalDmg / stat.duelRounds : null;
      const regionHitRate = stat.regionsEligible ? (stat.regionsCorrect / stat.regionsEligible) * 100 : null;
      const ev = studyEv(stat, avgDistance, avgDamage, regionHitRate);
      return { ...stat, misses, accuracy, avgDistance, avgDamage, regionHitRate, ev };
    });

    countryRows.sort((a, b) => compareRows(a, b));

    const confusions = [...confusionStats.values()]
      .map(item => ({
        ...item,
        avgDistance: item.count ? (item.totalDist / item.count) * METERS_TO_MILES : 0,
        avgDamage: item.count ? item.totalDamage / item.count : 0,
        avgScore: item.count ? item.totalScore / item.count : 0,
        severity: confusionSeverity(item)
      }))
      .sort((a, b) => b.severity - a.severity);

    const regionMisses = [...regionStats.values()]
      .map(item => ({ ...item, avgDistance: item.count ? (item.totalDist / item.count) * METERS_TO_MILES : 0 }))
      .sort((a, b) => b.count - a.count || b.avgDistance - a.avgDistance);

    const totalRounds = rounds.length;
    return {
      totalRounds,
      countryCorrect,
      countryWrong: totalRounds - countryCorrect,
      accuracyPct: totalRounds ? (countryCorrect / totalRounds) * 100 : 0,
      avgDistanceMiles: totalRounds ? (totalDistance / totalRounds) * METERS_TO_MILES : 0,
      avgScore: totalRounds ? Math.round(totalScore / totalRounds) : 0,
      totalDamage,
      duelRounds,
      countryRows,
      confusions,
      regionMisses
    };
  }

  function freshCountryStat(code) {
    return {
      code,
      samples: 0,
      hits: 0,
      totalDist: 0,
      totalScore: 0,
      totalDmg: 0,
      duelRounds: 0,
      regionsEligible: 0,
      regionsCorrect: 0,
      unknownGuesses: 0
    };
  }

  function studyEv(stat, avgDistance, avgDamage, regionHitRate) {
    const misses = stat.samples - stat.hits;
    const missRate = stat.samples ? misses / stat.samples : 0;
    const unknownRate = stat.samples ? stat.unknownGuesses / stat.samples : 0;
    const damageLoss = avgDamage == null ? 0 : Math.max(0, -avgDamage);
    const regionLeak = regionHitRate == null ? 0 : Math.max(0, 1 - regionHitRate / 100);
    const sampleWeight = 0.8 + Math.min(0.7, Math.log2(stat.samples + 1) / 4);
    const raw =
      missRate * 38 +
      Math.min(avgDistance / 3200, 1) * 24 +
      Math.min(damageLoss / 1600, 1) * 20 +
      regionLeak * 14 +
      unknownRate * 10;
    return Math.round(raw * sampleWeight);
  }

  function confusionSeverity(item) {
    const countPart = Math.min(item.count, 6) * 14;
    const distPart = Math.min((item.totalDist / Math.max(1, item.count)) * METERS_TO_MILES / 3500, 1) * 30;
    const damagePart = Math.min(Math.max(0, -(item.totalDamage / Math.max(1, item.count))) / 1600, 1) * 24;
    const scorePart = Math.min(Math.max(0, 5000 - item.totalScore / Math.max(1, item.count)) / 5000, 1) * 18;
    return Math.round(countPart + distPart + damagePart + scorePart);
  }

  function compareRows(a, b) {
    let left;
    let right;
    switch (sortColumn) {
      case "country":
        left = countryName(a.code).toLowerCase();
        right = countryName(b.code).toLowerCase();
        break;
      case "rounds":
        left = a.samples;
        right = b.samples;
        break;
      case "accuracy":
        left = a.accuracy;
        right = b.accuracy;
        break;
      case "distance":
        left = a.avgDistance;
        right = b.avgDistance;
        break;
      case "damage":
        left = a.avgDamage ?? -999999;
        right = b.avgDamage ?? -999999;
        break;
      case "region":
        left = a.regionHitRate ?? -1;
        right = b.regionHitRate ?? -1;
        break;
      case "ev":
      default:
        left = a.ev;
        right = b.ev;
        break;
    }
    if (left < right) return sortAscending ? -1 : 1;
    if (left > right) return sortAscending ? 1 : -1;
    return b.samples - a.samples;
  }

  function renderStudyPlan(analysis) {
    const root = document.getElementById("study-plan-list");
    if (!root) return;
    root.innerHTML = "";

    const cards = [];
    for (const row of analysis.countryRows.filter(item => item.misses || item.ev >= 25).slice(0, 3)) {
      cards.push({
        tag: "Country leak",
        title: `Review ${countryName(row.code)} fundamentals`,
        body: `${row.misses}/${row.samples} missed, ${row.avgDistance.toFixed(0)} mi avg miss. Focus on ${countryTopic(row.code)}.`
      });
    }

    for (const item of analysis.confusions.slice(0, 3)) {
      cards.push({
        tag: `${item.count}x mix-up`,
        title: `${countryName(item.actual)} vs ${countryName(item.guessed)}`,
        body: `${item.avgDistance.toFixed(0)} mi avg miss. ${pairTopic(item.actual, item.guessed)}`
      });
    }

    for (const item of analysis.regionMisses.slice(0, 2)) {
      cards.push({
        tag: "Region practice",
        title: `Narrow ${countryName(item.country)}`,
        body: `${item.actualRegion} guessed as ${item.guessedRegion}. Country is right, so the EV is regional signs, landscape zones, and city/province clues.`
      });
    }

    const patternCards = patternStudyCards(analysis.confusions);
    cards.push(...patternCards);

    const unique = [];
    const seen = new Set();
    for (const card of cards) {
      const key = `${card.tag}|${card.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(card);
      if (unique.length >= 6) break;
    }

    if (!unique.length) {
      root.innerHTML = `<div class="empty-state-text">Play a few more rounds and this will turn into a prioritized study list.</div>`;
      return;
    }

    for (const card of unique) {
      const div = document.createElement("div");
      div.className = "study-item";
      div.innerHTML = `
        <span class="study-tag">${escapeHtml(card.tag)}</span>
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.body)}</p>
      `;
      root.appendChild(div);
    }
  }

  function patternStudyCards(confusions) {
    const buckets = new Map();
    for (const item of confusions) {
      const topic = pairTopic(item.actual, item.guessed);
      const key = topic.split(".")[0];
      const bucket = buckets.get(key) || { key, score: 0, examples: [] };
      bucket.score += item.severity;
      bucket.examples.push(`${countryName(item.actual)} vs ${countryName(item.guessed)}`);
      buckets.set(key, bucket);
    }
    return [...buckets.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(bucket => ({
        tag: "Pattern drill",
        title: bucket.key,
        body: `Examples from your data: ${bucket.examples.slice(0, 3).join(", ")}.`
      }));
  }

  function renderCountryTable(rows) {
    const body = document.getElementById("matrix-body");
    if (!body) return;
    body.innerHTML = "";
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty-state-text">No country stats yet.</td></tr>`;
      return;
    }

    for (const row of rows) {
      const tr = document.createElement("tr");
      const regionText = row.regionHitRate == null ? "-" : `${row.regionHitRate.toFixed(0)}%`;
      const dmg = row.avgDamage == null ? "N/A" : signed(Math.round(row.avgDamage));
      const dmgStyle = row.avgDamage == null ? "" : scoreHeat(Math.min(Math.max((row.avgDamage + 2000) / 4000, 0), 1));
      tr.innerHTML = `
        <td><span class="heat-pill" style="${scoreHeat(1 - Math.min(row.ev / 100, 1))}">${row.ev}</span></td>
        <td>${countryCell(row.code)}</td>
        <td>${row.samples}</td>
        <td><span class="heat-pill" style="${scoreHeat(row.accuracy / 100)}">${row.accuracy.toFixed(0)}%</span></td>
        <td><span class="heat-pill wide" style="${scoreHeat(1 - Math.min(row.avgDistance / 4500, 1))}">${row.avgDistance.toFixed(1)} mi</span></td>
        <td><span class="heat-pill" style="${dmgStyle}">${dmg}</span></td>
        <td><span class="heat-pill" style="${row.regionHitRate == null ? "" : scoreHeat(row.regionHitRate / 100)}">${regionText}</span></td>
      `;
      body.appendChild(tr);
    }
  }

  function renderConfusions(confusions) {
    const root = document.getElementById("confusion-list");
    if (!root) return;
    root.innerHTML = "";
    if (!confusions.length) {
      root.innerHTML = `<div class="empty-state-text">No repeated country mix-ups yet.</div>`;
      return;
    }

    for (const item of confusions.slice(0, 18)) {
      const div = document.createElement("div");
      div.className = "confusion-item";
      div.innerHTML = `
        <div class="pair-line">
          ${flag(item.actual)} <span>${escapeHtml(countryName(item.actual))}</span>
          <span class="region-text">-></span>
          ${flag(item.guessed)} <span>${escapeHtml(countryName(item.guessed))}</span>
        </div>
        <div class="confusion-meta">
          <span>${item.count} miss${item.count === 1 ? "" : "es"}</span>
          <span>${item.avgDistance.toFixed(0)} mi avg</span>
          <span class="heat-pill" style="${scoreHeat(1 - Math.min(item.severity / 140, 1))}">${item.severity} severity</span>
          <span>${signed(Math.round(item.avgDamage))} dmg</span>
        </div>
      `;
      root.appendChild(div);
    }
  }

  function renderLogs(rounds) {
    const body = document.getElementById("log-body");
    if (!body) return;
    body.innerHTML = "";
    if (!rounds.length) {
      body.innerHTML = `<tr><td colspan="9" class="empty-state-text">No saved rounds yet.</td></tr>`;
      return;
    }

    const sorted = rounds.slice().sort((a, b) => num(b.timestamp) - num(a.timestamp));
    for (const round of sorted) {
      const tr = document.createElement("tr");
      const actual = cc(round.actualCode) || UNKNOWN;
      const guessed = cc(round.guessedCode) || UNKNOWN;
      const hasDmg = round.mode === "duel" && round.damage != null;
      const dmg = hasDmg ? signed(Math.round(num(round.damage))) : "N/A";
      const scoreValue = Math.round(num(round.score));
      const milesValue = num(round.distance) * METERS_TO_MILES;
      const dmgStyle = hasDmg ? scoreHeat(Math.min(Math.max((num(round.damage) + 2000) / 4000, 0), 1)) : "";
      tr.innerHTML = `
        <td>${formatTime(round.timestamp)}</td>
        <td><span class="mode-badge ${escapeAttr(round.mode || "classic")}">${escapeHtml(round.mode || "classic")}</span></td>
        <td><code>${escapeHtml(shortId(round.gameId))}</code> <span class="region-text">R${escapeHtml(String(round.roundNumber || "-"))}</span></td>
        <td>${countryCell(actual, round.actualRegion)}</td>
        <td>${countryCell(guessed, round.guessedRegion)}${regionMarker(round)}</td>
        <td><span class="heat-pill wide" style="${num(round.distance) ? scoreHeat(1 - Math.min(milesValue / 4500, 1)) : ""}">${num(round.distance) ? `${milesValue.toFixed(1)} mi` : "-"}</span></td>
        <td><span class="heat-pill" style="${scoreHeat(Math.min(scoreValue / 5000, 1))}">${scoreValue}</span></td>
        <td><span class="heat-pill" style="${dmgStyle}">${dmg}</span></td>
        <td><button class="delete-log-btn" title="Remove this saved round" data-id="${escapeAttr(round.id)}">x</button></td>
      `;
      tr.querySelector(".delete-log-btn")?.addEventListener("click", () => dropRound(round.id));
      body.appendChild(tr);
    }
  }

  function updateSortHeaders() {
    document.querySelectorAll("#matrix-table th").forEach(th => {
      const base = th.dataset.label || th.textContent.replace(/\s[\^v]$/, "");
      th.dataset.label = base;
      th.textContent = th.dataset.sort === sortColumn ? `${base} ${sortAscending ? "^" : "v"}` : base;
    });
  }

  async function dropRound(id) {
    masterRounds = masterRounds.filter(round => round.id !== id);
    await chrome.storage.local.set({ ggStudyRounds: masterRounds });
    renderDashboard();
  }

  function exportData() {
    const url = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(masterRounds, null, 2));
    const link = document.createElement("a");
    link.href = url;
    link.download = `geoguessr-study-backup-${Date.now()}.json`;
    link.click();
  }

  function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) throw new Error("Expected an array");
        masterRounds = dedupeRounds([...masterRounds, ...imported]);
        await chrome.storage.local.set({ ggStudyRounds: masterRounds });
        renderDashboard();
      } catch (err) {
        alert("That JSON backup could not be imported.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function wipeData() {
    if (!confirm("Clear all saved GeoGuessr study stats?")) return;
    masterRounds = [];
    await chrome.storage.local.set({ ggStudyRounds: masterRounds });
    renderDashboard();
  }

  function countryTopic(code) {
    if (isBalkan(code)) return "Balkan scripts, bollards, plates, utility poles, and mountain/coastal landscape splits";
    if (isBaltic(code)) return "Baltic language endings, road signs, flat landscapes, and pole differences";
    if (isEurope(code)) return "European bollards, plates, road lines, sign colors, and language separators";
    if (isAsia(code)) return "scripts, driving side, pole styles, road surface, and tropical vs mountain clues";
    if (isSouthAmerica(code)) return "road lines, license plates, soil color, vegetation, and Andes vs pampas landscapes";
    if (["US", "CA"].includes(code)) return "road shields, lane width, plates, speed units, and regional vegetation";
    if (["AU", "NZ"].includes(code)) return "left-side driving, road lines, bollards, poles, and dry vs green landscapes";
    return "language/script, plates, road furniture, poles, architecture, and landscape";
  }

  function pairTopic(actual, guessed) {
    const pair = [actual, guessed];
    if (pair.every(isBalkan)) return "Learn Balkan separators: Cyrillic vs Latin scripts, bollards, plates, roofs, and mountain road feel.";
    if (pair.every(isBaltic)) return "Learn Baltic separators: language endings, flat roads, signs, poles, and coastal/forest feel.";
    if (pair.every(isEurope)) return "Learn European road furniture: bollards, plates, road edge lines, sign colors, and town architecture.";
    if (pair.every(isAsia)) return "Learn Asian script and traffic separators: alphabet, driving side, pole style, road surface, and tropical density.";
    if (pair.every(isSouthAmerica)) return "Learn South America separators: road lines, plates, soil, vegetation, and Andes/pampas/coastal landscapes.";
    if (pair.some(code => ["US", "CA"].includes(code))) return "Review North American separators: road shields, plates, speed units, lane width, and regional landscape.";
    if (pair.some(code => ["AU", "NZ"].includes(code))) return "Review Oceania separators: left-side clues, road lines, bollards, poles, and dry vs green scenery.";
    return "Review the high-signal basics: language/script, plates, road furniture, utility poles, architecture, and landscape.";
  }

  function isEurope(code) {
    return ["AL","AD","AT","BA","BE","BG","CH","CZ","DE","DK","EE","ES","FI","FR","GB","GR","HR","HU","IE","IS","IT","LT","LU","LV","ME","MK","NL","NO","PL","PT","RO","RS","SE","SI","SK","UA"].includes(code);
  }

  function isBalkan(code) {
    return ["AL","BA","BG","GR","HR","ME","MK","RO","RS","SI"].includes(code);
  }

  function isBaltic(code) {
    return ["EE","LT","LV"].includes(code);
  }

  function isAsia(code) {
    return ["BD","BT","KH","ID","IN","JP","KG","KZ","LA","LK","MY","MN","NP","PH","SG","TH","TR","VN"].includes(code);
  }

  function isSouthAmerica(code) {
    return ["AR","BO","BR","CL","CO","EC","PE","PY","UY"].includes(code);
  }

  function countryCell(code, region) {
    const clean = cc(code);
    const regionText = region ? ` <span class="region-text">- ${escapeHtml(region)}</span>` : "";
    return `<span class="country-cell">${flag(clean)} <span>${escapeHtml(countryName(clean))}</span>${regionText}</span>`;
  }

  function flag(code) {
    const clean = cc(code);
    if (!/^[A-Z]{2}$/.test(clean)) return `<span title="Unknown">-</span>`;
    const name = escapeAttr(countryName(clean));
    return `<img class="flag-img" src="https://flagcdn.com/${clean.toLowerCase()}.svg" alt="${name}" title="${name}">`;
  }

  function regionMarker(round) {
    const actual = cc(round.actualCode);
    const guessed = cc(round.guessedCode);
    if (!actual || actual !== guessed || !round.actualRegion) return "";
    return round.actualRegion === round.guessedRegion
      ? ` <span class="text-success" title="Region hit">[ok]</span>`
      : ` <span class="text-danger" title="Country right, region wrong">[region]</span>`;
  }

  function countryName(code) {
    const clean = cc(code);
    if (!clean || clean === UNKNOWN) return "Unknown";
    try { return displayNames?.of(clean) || clean; } catch (e) { return clean; }
  }

  function formatTime(timestamp) {
    if (!timestamp) return "N/A";
    try {
      return new Date(timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "N/A";
    }
  }

  function shortId(value) {
    return value && value !== "undefined" ? String(value).slice(0, 8) : "Live";
  }

  function signed(value) {
    if (!Number.isFinite(value)) return "N/A";
    return value > 0 ? `+${value}` : String(value);
  }

  function cc(value) {
    return typeof value === "string" ? value.trim().toUpperCase() : "";
  }

  function num(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function setMetric(id, value, style) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    el.setAttribute("style", style || "");
  }

  function scoreHeat(ratio) {
    const clean = Math.max(0, Math.min(1, Number(ratio) || 0));
    const hue = Math.round(350 + clean * 130);
    const normalizedHue = hue > 360 ? hue - 360 : hue;
    const bgA = `hsla(${normalizedHue}, 88%, 48%, 0.16)`;
    const bgB = `hsla(${normalizedHue}, 88%, 58%, 0.32)`;
    const fg = `hsl(${normalizedHue}, 95%, ${clean > 0.62 ? 72 : 66}%)`;
    const border = `hsla(${normalizedHue}, 88%, 55%, 0.42)`;
    return `--heat-color:${fg};color:${fg};background:linear-gradient(90deg,${bgA},${bgB});border-color:${border};box-shadow:inset 0 -1px 0 ${border};`;
  }

  function safeSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
