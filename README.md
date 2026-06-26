# RoundScout for GeoGuessr

RoundScout is a private Microsoft Edge / Chrome extension for post-round GeoGuessr learning. It opens only after a round result is available, saves local performance history, and turns mistakes into practical study priorities.

## What It Does

- Shows a compact post-round study popup after GeoGuessr reveals the result.
- Tracks Classic and Duel rounds locally with country, region, score, distance, and Duel base damage.
- Builds a stats dashboard with country performance, repeat leaks, saved rounds, and high-EV study recommendations.
- Includes beginner-friendly country meta for common GeoGuessr countries.
- Stores all data in `chrome.storage.local`; there is no backend.

## Ethics

RoundScout is a learning tool, not a live-round helper. It is designed to activate after the round result is revealed and should not provide tips during active guessing.

## Install Locally

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable Developer Mode.
3. Click **Load unpacked**.
4. Select this extension folder.
5. Pin the extension if you want quick access to the stats dashboard.

## Files

- `manifest.json` - Manifest V3 extension config.
- `src/page-probe.js` - Safe page-context network listener.
- `src/content.js` - Round detection, popup UI, and local saving.
- `src/background.js` - Extension messaging, storage merge, and stats opener.
- `src/data.js` - Country study meta.
- `src/stats.html`, `src/stats.css`, `src/stats.js` - RoundScout dashboard.
- `src/styles.css` - In-game popup styles.

## Privacy

All saved rounds stay on your machine in browser local extension storage. Exported JSON backups are created only when you click export.

## Development

No build step is required. After editing files, reload the unpacked extension from the browser extensions page and refresh GeoGuessr.
