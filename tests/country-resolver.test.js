const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const resolver = require("../src/country-resolver.js");

const countries = JSON.parse(fs.readFileSync("src/vendor/natural-earth-countries.geojson", "utf8"));
const index = resolver.buildIndex(countries);
const regions = JSON.parse(fs.readFileSync("src/vendor/natural-earth-regions.geojson", "utf8"));
const regionIndex = resolver.buildRegionIndex(regions);

test("local country boundaries resolve large and small GeoGuessr countries", () => {
  const cases = [
    [41.8781, -87.6298, "US"],
    [48.8566, 2.3522, "FR"],
    [1.3521, 103.8198, "SG"],
    [35.8997, 14.5146, "MT"],
    [27.4728, 89.639, "BT"],
    [-29.61, 28.23, "LS"],
    [-34.9, -56.16, "UY"]
  ];

  for (const [lat, lng, expected] of cases) {
    assert.equal(resolver.resolveFromIndex(index, { lat, lng }), expected);
  }
});

test("local country boundaries reject ocean points", () => {
  assert.equal(resolver.resolveFromIndex(index, { lat: 0, lng: -140 }), "");
});

test("local region boundaries resolve states, provinces, and departments", () => {
  assert.equal(resolver.resolveRegionFromIndex(regionIndex, { lat: 41.8781, lng: -87.6298 }, "US").name, "Illinois");
  assert.equal(resolver.resolveRegionFromIndex(regionIndex, { lat: 48.7758, lng: 9.1829 }, "DE").name, "Baden-Württemberg");
  assert.equal(resolver.resolveRegionFromIndex(regionIndex, { lat: -33.8688, lng: 151.2093 }, "AU").name, "New South Wales");
  assert.equal(resolver.resolveRegionFromIndex(regionIndex, { lat: -34.9, lng: -56.16 }, "UY").name, "Montevideo");
});
