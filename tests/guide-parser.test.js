const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function parser() {
  const context = { URL };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("src/guide-parser.js", "utf8"), context);
  return context.RoundScoutGuideParser;
}

function fixtureHtml() {
  const payload = {
    success: true,
    data: {
      public: {
        title: "Greece",
        slug: "greece",
        code: "GR",
        heroImage: "/images/greece/hero.png",
        steps: [{
          kind: "tip",
          title: "Identifying Greece",
          items: [
            { kind: "tip", data: { image: { imageUrl: "/images/greece/plate.png", imageLink: "/images/greece/plate.png" }, text: ["Greek **licence plates** are usually white."] } },
            { kind: "tip", data: { image: { imageUrl: "/images/greece/pole.png" }, text: ["Dark wooden utility poles are common."] }, tags: ["pole"] },
            { kind: "tip", data: { image: { imageUrl: "/images/greece/script.png" }, text: ["The [Greek alphabet](https://example.com) is unique."] }, tags: ["language"] }
          ]
        }]
      }
    }
  };
  return `<html><script id="__PRELOADED_DATA__" type="application/json">${JSON.stringify(payload)}</script></html>`;
}

test("guide parser preserves each image and its own explanation", () => {
  const guide = parser().guideFromHtml(fixtureHtml(), "greece");
  assert.equal(guide.code, "GR");
  assert.equal(guide.clues.length, 3);
  assert.match(guide.clues[0].imageUrl, /plate\.png$/);
  assert.match(guide.clues[0].imageLink, /plate\.png$/);
  assert.equal(guide.clues[0].sourceUrl, "https://www.plonkit.net/greece");
  assert.match(guide.clues[0].text, /licence plates/);
  assert.equal(guide.clues[0].type, "plates");
  assert.match(guide.clues[1].imageUrl, /pole\.png$/);
  assert.equal(guide.clues[1].type, "utility-poles");
  assert.match(guide.clues[2].imageUrl, /script\.png$/);
  assert.equal(guide.clues[2].type, "language");
});

test("Israel receives attributed open-license fallback visuals", () => {
  const guide = parser().guideFromHtml("<html></html>", "israel");
  assert.equal(guide.code, "IL");
  assert.equal(guide.clues.length, 3);
  guide.clues.forEach(clue => {
    assert.match(clue.imageUrl, /^https:\/\//);
    assert.match(clue.sourceUrl, /^https:\/\/commons\.wikimedia\.org/);
    assert.match(clue.sourceLabel, /Wikimedia Commons/);
  });
});
