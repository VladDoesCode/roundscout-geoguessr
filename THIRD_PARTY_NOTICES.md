# Third-Party Data

## Natural Earth Vector

RoundScout includes simplified Natural Earth GeoJSON for local country and first-level region lookup.

- Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson
- Retrieved: 2026-06-30
- SHA-256: `3E458FC036AD0A66411F2C1E6CAC49C5D7BFB81CB1123BC513B22511A2B7FDEB`
- Region source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_1_states_provinces.geojson
- Compact region index SHA-256: `277513021E84A4F50B517508E80510DA637B78EBE1BD5DF0875958C424E37DE9`
- Region simplification: `scripts/build-region-data.py --tolerance 0.01`
- Terms: https://www.naturalearthdata.com/about/terms-of-use/

Natural Earth raster and vector map data is in the public domain.
