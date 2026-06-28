(() => {
  "use strict";

  const BASE_URL = "https://www.plonkit.net";
  const TYPE_RULES = [
    ["google-car", /google car|car meta|roof rack|antenna|rifts?|blur|follow car|snorkel|tape|camera gen|coverage/i],
    ["bollards", /bollard|delineator|road post|reflector post/i],
    ["utility-poles", /utility pole|power pole|pole top|poletop|insulator|crossarm|electric pole|wooden pole|concrete pole/i],
    ["plates", /licen[cs]e plate|number plate|registration plate|plate colour|plate color/i],
    ["language", /language|alphabet|script|letter|word ending|diacritic|cyrillic|latin script|arabic|hangul|hebrew/i],
    ["driving", /drives? on the|driving side|left-hand traffic|right-hand traffic|keep left|keep right/i],
    ["road-lines", /road line|center line|centre line|edge line|road marking|lane marking/i],
    ["road-signs", /road sign|directional? sign|warning sign|speed (?:limit )?sign|route shield|highway sign|pedestrian sign|stop sign|town (?:entry|entrance) sign|street name sign|priority sign|one-way sign|chevron/i],
    ["road-furniture", /guardrail|kilomet(?:er|re) marker|road marker|curb|kerb|traffic cone|mailbox|safety barrier|reflector|hydrant|trash bin|sign post|lamp post/i],
    ["road-surface", /asphalt|concrete slab|cobblestone|unpaved|pavement|road quality|pothole|road surface|cracks? in the road/i],
    ["architecture", /architecture|building|house|roof|brick|stone wall|balcon|church|mosque|temple/i],
    ["vehicles", /taxi|truck|bus|motorbike|motorcycle|tuk-tuk|rickshaw|vehicle|car brand/i],
    ["commercial", /advert|beer brand|telecom|supermarket|company logo|petrol station|gas station/i],
    ["culture", /prayer flag|traditional clothing|folk dress|political graffiti|national flag/i],
    ["landscape", /landscape|terrain|mountain|hill|forest|vegetation|soil|desert|coast|climate|flat|tropical|farmland|grass|tree|body of water/i]
  ];

  const TAG_TYPES = {
    antenna: "google-car",
    bollard: "bollards",
    car: "google-car",
    coverage: "google-car",
    driving: "driving",
    language: "language",
    licenceplate: "plates",
    licenseplate: "plates",
    plate: "plates",
    pole: "utility-poles",
    road: "road-lines",
    roadlines: "road-lines",
    sign: "road-signs",
    signs: "road-signs"
  };

  const TYPE_LABELS = {
    "google-car": "Google car",
    bollards: "Bollards",
    "utility-poles": "Utility poles",
    plates: "License plates",
    language: "Language & script",
    driving: "Driving side",
    "road-lines": "Road markings",
    "road-signs": "Road signs",
    "road-furniture": "Road furniture",
    "road-surface": "Road surface",
    architecture: "Architecture",
    vehicles: "Vehicles",
    commercial: "Brands & services",
    culture: "Culture & flags",
    landscape: "Landscape",
    general: "High-value clue"
  };

  const ISRAEL_FALLBACK = {
    title: "Israel",
    code: "IL",
    slug: "israel",
    sourceUrl: "https://commons.wikimedia.org/wiki/Category:Road_transport_in_Israel",
    sourceLabel: "Wikimedia Commons",
    overviewImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Highway_461_-_Israel_2024_01.jpg/960px-Highway_461_-_Israel_2024_01.jpg",
    clues: [
      {
        id: "israel-language-sign",
        type: "language",
        title: "Language & road signs",
        text: "Direction signs commonly combine Hebrew, Arabic, and English. The three-script stack is one of Israel's clearest road clues.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Highway_sign_of_Israel_directing_towards_Bet-She%27an.svg/960px-Highway_sign_of_Israel_directing_towards_Bet-She%27an.svg.png",
        imageLink: "https://commons.wikimedia.org/wiki/File:Highway_sign_of_Israel_directing_towards_Bet-She%27an.svg",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Highway_sign_of_Israel_directing_towards_Bet-She%27an.svg",
        sourceLabel: "Wikimedia Commons - public domain",
        priority: 100
      },
      {
        id: "israel-plates",
        type: "plates",
        title: "License plates",
        text: "Standard Israeli plates are yellow with dark digits, making visible traffic a strong beginner clue.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/66/Car_vehicle_israel_license_plate_%284893367447%29.jpg",
        imageLink: "https://commons.wikimedia.org/wiki/File:Car_vehicle_israel_license_plate_(4893367447).jpg",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Car_vehicle_israel_license_plate_(4893367447).jpg",
        sourceLabel: "Wikimedia Commons - CC BY 2.0",
        priority: 95
      },
      {
        id: "israel-road",
        type: "road-signs",
        title: "Road environment",
        text: "Modern divided roads, dry Mediterranean vegetation, pale stone, and dense Hebrew signage often appear together.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Highway_461_-_Israel_2024_01.jpg/960px-Highway_461_-_Israel_2024_01.jpg",
        imageLink: "https://commons.wikimedia.org/wiki/File:Highway_461_-_Israel_2024_01.jpg",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Highway_461_-_Israel_2024_01.jpg",
        sourceLabel: "Wikimedia Commons - CC BY-SA 4.0",
        priority: 85
      }
    ]
  };

  function absoluteUrl(value) {
    if (!value) return "";
    try { return new URL(value, BASE_URL).href; } catch (e) { return ""; }
  }

  function decodeEntities(text) {
    return String(text || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  function stripMarkdown(value) {
    const text = Array.isArray(value) ? value.join(" ") : String(value || "");
    return decodeEntities(text)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\*\*|__|~~|`/g, "")
      .replace(/^\s*(?:NOTE|TIP):?\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function inferType(text, tags = []) {
    for (const tag of tags) {
      const mapped = TAG_TYPES[String(tag || "").toLowerCase().replace(/[^a-z]/g, "")];
      if (mapped) return mapped;
    }
    for (const [type, rule] of TYPE_RULES) {
      if (rule.test(text)) return type;
    }
    return "general";
  }

  function extractPreloadedData(html) {
    const match = String(html || "").match(/<script\s+id=["']__PRELOADED_DATA__["'][^>]*>\s*([\s\S]*?)\s*<\/script>/i);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch (e) { return null; }
  }

  function guideFromHtml(html, requestedSlug = "") {
    const payload = extractPreloadedData(html);
    const guide = payload?.data?.public;
    if (!guide || !guide.slug || !Array.isArray(guide.steps)) {
      return requestedSlug === "israel" ? ISRAEL_FALLBACK : null;
    }

    const identifying = guide.steps.find(step => /identif|country/i.test(step?.title || "")) || guide.steps[0];
    const clues = [];
    const seen = new Set();
    let overviewImage = absoluteUrl(guide.heroImage);

    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (node.kind === "centeredImage" && node.imageUrl && !overviewImage) {
        overviewImage = absoluteUrl(node.imageUrl);
      }
      if (node.kind === "tip" && node.data) {
        const text = stripMarkdown(node.data.text || node.text);
        const image = node.data.image || node.image || {};
        const imageUrl = absoluteUrl(image.imageUrl || node.imageUrl);
        const tags = Array.isArray(node.tags) ? node.tags : [];
        const key = `${imageUrl}|${text}`;
        if (text && imageUrl && !seen.has(key)) {
          seen.add(key);
          const type = inferType(text, tags);
          clues.push({
            id: `${guide.code || requestedSlug}-${clues.length + 1}`,
            type,
            title: TYPE_LABELS[type] || TYPE_LABELS.general,
            text: text.slice(0, 360),
            imageUrl,
            imageLink: absoluteUrl(image.imageLink) || `${BASE_URL}/${guide.slug}`,
            sourceUrl: `${BASE_URL}/${guide.slug}`,
            sourceLabel: "Plonk It",
            tags,
            priority: Math.max(35, 100 - clues.length * 3)
          });
        }
      }
      for (const key of ["items", "children", "columns", "content"]) {
        const value = node[key] || node.data?.[key];
        if (Array.isArray(value)) value.forEach(visit);
      }
    }

    visit(identifying);
    if (!clues.length && requestedSlug === "israel") return ISRAEL_FALLBACK;
    return {
      title: guide.title || requestedSlug,
      code: guide.code || "",
      slug: guide.slug,
      sourceUrl: `${BASE_URL}/${guide.slug}`,
      sourceLabel: "Plonk It",
      overviewImage,
      clues: clues.slice(0, 30)
    };
  }

  globalThis.RoundScoutGuideParser = {
    guideFromHtml,
    inferType,
    stripMarkdown,
    TYPE_LABELS
  };
})();
