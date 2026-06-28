(() => {
  "use strict";

  const TYPE_META = {
    "google-car": { label: "Google car", icon: "camera", weight: 98 },
    bollards: { label: "Bollards", icon: "post", weight: 94 },
    "utility-poles": { label: "Utility poles", icon: "pole", weight: 92 },
    plates: { label: "License plates", icon: "plate", weight: 90 },
    language: { label: "Language & script", icon: "text", weight: 88 },
    driving: { label: "Driving side", icon: "road", weight: 86 },
    "road-lines": { label: "Road markings", icon: "lines", weight: 84 },
    "road-signs": { label: "Road signs", icon: "sign", weight: 82 },
    "road-furniture": { label: "Road furniture", icon: "barrier", weight: 80 },
    "road-surface": { label: "Road surface", icon: "surface", weight: 76 },
    architecture: { label: "Architecture", icon: "house", weight: 72 },
    vehicles: { label: "Vehicles", icon: "car", weight: 70 },
    culture: { label: "Culture & flags", icon: "flag", weight: 66 },
    commercial: { label: "Brands & services", icon: "shop", weight: 62 },
    landscape: { label: "Landscape", icon: "terrain", weight: 64 },
    general: { label: "High-value clue", icon: "spark", weight: 58 }
  };

  const TYPE_RULES = [
    ["google-car", /google car|car meta|roof rack|antenna|rift|blur|follow car|snorkel|camera coverage/i],
    ["bollards", /bollard|delineator|roadside post|road post|reflector post/i],
    ["utility-poles", /utility pole|power pole|concrete pole|wooden pole|pole top|insulator|crossarm|overhead wire/i],
    ["plates", /licen[cs]e plate|number plate|registration plate|yellow rear plate|white plate|eu-style plate/i],
    ["language", /language|alphabet|script|letter|word|ending|diacritic|cyrillic|latin|arabic|hangul|hebrew|signs are in/i],
    ["driving", /left-side driving|right-side driving|traffic keeps|drives on the|keep left|keep right/i],
    ["road-lines", /road line|center line|centre line|edge line|road marking|lane marking|yellow center|white edge/i],
    ["road-signs", /road sign|directional? sign|warning sign|speed (?:limit )?sign|route shield|highway sign|sign color|sign colour|pedestrian sign|stop sign|town (?:entry|entrance) sign|street name sign|priority sign|one-way sign|chevron/i],
    ["road-furniture", /guardrail|kilomet(?:er|re) marker|road marker|curb|kerb|traffic cone|mailbox|safety barrier|reflector|hydrant|trash bin|sign post|lamp post/i],
    ["road-surface", /asphalt|concrete slab|cobblestone|unpaved|pavement|road quality|pothole|road surface|cracks? in the road/i],
    ["architecture", /architecture|building|house|roof|brick|stone wall|balcon|church|mosque|temple|village/i],
    ["vehicles", /taxi|truck|bus|motorbike|motorcycle|tuk-tuk|rickshaw|vehicle|car brand/i],
    ["commercial", /advert|beer brand|telecom|supermarket|company logo|petrol station|gas station/i],
    ["culture", /prayer flag|traditional clothing|folk dress|political graffiti|national flag/i],
    ["landscape", /landscape|terrain|mountain|hill|forest|vegetation|soil|desert|coast|climate|flat|tropical|farmland|grass|scrub|pampas|tree|body of water/i]
  ];

  const GROUPS = {
    balkans: ["AL","BA","BG","GR","HR","ME","MK","RO","RS","SI"],
    baltics: ["EE","LT","LV"],
    nordics: ["DK","FI","IS","NO","SE"],
    centralEurope: ["AT","CH","CZ","DE","HU","PL","SK","SI"],
    southeastAsia: ["KH","ID","LA","MY","PH","SG","TH","VN"],
    southAsia: ["BD","BT","IN","LK","NP"],
    southAmerica: ["AR","BO","BR","CL","CO","EC","PE","PY","UY"],
    southernAfrica: ["BW","LS","SZ","ZA"],
    northAmerica: ["CA","MX","US"],
    oceania: ["AU","NZ"]
  };

  const DEFAULT_FOCUS = ["language", "driving", "plates", "road-lines", "utility-poles", "bollards", "road-signs", "road-furniture", "road-surface", "landscape", "architecture", "google-car"];
  const countries = Array.isArray(window.GG_STUDY_COUNTRIES) ? window.GG_STUDY_COUNTRIES : [];
  const profiles = new Map();

  function cc(value) {
    return String(value || "").trim().toUpperCase();
  }

  function inferType(text, tags = []) {
    const tagText = tags.join(" ").toLowerCase();
    if (/bollard/.test(tagText)) return "bollards";
    if (/pole/.test(tagText)) return "utility-poles";
    if (/licen[cs]e|plate/.test(tagText)) return "plates";
    if (/car|coverage|antenna/.test(tagText)) return "google-car";
    if (/language|script/.test(tagText)) return "language";
    for (const [type, rule] of TYPE_RULES) if (rule.test(text)) return type;
    return "general";
  }

  function mentionedCountries(text, ownCode) {
    const found = [];
    const lower = String(text || "").toLowerCase();
    for (const country of countries) {
      if (country.code === ownCode) continue;
      const names = [country.name, ...(country.aliases || [])].filter(name => String(name).length > 3);
      if (names.some(name => lower.includes(String(name).toLowerCase()))) found.push(country.code);
    }
    return found;
  }

  function buildProfile(country) {
    const clues = (country.tips || []).map((text, index) => {
      const type = inferType(text);
      return {
        id: `${country.code}-local-${index + 1}`,
        type,
        title: TYPE_META[type]?.label || TYPE_META.general.label,
        text,
        signal: Math.max(55, 96 - index * 7),
        comparisons: mentionedCountries(text, country.code),
        sourceLabel: "RoundScout"
      };
    });
    const typeCounts = new Map();
    clues.forEach(clue => typeCounts.set(clue.type, (typeCounts.get(clue.type) || 0) + 1));
    return { ...country, clues, typeCounts };
  }

  countries.forEach(country => profiles.set(country.code, buildProfile(country)));

  function groupFor(code) {
    const clean = cc(code);
    return Object.keys(GROUPS).find(group => GROUPS[group].includes(clean)) || "world";
  }

  function pairFocus(actual, guessed) {
    const a = cc(actual);
    const g = cc(guessed);
    if (!g || a === g) return ["landscape", "road-signs", "utility-poles", "bollards", "architecture", "language"];
    const group = groupFor(a);
    const sameGroup = group !== "world" && group === groupFor(g);
    if (sameGroup && group === "balkans") return ["language", "bollards", "utility-poles", "plates", "road-signs", "road-surface"];
    if (sameGroup && group === "baltics") return ["language", "road-lines", "utility-poles", "bollards", "road-signs", "road-furniture"];
    if (sameGroup && group === "nordics") return ["road-lines", "bollards", "road-signs", "road-furniture", "language", "landscape"];
    if (sameGroup && group === "centralEurope") return ["bollards", "road-signs", "road-furniture", "plates", "language", "road-lines"];
    if (sameGroup && ["southeastAsia", "southAsia"].includes(group)) return ["language", "driving", "google-car", "utility-poles", "road-surface", "vehicles"];
    if (sameGroup && group === "southAmerica") return ["language", "plates", "road-lines", "road-furniture", "utility-poles", "google-car"];
    if (sameGroup && group === "southernAfrica") return ["google-car", "driving", "road-lines", "road-furniture", "landscape", "plates"];
    if (sameGroup && group === "northAmerica") return ["road-signs", "plates", "road-lines", "road-furniture", "language", "landscape"];
    if (sameGroup && group === "oceania") return ["road-lines", "bollards", "road-furniture", "utility-poles", "road-signs", "landscape"];
    return DEFAULT_FOCUS.slice();
  }

  function typeLabel(type) {
    return TYPE_META[type]?.label || TYPE_META.general.label;
  }

  function localClues(code, guessedCode = "", limit = 5) {
    const profile = profiles.get(cc(code));
    if (!profile) return [];
    const focus = pairFocus(code, guessedCode);
    return profile.clues.slice().sort((left, right) => {
      const leftPair = left.comparisons.includes(cc(guessedCode)) ? 60 : 0;
      const rightPair = right.comparisons.includes(cc(guessedCode)) ? 60 : 0;
      const leftFocus = Math.max(0, 48 - Math.max(0, focus.indexOf(left.type)) * 7);
      const rightFocus = Math.max(0, 48 - Math.max(0, focus.indexOf(right.type)) * 7);
      return (rightPair + rightFocus + right.signal) - (leftPair + leftFocus + left.signal);
    }).slice(0, limit);
  }

  function normalizeGuideClues(guide) {
    return (guide?.clues || []).map((clue, index) => ({
      ...clue,
      type: clue.type || inferType(clue.text || "", clue.tags || []),
      title: clue.title || typeLabel(clue.type),
      priority: Number(clue.priority) || Math.max(40, 100 - index * 3)
    }));
  }

  function rankedGuideClues(guide, actual, guessed) {
    const focus = pairFocus(actual, guessed);
    const guessedName = profiles.get(cc(guessed))?.name?.toLowerCase() || "";
    return normalizeGuideClues(guide).sort((left, right) => scoreRemote(right) - scoreRemote(left));

    function scoreRemote(clue) {
      const focusIndex = focus.indexOf(clue.type);
      const focusScore = focusIndex < 0 ? 0 : 72 - focusIndex * 9;
      const direct = guessedName && String(clue.text || "").toLowerCase().includes(guessedName) ? 80 : 0;
      const visual = clue.imageUrl ? 35 : 0;
      const category = TYPE_META[clue.type]?.weight || 50;
      return clue.priority + focusScore + direct + visual + category;
    }
  }

  function firstByType(clues) {
    const map = new Map();
    clues.forEach(clue => { if (!map.has(clue.type)) map.set(clue.type, clue); });
    return map;
  }

  function buildLesson(actualCode, guessedCode, actualGuide, guessedGuide) {
    const actual = cc(actualCode);
    const guessed = cc(guessedCode);
    const focus = pairFocus(actual, guessed);
    const actualRanked = rankedGuideClues(actualGuide, actual, guessed);
    const guessedRanked = rankedGuideClues(guessedGuide, guessed, actual);
    const actualByType = firstByType(actualRanked);
    const guessedByType = firstByType(guessedRanked);
    const cards = [];
    const usedActual = new Set();

    if (guessed && guessed !== actual) {
      for (const type of focus) {
        const left = actualByType.get(type);
        const right = guessedByType.get(type);
        if (!left?.imageUrl || !right?.imageUrl) continue;
        cards.push({ kind: "compare", type, title: typeLabel(type), actual: left, guessed: right });
        usedActual.add(left.id);
        if (cards.length >= 2) break;
      }
    }

    for (const clue of actualRanked) {
      if (!clue.imageUrl || usedActual.has(clue.id)) continue;
      cards.push({ kind: "target", type: clue.type, title: typeLabel(clue.type), actual: clue });
      usedActual.add(clue.id);
      if (cards.length >= 3) break;
    }

    if (!cards.length) {
      for (const clue of localClues(actual, guessed, 3)) {
        cards.push({ kind: "target", type: clue.type, title: typeLabel(clue.type), actual: clue });
      }
    }

    const usedTypes = [...new Set(cards.map(card => card.type))];
    const focusTypes = (usedTypes.length ? usedTypes : focus).slice(0, 3);
    const actualName = profiles.get(actual)?.name || actual || "the target";
    const guessedName = profiles.get(guessed)?.name || guessed;
    let takeaway;
    if (!guessed) takeaway = `Start with ${focusTypes.map(typeLabel).join(" and ")} when ${actualName} appears again.`;
    else if (actual === guessed) takeaway = `Country right. Use ${focusTypes.map(typeLabel).join(" and ")} to make the next ${actualName} call faster and more precise.`;
    else takeaway = `To separate ${actualName} from ${guessedName}, check ${focusTypes.map(typeLabel).join(", ")} before trusting the overall landscape.`;

    return {
      cards,
      focusTypes,
      takeaway,
      actualName,
      guessedName,
      sourceUrl: actualGuide?.sourceUrl || profiles.get(actual)?.plonkit || "",
      hasVisuals: cards.some(card => card.actual?.imageUrl || card.guessed?.imageUrl)
    };
  }

  function countryFocusText(code) {
    return localClues(code, "", 4).map(clue => typeLabel(clue.type).toLowerCase()).filter((value, index, all) => all.indexOf(value) === index).join(", ");
  }

  function pairFocusText(actual, guessed) {
    const labels = pairFocus(actual, guessed).slice(0, 5).map(type => typeLabel(type).toLowerCase());
    return `Compare ${labels.join(", ")}.`;
  }

  window.GG_STUDY_CLUE_ENGINE = {
    TYPE_META,
    profiles,
    profile: code => profiles.get(cc(code)) || null,
    inferType,
    typeLabel,
    pairFocus,
    localClues,
    buildLesson,
    countryFocusText,
    pairFocusText
  };
})();
