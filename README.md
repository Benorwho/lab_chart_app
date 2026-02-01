# Lab Chart App
A tiny, no nonsense lab figure machine: feed it messy replicate spreadsheets, get back clean means, honest error bars, and export ready figures like a responsible scientist.

This is a static, client side web app for turning wide format lab tables into publication quality charts with computed mean and error bars. It runs fully in your browser. No backend. No uploads. No accounts.

---

## What this app does
You give the app either:
- a CSV upload, or
- pasted CSV or TSV text

It will:
1. Detect replicate columns automatically (or let you select them manually)
2. Compute, per row:
   - `n` (count of non blank numeric replicates)
   - `mean`
   - `stdev` (sample standard deviation)
   - `sem` (standard error of the mean)
3. Render scientific figures:
   - Bar chart with error bars
   - Scatter plot
   - Line chart
4. Optionally overlay raw replicate points on top of the mean
5. Export:
   - the chart as SVG
   - the chart as PNG (with resolution selector)
   - the processed data as CSV (including original replicate values plus stats)

Everything stays in memory until you clear or refresh.

---

## Key features
### Data input
- Upload a CSV file
- Paste CSV or TSV directly
- Clear data button wipes everything from memory

### Replicate detection
Replicate columns are auto detected by name patterns like:
- `iterate 1`, `iterate2`
- `iter 1`, `iter2`
- `rep 1`, `rep2`
- `replicate 1`, `replicate_2`
- `r1`, `r2`

You can override the replicate selection using checkboxes in the UI.

### Calculations
For each row, using the available replicate values:
- `n`: number of numeric, non blank replicate values
- `mean`
- `stdev`: sample standard deviation (uses `n - 1`)
- `sem`: `stdev / sqrt(n)`

If `n < 2`:
- the app warns you
- error bars for that row are hidden (set to zero)

### Chart types
- **Bar chart**: mean per category (ID, Time, or another numeric column)
- **Scatter plot**: x is Time or a chosen numeric column, y is mean
- **Line chart**: x is Time or a chosen numeric column, y is mean, grouped by series

### Grouping and coloring
If you have a `Condition` column you can:
- color or group by Condition
- filter by Condition
You can also group by ID for some chart types.

### Raw replicate overlay
You can overlay the raw replicate points:
- Bar chart: points are jittered to avoid perfect overlap
- Scatter and line: raw points use the same x, plotted on top of the mean

### Styling controls
Simple controls that aim to look good by default:
- Theme preset: clean light or dark
- Chart title and axis titles
- Font size
- Marker size
- Line width
- Error bar width and cap size
- Legend position
- Gridlines toggle

### Export
- Export chart as **SVG**
- Export chart as **PNG** (choose scale 1x to 4x)
- Download **processed CSV** with:
  - ID, Time, Condition
  - replicate values
  - mean, stdev, sem, n

---

## Data format
### Primary format: wide table
Required column:
- `ID` (sample name or code)

Optional columns:
- `Time` (numeric)
- `Condition` (string)

Replicates:
- multiple replicate columns with names that match the patterns above
- replicate cells may be blank

Example:
```csv
ID,Time,Condition,rep 1,rep 2,rep 3
A,0,Control,1.2,1.1,1.3
A,1,Control,1.8,1.7,1.9
B,0,Treated,0.9,1.0,0.8

How to use

Basic workflow
	1.	Paste data into the text area or upload a CSV
	2.	Click Parse data
	3.	Confirm or adjust:
	•	ID column
	•	Time column (optional)
	•	Condition column (optional)
	•	replicate columns (auto detected, but editable)
	4.	Click Compute stats
	5.	Choose your chart type and options
	6.	Click Render chart (or just tweak settings if auto rerender is active)
	7.	Export what you need:
	•	Export SVG
	•	Export PNG
	•	Download processed CSV

Filtering
	•	Use the IDs and Conditions multi select boxes to include only a subset
	•	Leaving filters empty includes everything

Clearing data
	•	Click Clear data to wipe:
	•	pasted text
	•	parsed rows
	•	computed results
	•	chart and table preview
No data is stored after that.

⸻

Run locally

You can open index.html directly, but a local server is more reliable.

Option 1: Python
python -m http.server 8000
Then open:
http://localhost:8000

Option 2: Node (if you already have it)
npx serve

Privacy and security
	•	No backend
	•	No accounts
	•	No cookies needed
	•	No analytics
	•	No external API calls
	•	Your data is processed in memory in your browser
	•	Nothing is saved unless you download exported files

Note: The app uses Plotly.js for charting. If you load Plotly from a CDN on first visit, your browser will request that script from the CDN. That request does not include your pasted data, but it is still a network request.

⸻

Offline notes

v0.1 works offline after first load if your browser cache keeps the assets.

If you want stronger offline behavior:
	•	Vendor plotly.min.js inside the repo and reference it locally instead of a CDN
	•	Or add a simple service worker to pre cache assets

⸻

Disclaimers and limits
	•	This is not a statistical validation tool. It computes basic descriptive stats only.
	•	It assumes replicate columns contain numeric values. Non numeric cells are ignored and flagged.
	•	If your dataset uses different replicate naming conventions, select replicate columns manually.
	•	Very large datasets may be slow on mobile devices due to chart rendering and DOM updates.
	•	For categorical x axes in scatter or line without a numeric Time, the app uses an index mapping, which is fine for quick plots but not ideal for final figures. Prefer a numeric Time or numeric x column for those chart types.

⸻

Tech
	•	Static HTML, CSS, JavaScript
	•	Plotly.js for SVG quality chart rendering and exporting

⸻
