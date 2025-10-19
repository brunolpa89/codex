# Monster Scraper Chrome Extension

This repository contains **Monster Scraper**, an opinionated Chrome Extension designed to tear through complex web experiences and surface data in seconds. It combines robust client-side scraping heuristics with automation helpers and an optional OpenAI GPT-4.1 mini fallback for situations where traditional scraping strategies break down.

## Features

* **One-click page scan** – Detects HTML tables, semantic grids, definition lists, lists, and repeated card layouts. Previews up to 15 rows per dataset inside the popup.
* **Header remapping** – Rename columns inline; the extension immediately rewrites cached data so subsequent copies honor the new schema.
* **Copy as CSV or JSON** – Push structured results straight to the clipboard for quick export.
* **Monster navigation toolkit** – Auto-scrolls long or lazy-loaded pages and hunts down “Next”, “Load more”, or `rel="next"` buttons to advance pagination.
* **GPT-4.1 mini assist** – Capture the current page context and request strategic scraping guidance whenever heuristics hit a wall. Requires an OpenAI API key.

## Getting Started

1. Open `chrome://extensions` in Chromium-based browsers.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the `extension/` directory in this repository.
4. Pin the extension (optional) for faster access.

### Configuring OpenAI Access

1. In the extension popup, click **Set API key** or visit the extension’s options page directly.
2. Paste your OpenAI key (must start with `sk-`) and save. The key is stored in Chrome sync storage.
3. Use the **AI Select Content** button inside the popup to request GPT-backed strategies, selectors, or troubleshooting notes tailored to the active page.

## Development Notes

* Manifest Version 3 service worker orchestrates API key storage and GPT calls.
* Content scripts run on all pages to collect data, manage clipboard exports, and automate pagination.
* The popup module communicates with the active tab for scanning and exposes a modern UI for dataset management.

Feel free to extend the heuristics in `extension/src/content.js` to support additional layout patterns or to integrate more automation workflows.