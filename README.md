# Arda Chartbench v0.4.0 — Chartbench Edition

**Chartbench** is the new release of the Lab Chart App: a single, fully self-contained HTML file (`index.html`) with two chart-building workbenches under one roof. Just open the file in your browser — no server, no install, no external libraries to download.

## 🎉 What's New in v0.4.0

This release replaces the previous multi-file app (HTML + JS + CSS + bundled libs) with **one deployable file**. Everything — the app code, styles, and the charting library — is inlined, so you can share, host, or archive the app as a single document.

### 🛠 Two Benches, One App

Switch between the two workbenches from the top bar:

- **Presentation (Showbench)** — build clean, presentation-ready charts for slides and reports.
- **Scientific (Plotbench)** — the evolution of the classic Lab Chart workflow for experimental data: replicates, statistics, and publication-style figures.

### ✨ Highlights

- **Single-file deploy**: `index.html` is the entire app (~430 KB). Copy it anywhere and it just works.
- **No local dependencies**: no `libs/` folder required — the charting library is bundled inline. The only network requests are optional Google Fonts (Inter, IBM Plex Mono); the app still works offline with fallback fonts.
- **Chart export**: save your charts as standalone files directly from the browser.
- **Modern UI**: refreshed branding and layout shared across both benches.

## 📖 How to Use

1. Open `index.html` in a modern browser (double-click, or host it as a static file).
2. Pick a bench in the top bar: **Presentation** or **Scientific**.
3. Load or enter your data, configure the chart, and export.

## 🔒 Privacy & Security

- **100% client-side**: all processing happens in your browser.
- **No uploads**: files never leave your computer.
- **No tracking**: no analytics or cookies.
- **No storage**: data clears when you close the tab.
- **Export only**: data only leaves via your explicit export actions.

## 📦 Previous Versions

Earlier releases are archived in this repository, each in its own folder:

| Version | Folder | Notes |
| --- | --- | --- |
| v0.3.0 | [`v0_3_0/`](v0_3_0/) | Enhanced Edition — workflow steps, help system, keyboard shortcuts ([release notes](v0_3_0/README.md)) |
| v0.2.0 | [`v0_2_0/`](v0_2_0/) | Table editor, grid, and export improvements |
| v0.1.0 | [`v0_1_0/`](v0_1_0/) | Original Lab Chart App ([release notes](v0_1_0/README.md)) |

Older versions are multi-file apps — open the `index.html` inside the respective folder (v0.2.0/v0.3.0 require their local `libs/` folder alongside).

## 📝 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🐛 Known Limitations

- Requires a modern browser (Chrome, Firefox, Safari, Edge).
- Very large datasets (>10,000 rows) may be slow.
- Google Fonts load only when online; offline use falls back to system fonts.

---

**Version**: 0.4.0
**Release Date**: 2026
**License**: Client-side only, no warranty

---

Enjoy Arda Chartbench! 🚀📊
