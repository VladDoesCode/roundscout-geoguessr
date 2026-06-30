# RoundScout Diagnostics

RoundScout keeps a bounded, privacy-conscious troubleshooting timeline for future GeoGuessr changes. It does not upload the log.

## Export a clean report

1. Open the RoundScout dashboard.
2. Select the small `>_` button beside **Local storage sync active**.
3. Select **Clear test log**. This does not delete saved rounds.
4. Hard-refresh every open GeoGuessr tab with `Ctrl+Shift+R`.
5. Play the mode that is having trouble.
6. Return to the dashboard, reopen `>_`, and select **Download diagnostics**.

The report is capped at 220 compact events. It contains state shapes, decisions, country codes, scores, and save outcomes. It excludes raw network payloads and coordinates.
