((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RoundScoutCountryResolver = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const SPECIAL_CODES = { Somaliland: "SO", "N. Cyprus": "CY" };
  let indexPromise = null;
  let regionIndexPromise = null;

  function featureCode(feature) {
    const props = feature?.properties || {};
    const code = String(props.ISO_A2_EH || props.ISO_A2 || "").toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) return code;
    return SPECIAL_CODES[props.NAME] || "";
  }

  function visitPoints(coordinates, callback) {
    if (!Array.isArray(coordinates)) return;
    if (coordinates.length >= 2 && Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]))) {
      callback(Number(coordinates[0]), Number(coordinates[1]));
      return;
    }
    coordinates.forEach(item => visitPoints(item, callback));
  }

  function bounds(geometry) {
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    visitPoints(geometry?.coordinates, (lng, lat) => {
      west = Math.min(west, lng);
      south = Math.min(south, lat);
      east = Math.max(east, lng);
      north = Math.max(north, lat);
    });
    return [west, south, east, north];
  }

  function onSegment(lng, lat, a, b) {
    const ax = Number(a?.[0]), ay = Number(a?.[1]), bx = Number(b?.[0]), by = Number(b?.[1]);
    const cross = (lng - ax) * (by - ay) - (lat - ay) * (bx - ax);
    if (Math.abs(cross) > 1e-9) return false;
    return lng >= Math.min(ax, bx) - 1e-9 && lng <= Math.max(ax, bx) + 1e-9 &&
      lat >= Math.min(ay, by) - 1e-9 && lat <= Math.max(ay, by) + 1e-9;
  }

  function inRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[j], b = ring[i];
      if (onSegment(lng, lat, a, b)) return true;
      const ax = Number(a[0]), ay = Number(a[1]), bx = Number(b[0]), by = Number(b[1]);
      if ((ay > lat) !== (by > lat) && lng < ((bx - ax) * (lat - ay)) / (by - ay) + ax) inside = !inside;
    }
    return inside;
  }

  function inPolygon(lng, lat, polygon) {
    if (!polygon?.length || !inRing(lng, lat, polygon[0])) return false;
    for (let i = 1; i < polygon.length; i += 1) if (inRing(lng, lat, polygon[i])) return false;
    return true;
  }

  function inGeometry(lng, lat, geometry) {
    if (geometry?.type === "Polygon") return inPolygon(lng, lat, geometry.coordinates);
    if (geometry?.type === "MultiPolygon") return geometry.coordinates.some(polygon => inPolygon(lng, lat, polygon));
    return false;
  }

  function buildIndex(geojson) {
    return (geojson?.features || [])
      .map(feature => ({ code: featureCode(feature), geometry: feature.geometry, bounds: bounds(feature.geometry) }))
      .filter(item => item.code && item.bounds.every(Number.isFinite));
  }

  function buildRegionIndex(geojson) {
    return (geojson?.features || [])
      .map(feature => {
        const props = feature.properties || {};
        const isoRegion = String(props.id || props.iso_3166_2 || "").toUpperCase();
        const country = String(props.country || props.code || props.iso_a2 || isoRegion.split("-")[0] || "").toUpperCase();
        return {
          country: /^[A-Z]{2}$/.test(country) ? country : "",
          name: props.name_en || props.name || "",
          code: isoRegion,
          type: props.type || props.type_en || "",
          parent: props.parent || props.region || "",
          geometry: feature.geometry,
          bounds: Array.isArray(feature.bbox) ? feature.bbox : bounds(feature.geometry)
        };
      })
      .filter(item => item.country && item.name && item.bounds.every(Number.isFinite));
  }

  function resolveFromIndex(index, point) {
    const lat = Number(point?.lat), lng = Number(point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    for (const item of index || []) {
      const [west, south, east, north] = item.bounds;
      if (lng < west || lng > east || lat < south || lat > north) continue;
      if (inGeometry(lng, lat, item.geometry)) return item.code;
    }
    return "";
  }

  function resolveFromGeoJson(geojson, point) {
    return resolveFromIndex(buildIndex(geojson), point);
  }

  function resolveRegionFromIndex(index, point, countryCode = "") {
    const lat = Number(point?.lat), lng = Number(point?.lng), country = String(countryCode || "").toUpperCase();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const matches = [];
    for (const item of index || []) {
      if (country && item.country !== country) continue;
      const [west, south, east, north] = item.bounds;
      if (lng < west || lng > east || lat < south || lat > north) continue;
      if (inGeometry(lng, lat, item.geometry)) matches.push(item);
    }
    matches.sort((a, b) => (a.bounds[2] - a.bounds[0]) * (a.bounds[3] - a.bounds[1]) - (b.bounds[2] - b.bounds[0]) * (b.bounds[3] - b.bounds[1]));
    if (!matches.length) return null;
    const { name, code, type, parent, country: resolvedCountry } = matches[0];
    return { name, code, type, parent, countryCode: resolvedCountry };
  }

  async function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(chrome.runtime.getURL("src/vendor/natural-earth-countries.geojson"))
        .then(response => {
          if (!response.ok) throw new Error(`Country boundaries unavailable (${response.status})`);
          return response.json();
        })
        .then(buildIndex)
        .catch(() => []);
    }
    return indexPromise;
  }

  async function countryCode(point) {
    return resolveFromIndex(await loadIndex(), point);
  }

  async function loadRegionIndex() {
    if (!regionIndexPromise) {
      regionIndexPromise = fetch(chrome.runtime.getURL("src/vendor/natural-earth-regions.geojson"))
        .then(response => {
          if (!response.ok) throw new Error(`Region boundaries unavailable (${response.status})`);
          return response.json();
        })
        .then(buildRegionIndex)
        .catch(() => []);
    }
    return regionIndexPromise;
  }

  async function region(point, countryCode = "") {
    return resolveRegionFromIndex(await loadRegionIndex(), point, countryCode);
  }

  return { buildIndex, buildRegionIndex, countryCode, inGeometry, region, resolveFromGeoJson, resolveFromIndex, resolveRegionFromIndex };
});
