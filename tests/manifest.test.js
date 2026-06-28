const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("manifest references existing extension files", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "1.11.1");
  const files = [
    manifest.background.service_worker,
    manifest.options_page,
    ...manifest.content_scripts.flatMap(script => [...(script.js || []), ...(script.css || [])]),
    "src/guide-parser.js"
  ];
  files.forEach(file => assert.ok(fs.existsSync(file), `Missing manifest dependency: ${file}`));
  assert.ok(manifest.host_permissions.includes("https://www.plonkit.net/*"));
});
