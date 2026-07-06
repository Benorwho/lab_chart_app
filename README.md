# Arda Chartbench v0.6.0

**Chartbench** is privacy-first scientific charting in a single HTML file (`index.html`) with two chart-building workbenches under one roof. Just open the file in your browser — no server, no install, no external libraries to download, and your data never leaves your machine.

## 🎉 What's New in v0.6.0 — Show the data

Journals increasingly ask authors to show the underlying data distribution, not just bars with error bars ([SuperPlots, JCB 2020](https://rupress.org/jcb/article/219/6/e202001064/151717/); "Beyond Bar Graphs"). Plotbench now does exactly that:

- **Box plots** — median, IQR box, Tukey (1.5×IQR) or min/max whiskers, outliers, optional mean marker. Grouped side by side like bars.
- **Violin plots** — Gaussian kernel-density outline with an optional inner box + median.
- **Individual points overlay** — jittered replicate points on bars or boxes, the transparency reviewers expect.
- **SuperPlots** — colour each point by its biological replicate and mark each replicate mean with a large dot, following Lord et al. Import replicates with **Compute mean ± error** (one column per replicate) or a `Group, Value` CSV, and the raw values feed the box/violin/point layers automatically.

All distribution statistics (quantiles, box summaries, kernel density) live in `src/core/stats.js` and are unit-tested against R/numpy reference values. Next release: significance testing with brackets and stars, built on this same tested core.

## 🎉 What's New in v0.5.0

This release answers the first round of user feedback on Plotbench bar charts, and restructures the project so it can grow (and take contributors) without losing the single-file deploy.

### Smarter CSV import
Smart import now recognizes the table layouts scientists actually export, and loads each with one click — with a preview of the series it will create before you commit:

- **Grouped (long/tidy) data** — `X, Group, Value[, SD]` → one colored series per group, bars side by side.
- **Replicate rows** — `Group, Value` with repeated groups → mean ± SD per group (n reported).
- **Series columns (wide)** — categories in the first column, one numeric column per series; error columns named `SD`/`SEM`/`error` attach automatically as error bars to the series before them.
- **Raw curves** and the multi-block **lab tensile export** (summary stats + stress–strain traces), as before.
- Every card has a "Not right? Adjust the column mapping" escape hatch into the paste dialog, pre-mapped with the detector's guess.

### Value labels on bars
New **Value labels** group in the Appearance panel: print each bar's value above the bar (clear of the error whisker) or inside it — with decimals control, optional "± error", label color and size. Works in grouped, stacked (segment labels + stack totals) and diverging modes, and is included in SVG/PNG exports.

### Faster multi-series workflows
Each series card now has a **duplicate** button (same X labels, next palette color) — no more building the second group point by point.

### New architecture (for contributors)
The single `index.html` is now the **build output**, not the source. Real modules live in `src/`, the core parsing/stats code is unit-tested in Node, and CI enforces that the committed `index.html` matches `src/`. See [Development](#-development) below.

## 🛠 Two Benches, One App

Switch between the two workbenches from the top bar:

- **Presentation (Showbench)** — build clean, presentation-ready charts for slides and reports.
- **Scientific (Plotbench)** — the evolution of the classic Lab Chart workflow for experimental data: replicates, statistics, and publication-style figures.

### ✨ Highlights

- **Single-file deploy**: `index.html` is the entire app (~440 KB). Copy it anywhere and it just works.
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

## 🧑‍💻 Development

The deploy file is generated — **edit `src/`, not `index.html`**.

```
src/
  index.template.html   page skeleton with {{PLACEHOLDER}} slots
  styles/main.css       all CSS
  vendor/d3.v7.min.js   vendored d3 bundle (Showbench)
  core/stats.js         numeric helpers — unit-tested, seed of the stats engine
  core/csv.js           CSV parsing + table-layout detection — unit-tested
  showbench/            Presentation bench
  plotbench/            Scientific bench (core modules are inlined into it)
  shell/                top-bar bench switcher
test/                   Node test suites for src/core
build.mjs               assembles src/ → index.html
```

```bash
npm test                # unit tests (no dependencies to install)
npm run build           # regenerate index.html from src/
node build.mjs --check  # verify index.html matches src/ (CI runs this)
```

Rules of the road:
- `src/core/*` must stay pure (no DOM) so it runs under `node --test`. Every stats function needs a test against a published R/scipy reference value.
- Commit the rebuilt `index.html` together with `src/` changes — CI fails on drift.

## 🗺 Roadmap

- ✅ **Chart types**: box plots, violin plots, dots-over-bars / SuperPlots — *shipped in v0.6.0*.
- **Stats v1** (next): t-test / Welch / Mann-Whitney, one-way ANOVA + Tukey, significance brackets and stars on charts, auto-generated methods sentence.
- **Project files**: save/load the full figure state as versioned JSON (config save/load already present; formalizing the schema next).
- **Journal export**: exact figure sizing in mm + DPI presets.
- **Curve fitting**: nonlinear regression, dose–response / EC50.

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

**Version**: 0.6.0
**Release Date**: 2026
**License**: Client-side only, no warranty

---

Enjoy Arda Chartbench! 🚀📊
