const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadEngine() {
  const context = { window: {} };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("src/data.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("src/clues.js", "utf8"), context);
  return context.window;
}

test("all supported countries receive structured clues", () => {
  const window = loadEngine();
  assert.equal(window.GG_STUDY_COUNTRIES.length, 97);
  assert.equal(window.GG_STUDY_CLUE_ENGINE.profiles.size, 97);
  for (const country of window.GG_STUDY_COUNTRIES) {
    const profile = window.GG_STUDY_CLUE_ENGINE.profile(country.code);
    assert.ok(profile.clues.length >= 4, `${country.code} should have at least four clues`);
    profile.clues.forEach(clue => {
      assert.ok(clue.id);
      assert.ok(clue.type);
      assert.ok(clue.title);
      assert.ok(clue.text);
      assert.ok(Number.isFinite(clue.signal));
    });
  }
});

test("pair focus changes for meaningful country groups", () => {
  const { GG_STUDY_CLUE_ENGINE: engine } = loadEngine();
  assert.deepEqual(Array.from(engine.pairFocus("GR", "BG")).slice(0, 3), ["language", "bollards", "utility-poles"]);
  assert.deepEqual(Array.from(engine.pairFocus("AU", "NZ")).slice(0, 3), ["road-lines", "bollards", "road-furniture"]);
  assert.deepEqual(Array.from(engine.pairFocus("TH", "KH")).slice(0, 3), ["language", "driving", "google-car"]);
});

test("visual lessons compare the same clue category", () => {
  const { GG_STUDY_CLUE_ENGINE: engine } = loadEngine();
  const guide = (code, prefix) => ({
    sourceUrl: `https://example.com/${code}`,
    clues: [
      { id: `${code}-language`, type: "language", title: "Language", text: `${prefix} language`, imageUrl: `${prefix}-language.jpg`, priority: 100 },
      { id: `${code}-road`, type: "road-lines", title: "Road markings", text: `${prefix} roads`, imageUrl: `${prefix}-road.jpg`, priority: 90 },
      { id: `${code}-pole`, type: "utility-poles", title: "Utility poles", text: `${prefix} poles`, imageUrl: `${prefix}-pole.jpg`, priority: 80 }
    ]
  });
  const lesson = engine.buildLesson("GR", "BG", guide("GR", "gr"), guide("BG", "bg"));
  assert.ok(lesson.cards.length >= 2);
  const comparisons = lesson.cards.filter(card => card.kind === "compare");
  assert.ok(comparisons.length);
  comparisons.forEach(card => assert.equal(card.actual.type, card.guessed.type));
  assert.match(lesson.takeaway, /Greece/);
  assert.match(lesson.takeaway, /Bulgaria/);
});
