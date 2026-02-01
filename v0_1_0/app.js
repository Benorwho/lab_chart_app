/* Lab Chart App v0.1
   Client side only.
   No storage. No cookies. No analytics.
   Data lives in memory until user clears it or refreshes.

   Main flow:
   1) Parse CSV or TSV into rows and columns
   2) Choose ID, Time, Condition, replicate columns
   3) Compute stats per row
   4) Render chart with Plotly
   5) Export figure and processed CSV
*/

const App = (() => {
  const state = {
    rawText: "",
    headers: [],
    rows: [],              // Array of objects: { colName: valueString }
    replicateCols: [],     // Array of header names
    colId: "ID",
    colTime: "",
    colCondition: "",
    computed: [],          // Array of objects with numeric stats and replicate values
    lastFigure: null
  };

  const els = {};

  function init() {
    cacheEls();
    bindEvents();
    applyTheme("light");
    setEmptyChart(true);
    logMsg("Paste or upload data, then click Parse data.", "ok");
  }

  function cacheEls() {
    els.fileInput = document.getElementById("fileInput");
    els.pasteArea = document.getElementById("pasteArea");
    els.btnParse = document.getElementById("btnParse");
    els.btnLoadExample = document.getElementById("btnLoadExample");
    els.btnCompute = document.getElementById("btnCompute");
    els.btnRender = document.getElementById("btnRender");
    els.btnResetView = document.getElementById("btnResetView");
    els.btnClear = document.getElementById("btnClear");
    els.btnDownloadProcessed = document.getElementById("btnDownloadProcessed");

    els.colId = document.getElementById("colId");
    els.colTime = document.getElementById("colTime");
    els.colCondition = document.getElementById("colCondition");
    els.replicateList = document.getElementById("replicateList");

    els.chartType = document.getElementById("chartType");
    els.xMode = document.getElementById("xMode");
    els.groupMode = document.getElementById("groupMode");
    els.errorMode = document.getElementById("errorMode");
    els.toggleRaw = document.getElementById("toggleRaw");
    els.toggleGrid = document.getElementById("toggleGrid");
    els.toggleLegend = document.getElementById("toggleLegend");

    els.filterIds = document.getElementById("filterIds");
    els.filterConditions = document.getElementById("filterConditions");

    els.theme = document.getElementById("theme");
    els.title = document.getElementById("title");
    els.xTitle = document.getElementById("xTitle");
    els.yTitle = document.getElementById("yTitle");
    els.fontSize = document.getElementById("fontSize");
    els.markerSize = document.getElementById("markerSize");
    els.lineWidth = document.getElementById("lineWidth");
    els.errorWidth = document.getElementById("errorWidth");
    els.capSize = document.getElementById("capSize");
    els.legendPos = document.getElementById("legendPos");

    els.btnExportSvg = document.getElementById("btnExportSvg");
    els.btnExportPng = document.getElementById("btnExportPng");
    els.pngScale = document.getElementById("pngScale");

    els.messages = document.getElementById("messages");
    els.chart = document.getElementById("chart");
    els.emptyState = document.getElementById("emptyState");

    els.previewTable = document.getElementById("previewTable");
    els.previewHead = els.previewTable.querySelector("thead");
    els.previewBody = els.previewTable.querySelector("tbody");
  }

  function bindEvents() {
    els.fileInput.addEventListener("change", onFilePicked);
    els.btnParse.addEventListener("click", onParse);
    els.btnLoadExample.addEventListener("click", loadExample);
    els.btnCompute.addEventListener("click", onCompute);
    els.btnRender.addEventListener("click", onRender);
    els.btnResetView.addEventListener("click", onResetView);
    els.btnClear.addEventListener("click", onClear);

    els.btnDownloadProcessed.addEventListener("click", downloadProcessedCsv);
    els.btnExportSvg.addEventListener("click", () => exportFigure("svg"));
    els.btnExportPng.addEventListener("click", () => exportFigure("png"));

    els.theme.addEventListener("change", () => {
      applyTheme(els.theme.value);
      if (state.computed.length) renderChart();
    });

    const rerenderOnChange = [
      els.chartType, els.xMode, els.groupMode, els.errorMode, els.toggleRaw,
      els.toggleGrid, els.toggleLegend, els.title, els.xTitle, els.yTitle,
      els.fontSize, els.markerSize, els.lineWidth, els.errorWidth, els.capSize, els.legendPos,
      els.filterIds, els.filterConditions
    ];
    rerenderOnChange.forEach(el => el.addEventListener("change", () => {
      if (state.computed.length) renderChart();
    }));
  }

  async function onFilePicked(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const text = await file.text();
    els.pasteArea.value = text;
    logMsg(`Loaded file: ${file.name}. Click Parse data.`, "ok");
  }

  function onParse() {
    clearMsgs();
    const text = els.pasteArea.value.trim();
    if (!text) {
      logMsg("No data found. Paste CSV or TSV, or upload a CSV file.", "err");
      return;
    }

    state.rawText = text;

    let parsed;
    try {
      parsed = parseDelimited(text);
    } catch (err) {
      logMsg(`Parsing failed: ${err.message}`, "err");
      return;
    }

    if (!parsed.headers.length || parsed.rows.length === 0) {
      logMsg("Parsed data is empty. Make sure you have a header row and at least one data row.", "err");
      return;
    }

    state.headers = parsed.headers;
    state.rows = parsed.rows;

    setupColumnSelectors();
    autoDetectReplicates();
    setupXModeOptions();
    setupFilters();

    state.computed = [];
    updateButtons();

    logMsg(`Parsed ${state.rows.length} rows and ${state.headers.length} columns. Select columns if needed, then click Compute stats.`, "ok");
  }

  function setupColumnSelectors() {
    const headers = state.headers;

    fillSelect(els.colId, headers, pickDefault(headers, ["id", "sample", "name"], "ID"));
    fillSelect(els.colTime, ["", ...headers], pickDefault(headers, ["time", "t"], ""));
    fillSelect(els.colCondition, ["", ...headers], pickDefault(headers, ["condition", "group", "treatment"], ""));

    state.colId = els.colId.value;
    state.colTime = els.colTime.value;
    state.colCondition = els.colCondition.value;

    els.colId.addEventListener("change", () => { state.colId = els.colId.value; setupFilters(); setupXModeOptions(); });
    els.colTime.addEventListener("change", () => { state.colTime = els.colTime.value; setupXModeOptions(); renderIfReady(); });
    els.colCondition.addEventListener("change", () => { state.colCondition = els.colCondition.value; setupFilters(); renderIfReady(); });
  }

  function setupXModeOptions() {
    const options = [];
    options.push({ value: "id", label: "ID" });

    if (state.colTime) options.push({ value: "time", label: `Time (${state.colTime})` });

    // Allow any numeric column as x for scatter and line.
    // We discover numeric candidates by sampling.
    const numericCols = findNumericColumns(state.rows, state.headers, 20);
    numericCols.forEach(c => {
      if (c !== state.colTime && c !== state.colId && c !== state.colCondition) {
        options.push({ value: `col:${c}`, label: `Column (${c})` });
      }
    });

    // Fill select
    els.xMode.innerHTML = "";
    options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      els.xMode.appendChild(o);
    });

    // Default x selection
    if (state.colTime) els.xMode.value = "time";
    else els.xMode.value = "id";
  }

  function setupFilters() {
    // IDs
    const ids = uniqueValues(state.rows.map(r => safeString(r[state.colId]))).filter(Boolean).sort();
    fillMultiSelect(els.filterIds, ids);

    // Conditions
    if (state.colCondition) {
      const conds = uniqueValues(state.rows.map(r => safeString(r[state.colCondition]))).filter(Boolean).sort();
      fillMultiSelect(els.filterConditions, conds);
      els.filterConditions.disabled = false;
    } else {
      fillMultiSelect(els.filterConditions, []);
      els.filterConditions.disabled = true;
    }
  }

  function autoDetectReplicates() {
    const headers = state.headers;
    const detected = [];

    for (const h of headers) {
      if (isReplicateHeader(h)) detected.push(h);
    }

    state.replicateCols = detected;
    renderReplicateChecklist(headers, detected);

    if (detected.length === 0) {
      logMsg("No replicate columns auto detected. Please select replicate columns manually.", "warn");
    }
  }

  function renderReplicateChecklist(headers, selected) {
    els.replicateList.innerHTML = "";
    headers.forEach(h => {
      const id = `rep_${cssSafe(h)}`;
      const wrap = document.createElement("div");
      wrap.className = "checkitem";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = id;
      cb.checked = selected.includes(h);

      cb.addEventListener("change", () => {
        const chosen = getChosenReplicatesFromUI(headers);
        state.replicateCols = chosen;
        updateButtons();
      });

      const lab = document.createElement("label");
      lab.setAttribute("for", id);
      lab.textContent = h;

      wrap.appendChild(cb);
      wrap.appendChild(lab);
      els.replicateList.appendChild(wrap);
    });
  }

  function getChosenReplicatesFromUI(headers) {
    const chosen = [];
    headers.forEach(h => {
      const id = `rep_${cssSafe(h)}`;
      const cb = document.getElementById(id);
      if (cb && cb.checked) chosen.push(h);
    });
    return chosen;
  }

  function onCompute() {
    clearMsgs();

    if (!state.rows.length) {
      logMsg("No parsed data. Click Parse data first.", "err");
      return;
    }

    state.colId = els.colId.value;
    state.colTime = els.colTime.value;
    state.colCondition = els.colCondition.value;
    state.replicateCols = getChosenReplicatesFromUI(state.headers);

    if (!state.colId) {
      logMsg("ID column is required.", "err");
      return;
    }
    if (!state.replicateCols.length) {
      logMsg("Select at least one replicate column.", "err");
      return;
    }

    const warnings = [];
    const computed = [];

    state.rows.forEach((row, idx) => {
      const id = safeString(row[state.colId]);
      const timeVal = state.colTime ? toNumberOrNull(row[state.colTime]) : null;
      const condition = state.colCondition ? safeString(row[state.colCondition]) : "";

      const reps = {};
      const repNums = [];
      const invalidCells = [];

      state.replicateCols.forEach(col => {
        const raw = row[col];
        reps[col] = raw;

        const num = toNumberOrNull(raw);
        if (num === null) return;

        repNums.push(num);
      });

      // Track invalid numeric entries for replicate columns
      state.replicateCols.forEach(col => {
        const raw = safeString(row[col]).trim();
        if (!raw) return;
        const num = toNumberOrNull(raw);
        if (num === null) invalidCells.push(`${col}="${raw}"`);
      });

      const n = repNums.length;
      const mean = n ? average(repNums) : null;
      const stdev = n >= 2 ? sampleStdev(repNums) : null;
      const sem = n >= 2 ? (stdev / Math.sqrt(n)) : null;

      if (!id) warnings.push(`Row ${idx + 2} has empty ID.`);
      if (invalidCells.length) warnings.push(`Row ${idx + 2} has non numeric replicate values: ${invalidCells.join(", ")}`);
      if (n < 1) warnings.push(`Row ${idx + 2} has no numeric replicate values.`);
      if (n < 2) warnings.push(`Row ${idx + 2} has n < 2. Error bars are hidden for that row.`);

      computed.push({
        __rowIndex: idx,
        ID: id,
        Time: timeVal,
        Condition: condition,
        n,
        mean,
        stdev,
        sem,
        replicates: reps
      });
    });

    state.computed = computed;

    // Preview table (first 20 rows)
    renderPreviewTable(20);

    if (warnings.length) {
      logMsg(warnings.slice(0, 8).join("\n") + (warnings.length > 8 ? `\nPlus ${warnings.length - 8} more warnings.` : ""), "warn");
    } else {
      logMsg("Stats computed. Click Render chart or tweak settings.", "ok");
    }

    updateButtons();
    renderIfReady();
  }

  function onRender() {
    renderChart();
  }

  function onResetView() {
    if (!state.lastFigure) return;
    Plotly.react(els.chart, state.lastFigure.data, state.lastFigure.layout, state.lastFigure.config);
  }

  function onClear() {
    // Wipe everything in memory
    state.rawText = "";
    state.headers = [];
    state.rows = [];
    state.replicateCols = [];
    state.colId = "ID";
    state.colTime = "";
    state.colCondition = "";
    state.computed = [];
    state.lastFigure = null;

    els.pasteArea.value = "";
    els.fileInput.value = "";

    els.colId.innerHTML = "";
    els.colTime.innerHTML = "";
    els.colCondition.innerHTML = "";
    els.replicateList.innerHTML = "";
    els.xMode.innerHTML = "";
    fillMultiSelect(els.filterIds, []);
    fillMultiSelect(els.filterConditions, []);
    els.filterConditions.disabled = true;

    els.previewHead.innerHTML = "";
    els.previewBody.innerHTML = "";

    Plotly.purge(els.chart);
    setEmptyChart(true);

    clearMsgs();
    logMsg("Cleared. Nothing is stored. You can paste new data now.", "ok");
    updateButtons();
  }

  function updateButtons() {
    const hasParsed = state.rows.length > 0 && state.headers.length > 0;
    const hasReps = state.replicateCols.length > 0;
    const hasComputed = state.computed.length > 0;

    els.btnCompute.disabled = !(hasParsed && hasReps);
    els.btnRender.disabled = !hasComputed;
    els.btnResetView.disabled = !hasComputed;

    els.btnDownloadProcessed.disabled = !hasComputed;

    const hasFigure = !!state.lastFigure;
    els.btnExportSvg.disabled = !hasFigure;
    els.btnExportPng.disabled = !hasFigure;
  }

  function renderIfReady() {
    if (state.computed.length) {
      renderChart();
    }
  }

  function renderChart() {
    if (!state.computed.length) return;

    const chartType = els.chartType.value;
    const xMode = els.xMode.value;
    const groupMode = els.groupMode.value;
    const errorMode = els.errorMode.value;
    const overlayRaw = els.toggleRaw.checked;

    const selectedIds = getMultiSelectValues(els.filterIds);
    const selectedConds = getMultiSelectValues(els.filterConditions);

    const filtered = state.computed.filter(r => {
      const okId = selectedIds.length ? selectedIds.includes(r.ID) : true;
      const okCond = state.colCondition
        ? (selectedConds.length ? selectedConds.includes(r.Condition) : true)
        : true;
      return okId && okCond;
    });

    if (!filtered.length) {
      logMsg("Filter removed all rows. Clear filters or choose different values.", "warn");
      Plotly.purge(els.chart);
      setEmptyChart(true);
      state.lastFigure = null;
      updateButtons();
      return;
    }

    const theme = els.theme.value;
    const fontSize = clampInt(parseInt(els.fontSize.value || "14", 10), 8, 28);
    const markerSize = clampInt(parseInt(els.markerSize.value || "7", 10), 2, 24);
    const lineWidth = clampInt(parseInt(els.lineWidth.value || "2", 10), 1, 10);
    const errorWidth = clampInt(parseInt(els.errorWidth.value || "2", 10), 1, 10);
    const capSize = clampInt(parseInt(els.capSize.value || "6", 10), 0, 20);

    const showGrid = els.toggleGrid.checked;
    const showLegend = els.toggleLegend.checked;

    const title = safeString(els.title.value).trim();
    const xTitle = safeString(els.xTitle.value).trim();
    const yTitle = safeString(els.yTitle.value).trim() || "Mean";

    const { paperBg, plotBg, fg, grid, axisLine } = themeTokens(theme);

    const baseLayout = {
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
      font: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial", size: fontSize, color: fg },
      margin: { l: 70, r: 20, t: title ? 60 : 30, b: 60 },
      title: title ? { text: title, x: 0.02, xanchor: "left", y: 0.98 } : undefined,
      xaxis: {
        title: xTitle || undefined,
        showgrid: showGrid,
        gridcolor: grid,
        zeroline: false,
        showline: true,
        linecolor: axisLine,
        ticks: "outside",
        ticklen: 6
      },
      yaxis: {
        title: yTitle || undefined,
        showgrid: showGrid,
        gridcolor: grid,
        zeroline: false,
        showline: true,
        linecolor: axisLine,
        ticks: "outside",
        ticklen: 6
      },
      showlegend: showLegend
    };

    applyLegendPosition(baseLayout);

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "resetScale2d"]
    };

    let fig;
    if (chartType === "bar") {
      fig = makeBarFigure(filtered, xMode, groupMode, errorMode, overlayRaw, markerSize, errorWidth, capSize);
    } else if (chartType === "scatter") {
      fig = makeScatterFigure(filtered, xMode, groupMode, errorMode, overlayRaw, markerSize, errorWidth, capSize);
    } else {
      fig = makeLineFigure(filtered, xMode, groupMode, errorMode, overlayRaw, markerSize, lineWidth, errorWidth, capSize);
    }

    const layout = { ...baseLayout, ...fig.layout };
    const data = fig.data;

    Plotly.react(els.chart, data, layout, config);

    setEmptyChart(false);
    state.lastFigure = { data, layout, config };
    updateButtons();

    const lowN = filtered.filter(r => r.n < 2).length;
    if (lowN > 0 && errorMode !== "none") {
      logMsg(`Warning: ${lowN} row(s) have n < 2. Error bars are hidden for those rows.`, "warn");
    }
  }

  function makeBarFigure(rows, xMode, groupMode, errorMode, overlayRaw, markerSize, errorWidth, capSize) {
    // For bar chart we use numeric x positions so raw points can jitter.
    // Categories are shown via ticktext.
    const xInfo = buildBarX(rows, xMode);
    const categories = xInfo.categories;
    const xIndexByKey = xInfo.xIndexByKey;

    const keyFn = (r) => xInfo.keyOf(r);

    const seriesKeyFn = (r) => {
      if (groupMode === "condition" && state.colCondition) return r.Condition || "(blank)";
      if (groupMode === "id") return r.ID || "(blank)";
      return "Mean";
    };

    const seriesKeys = uniqueValues(rows.map(seriesKeyFn)).sort();
    const traces = [];

    const offsets = seriesKeys.length > 1 ? computeOffsets(seriesKeys.length, 0.7) : [0];

    seriesKeys.forEach((sk, i) => {
      const subset = rows.filter(r => seriesKeyFn(r) === sk);

      const x = [];
      const y = [];
      const err = [];

      // Keep category order consistent
      categories.forEach(cat => {
        const rowForCat = subset.find(r => keyFn(r) === cat);
        if (!rowForCat) return;

        const xi = xIndexByKey.get(cat) + offsets[i];
        x.push(xi);
        y.push(rowForCat.mean ?? NaN);

        const e = pickError(rowForCat, errorMode);
        err.push(rowForCat.n >= 2 ? (e ?? 0) : 0);
      });

      traces.push({
        type: "bar",
        name: sk,
        x,
        y,
        marker: { line: { width: 0 } },
        error_y: errorMode === "none" ? undefined : {
          type: "data",
          array: err,
          visible: true,
          thickness: errorWidth,
          width: capSize
        },
        hovertemplate: hoverTemplate(errorMode) + "<extra></extra>"
      });
    });

    if (overlayRaw) {
      const rawTraces = makeRawOverlayForBar(rows, xInfo, groupMode, markerSize, offsets);
      rawTraces.forEach(t => traces.push(t));
    }

    const layout = {
      barmode: seriesKeys.length > 1 ? "group" : "relative",
      xaxis: {
        tickmode: "array",
        tickvals: categories.map(c => xIndexByKey.get(c)),
        ticktext: categories,
        range: [-0.8, categories.length - 1 + 0.8]
      }
    };

    return { data: traces, layout };
  }

  function makeRawOverlayForBar(rows, xInfo, groupMode, markerSize, offsets) {
    const categories = xInfo.categories;
    const xIndexByKey = xInfo.xIndexByKey;
    const keyFn = (r) => xInfo.keyOf(r);

    const seriesKeyFn = (r) => {
      if (groupMode === "condition" && state.colCondition) return r.Condition || "(blank)";
      if (groupMode === "id") return r.ID || "(blank)";
      return "Raw";
    };
    const seriesKeys = uniqueValues(rows.map(seriesKeyFn)).sort();
    const useOffsets = seriesKeys.length > 1 ? offsets : [0];

    const traces = [];

    seriesKeys.forEach((sk, i) => {
      const subset = rows.filter(r => seriesKeyFn(r) === sk);

      const x = [];
      const y = [];
      const text = [];

      categories.forEach(cat => {
        const rowForCat = subset.find(r => keyFn(r) === cat);
        if (!rowForCat) return;

        const baseX = xIndexByKey.get(cat) + useOffsets[i];

        // Each replicate value becomes its own point
        state.replicateCols.forEach(col => {
          const v = toNumberOrNull(rowForCat.replicates[col]);
          if (v === null) return;
          const jitter = (Math.random() - 0.5) * 0.18;
          x.push(baseX + jitter);
          y.push(v);
          text.push(`${rowForCat.ID}${rowForCat.Condition ? " | " + rowForCat.Condition : ""}<br>${col}: ${v}`);
        });
      });

      traces.push({
        type: "scatter",
        mode: "markers",
        name: `${sk} raw`,
        x,
        y,
        text,
        hovertemplate: "%{text}<extra></extra>",
        marker: { size: Math.max(3, Math.floor(markerSize * 0.85)), opacity: 0.7 },
        showlegend: false
      });
    });

    return traces;
  }

  function makeScatterFigure(rows, xMode, groupMode, errorMode, overlayRaw, markerSize, errorWidth, capSize) {
    const xAccessor = makeXAccessor(xMode);
    const groupAccessor = makeGroupAccessor(groupMode);

    const groups = groupRows(rows, groupAccessor);
    const traces = [];

    Object.keys(groups).sort().forEach(g => {
      const subset = groups[g].filter(r => xAccessor(r) !== null && r.mean !== null);

      const x = subset.map(xAccessor);
      const y = subset.map(r => r.mean);
      const err = subset.map(r => (r.n >= 2 ? (pickError(r, errorMode) ?? 0) : 0));

      traces.push({
        type: "scatter",
        mode: "markers",
        name: g,
        x,
        y,
        marker: { size: markerSize },
        error_y: errorMode === "none" ? undefined : {
          type: "data",
          array: err,
          visible: true,
          thickness: errorWidth,
          width: capSize
        },
        hovertemplate: hoverTemplate(errorMode) + "<extra></extra>"
      });

      if (overlayRaw) {
        traces.push(makeRawOverlayForXY(subset, xAccessor, g, markerSize));
      }
    });

    return { data: traces, layout: {} };
  }

  function makeLineFigure(rows, xMode, groupMode, errorMode, overlayRaw, markerSize, lineWidth, errorWidth, capSize) {
    const xAccessor = makeXAccessor(xMode);
    const groupAccessor = makeGroupAccessor(groupMode);

    const groups = groupRows(rows, groupAccessor);
    const traces = [];

    Object.keys(groups).sort().forEach(g => {
      const subset = groups[g]
        .filter(r => xAccessor(r) !== null && r.mean !== null)
        .sort((a, b) => (xAccessor(a) - xAccessor(b)));

      const x = subset.map(xAccessor);
      const y = subset.map(r => r.mean);
      const err = subset.map(r => (r.n >= 2 ? (pickError(r, errorMode) ?? 0) : 0));

      traces.push({
        type: "scatter",
        mode: "lines+markers",
        name: g,
        x,
        y,
        line: { width: lineWidth },
        marker: { size: markerSize },
        error_y: errorMode === "none" ? undefined : {
          type: "data",
          array: err,
          visible: true,
          thickness: errorWidth,
          width: capSize
        },
        hovertemplate: hoverTemplate(errorMode) + "<extra></extra>"
      });

      if (overlayRaw) {
        traces.push(makeRawOverlayForXY(subset, xAccessor, `${g} raw`, Math.max(3, Math.floor(markerSize * 0.85))));
      }
    });

    return { data: traces, layout: {} };
  }

  function makeRawOverlayForXY(subset, xAccessor, name, markerSize) {
    const x = [];
    const y = [];
    const text = [];

    subset.forEach(r => {
      const xv = xAccessor(r);
      if (xv === null) return;

      state.replicateCols.forEach(col => {
        const v = toNumberOrNull(r.replicates[col]);
        if (v === null) return;
        x.push(xv);
        y.push(v);
        text.push(`${r.ID}${r.Condition ? " | " + r.Condition : ""}<br>${col}: ${v}`);
      });
    });

    return {
      type: "scatter",
      mode: "markers",
      name,
      x,
      y,
      text,
      hovertemplate: "%{text}<extra></extra>",
      marker: { size: markerSize, opacity: 0.65 },
      showlegend: false
    };
  }

  function buildBarX(rows, xMode) {
    // For bar charts, xMode can be id, time, or a numeric column.
    const keyOf = makeBarKeyAccessor(xMode);

    const keys = [];
    rows.forEach(r => {
      const k = keyOf(r);
      if (k === null) return;
      keys.push(k);
    });

    const categories = uniqueValues(keys).sort((a, b) => {
      // Sort numbers numerically, otherwise lexicographically
      const an = toNumberOrNull(a);
      const bn = toNumberOrNull(b);
      if (an !== null && bn !== null) return an - bn;
      return String(a).localeCompare(String(b));
    });

    const xIndexByKey = new Map();
    categories.forEach((c, i) => xIndexByKey.set(c, i));

    return { categories, xIndexByKey, keyOf };
  }

  function makeBarKeyAccessor(xMode) {
    if (xMode === "time") {
      return (r) => (r.Time === null || Number.isNaN(r.Time)) ? null : String(r.Time);
    }
    if (xMode && xMode.startsWith("col:")) {
      const col = xMode.slice(4);
      return (r) => {
        const raw = state.rows[r.__rowIndex][col];
        const num = toNumberOrNull(raw);
        if (num === null) return null;
        return String(num);
      };
    }
    // default id
    return (r) => (r.ID ? String(r.ID) : null);
  }

  function makeXAccessor(xMode) {
    if (xMode === "time") {
      return (r) => (r.Time === null || Number.isNaN(r.Time)) ? null : r.Time;
    }
    if (xMode && xMode.startsWith("col:")) {
      const col = xMode.slice(4);
      return (r) => {
        const raw = state.rows[r.__rowIndex][col];
        return toNumberOrNull(raw);
      };
    }
    // If user chooses ID for scatter or line, we map categories to indices.
    return (r) => {
      const ids = uniqueValues(state.computed.map(x => x.ID)).filter(Boolean).sort();
      const idx = ids.indexOf(r.ID);
      return idx >= 0 ? idx : null;
    };
  }

  function makeGroupAccessor(groupMode) {
    if (groupMode === "condition" && state.colCondition) {
      return (r) => r.Condition || "(blank)";
    }
    if (groupMode === "id") {
      return (r) => r.ID || "(blank)";
    }
    return () => "Series";
  }

  function pickError(row, errorMode) {
    if (errorMode === "sd") return row.stdev;
    if (errorMode === "sem") return row.sem;
    return null;
  }

  function hoverTemplate(errorMode) {
    const errLabel = errorMode === "sd" ? "SD" : (errorMode === "sem" ? "SEM" : "Error");
    const errPart = errorMode === "none" ? "" : `<br>${errLabel}: %{customdata[0]}`;
    return `ID: %{customdata[1]}%{customdata[2]}<br>Mean: %{y}${errPart}<br>n: %{customdata[3]}`;
  }

  function groupRows(rows, keyFn) {
    const out = {};
    rows.forEach(r => {
      const k = keyFn(r);
      if (!out[k]) out[k] = [];
      out[k].push(r);
    });
    return out;
  }

  function computeOffsets(n, span) {
    // Create centered offsets for grouped bars
    if (n <= 1) return [0];
    const step = span / Math.max(1, n);
    const start = -span / 2 + step / 2;
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(start + i * step);
    return arr;
  }

  function applyLegendPosition(layout) {
    const pos = els.legendPos.value;
    if (!layout.legend) layout.legend = {};
    if (pos === "right") {
      layout.legend.orientation = "v";
      layout.legend.x = 1.02;
      layout.legend.y = 1;
      layout.legend.xanchor = "left";
      layout.legend.yanchor = "top";
    } else if (pos === "left") {
      layout.legend.orientation = "v";
      layout.legend.x = -0.02;
      layout.legend.y = 1;
      layout.legend.xanchor = "right";
      layout.legend.yanchor = "top";
    } else if (pos === "top") {
      layout.legend.orientation = "h";
      layout.legend.x = 0;
      layout.legend.y = 1.12;
      layout.legend.xanchor = "left";
      layout.legend.yanchor = "top";
    } else {
      layout.legend.orientation = "h";
      layout.legend.x = 0;
      layout.legend.y = -0.22;
      layout.legend.xanchor = "left";
      layout.legend.yanchor = "top";
    }
  }

  function themeTokens(theme) {
    if (theme === "dark") {
      return {
        paperBg: "#0e1116",
        plotBg: "#0e1116",
        fg: "#e8edf5",
        grid: "rgba(232, 237, 245, 0.12)",
        axisLine: "rgba(232, 237, 245, 0.35)"
      };
    }
    return {
      paperBg: "#ffffff",
      plotBg: "#ffffff",
      fg: "#111318",
      grid: "rgba(17, 19, 24, 0.08)",
      axisLine: "rgba(17, 19, 24, 0.35)"
    };
  }

  function exportFigure(fmt) {
    if (!state.lastFigure) return;

    const scale = clampInt(parseInt(els.pngScale.value || "2", 10), 1, 6);
    const filenameBase = makeSafeFilename(state.lastFigure.layout.title?.text || "figure");

    const opts = fmt === "png"
      ? { format: "png", width: 1200, height: 720, scale }
      : { format: "svg" };

    Plotly.toImage(els.chart, opts).then((dataUrl) => {
      const ext = fmt;
      const filename = `${filenameBase}.${ext}`;

      if (fmt === "svg") {
        // toImage returns a data URL with SVG xml content
        downloadDataUrl(filename, dataUrl);
      } else {
        downloadDataUrl(filename, dataUrl);
      }

      logMsg(`Exported ${filename}.`, "ok");
    }).catch(err => {
      logMsg(`Export failed: ${err.message}`, "err");
    });
  }

  function downloadProcessedCsv() {
    if (!state.computed.length) return;

    const headers = [
      "ID",
      ...(state.colTime ? ["Time"] : []),
      ...(state.colCondition ? ["Condition"] : []),
      ...state.replicateCols,
      "mean",
      "stdev",
      "sem",
      "n"
    ];

    const lines = [];
    lines.push(headers.map(csvEscape).join(","));

    state.computed.forEach(r => {
      const row = [];
      row.push(r.ID);

      if (state.colTime) row.push(r.Time === null ? "" : String(r.Time));
      if (state.colCondition) row.push(r.Condition || "");

      state.replicateCols.forEach(col => row.push(safeString(r.replicates[col])));

      row.push(r.mean === null ? "" : numToString(r.mean));
      row.push(r.stdev === null ? "" : numToString(r.stdev));
      row.push(r.sem === null ? "" : numToString(r.sem));
      row.push(String(r.n));

      lines.push(row.map(csvEscape).join(","));
    });

    const csv = lines.join("\n");
    const filename = "processed_data.csv";
    downloadText(filename, csv, "text/csv;charset=utf-8");
    logMsg("Downloaded processed_data.csv.", "ok");
  }

  function renderPreviewTable(limit) {
    const cols = [
      "ID",
      ...(state.colTime ? ["Time"] : []),
      ...(state.colCondition ? ["Condition"] : []),
      ...state.replicateCols,
      "mean",
      "stdev",
      "sem",
      "n"
    ];

    els.previewHead.innerHTML = "";
    els.previewBody.innerHTML = "";

    const trh = document.createElement("tr");
    cols.forEach(c => {
      const th = document.createElement("th");
      th.textContent = c;
      trh.appendChild(th);
    });
    els.previewHead.appendChild(trh);

    const preview = state.computed.slice(0, limit);
    preview.forEach(r => {
      const tr = document.createElement("tr");

      cols.forEach(c => {
        const td = document.createElement("td");
        td.textContent = previewCellValue(r, c);
        tr.appendChild(td);
      });

      els.previewBody.appendChild(tr);
    });
  }

  function previewCellValue(r, col) {
    if (col === "ID") return r.ID || "";
    if (col === "Time") return r.Time === null ? "" : String(r.Time);
    if (col === "Condition") return r.Condition || "";
    if (col === "mean") return r.mean === null ? "" : numToString(r.mean);
    if (col === "stdev") return r.stdev === null ? "" : numToString(r.stdev);
    if (col === "sem") return r.sem === null ? "" : numToString(r.sem);
    if (col === "n") return String(r.n);
    if (state.replicateCols.includes(col)) return safeString(r.replicates[col]);
    return "";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function setEmptyChart(isEmpty) {
    els.emptyState.style.display = isEmpty ? "grid" : "none";
  }

  function loadExample() {
    const example =
`ID,Time,Condition,rep 1,rep 2,rep 3
A,0,Control,1.2,1.1,1.3
A,1,Control,1.8,1.7,1.9
A,2,Control,2.4,2.6,
B,0,Treated,0.9,1.0,0.8
B,1,Treated,1.6,1.5,1.7
B,2,Treated,2.0,,2.2
C,0,Control,1.0,1.1,1.0
C,1,Control,1.5,1.6,not_a_number
C,2,Control,2.1,2.2,2.1`;

    els.pasteArea.value = example;
    logMsg("Example loaded. Click Parse data.", "ok");
  }

  function fillSelect(selectEl, options, selectedValue) {
    selectEl.innerHTML = "";
    options.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v === "" ? "(none)" : v;
      selectEl.appendChild(opt);
    });
    if (options.includes(selectedValue)) selectEl.value = selectedValue;
    else selectEl.value = options[0] ?? "";
  }

  function fillMultiSelect(selectEl, values) {
    selectEl.innerHTML = "";
    values.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
  }

  function getMultiSelectValues(selectEl) {
    return Array.from(selectEl.selectedOptions).map(o => o.value);
  }

  function pickDefault(headers, preferredLower, fallback) {
    const map = new Map(headers.map(h => [h.toLowerCase().trim(), h]));
    for (const p of preferredLower) {
      if (map.has(p)) return map.get(p);
    }
    // Common exact fallback
    const fb = headers.find(h => h.toLowerCase().trim() === fallback.toLowerCase());
    return fb || "";
  }

  function isReplicateHeader(h) {
    const s = String(h || "").trim().toLowerCase();

    // Accept patterns such as:
    // iterate 1, iter2, rep 3, replicate_4, r5
    const re = /^(iterate|iter|replicate|rep|r)\s*[_ ]?\s*(\d+)$/i;
    return re.test(s);
  }

  function cssSafe(s) {
    return String(s).replace(/[^a-zA-Z0-9_]/g, "_");
  }

  function safeString(v) {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function toNumberOrNull(v) {
    const s = safeString(v).trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function average(arr) {
    let sum = 0;
    for (const v of arr) sum += v;
    return sum / arr.length;
  }

  function sampleStdev(arr) {
    const n = arr.length;
    if (n < 2) return NaN;
    const m = average(arr);
    let ss = 0;
    for (const v of arr) ss += (v - m) * (v - m);
    return Math.sqrt(ss / (n - 1));
  }

  function uniqueValues(arr) {
    return Array.from(new Set(arr));
  }

  function clampInt(v, min, max) {
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }

  function numToString(n) {
    // Nice default formatting for scientific figures and tables
    // Avoid too many trailing digits.
    const abs = Math.abs(n);
    if (abs >= 1000 || (abs > 0 && abs < 0.001)) return n.toExponential(3);
    return Number(n.toFixed(6)).toString();
  }

  function makeSafeFilename(name) {
    const base = safeString(name).trim() || "figure";
    return base.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 60) || "figure";
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadUrl(filename, url);
    URL.revokeObjectURL(url);
  }

  function downloadDataUrl(filename, dataUrl) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadUrl(filename, url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function csvEscape(s) {
    const v = safeString(s);
    if (/[,"\n\r]/.test(v)) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }

  function parseDelimited(text) {
    // Detect delimiter by first non empty line
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim().length);
    if (lines.length < 2) throw new Error("Need at least a header row and one data row.");

    const first = lines[0];
    const commaCount = (first.match(/,/g) || []).length;
    const tabCount = (first.match(/\t/g) || []).length;

    const delimiter = tabCount > commaCount ? "\t" : ",";

    const allRows = lines.map(line => parseLine(line, delimiter));

    const headers = allRows[0].map(h => safeString(h).trim());
    if (!headers.length) throw new Error("Header row is empty.");

    const rows = [];
    for (let i = 1; i < allRows.length; i++) {
      const cells = allRows[i];
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cells[idx] !== undefined ? cells[idx] : "";
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  }

  function parseLine(line, delimiter) {
    // Simple CSV style parser with quotes support
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === delimiter) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  function findNumericColumns(rows, headers, sampleN) {
    const take = rows.slice(0, sampleN);
    const numeric = [];

    headers.forEach(h => {
      let hits = 0;
      let tries = 0;
      for (const r of take) {
        const raw = safeString(r[h]).trim();
        if (!raw) continue;
        tries++;
        const n = Number(raw);
        if (Number.isFinite(n)) hits++;
      }
      if (tries >= 3 && hits / tries >= 0.8) numeric.push(h);
    });

    return numeric;
  }

  function clearMsgs() {
    els.messages.innerHTML = "";
  }

  function logMsg(text, kind) {
    const div = document.createElement("div");
    div.className = `msg msg_${kind || "ok"}`;
    div.textContent = text;
    els.messages.appendChild(div);
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => {
  // Ensure Plotly is available
  if (!window.Plotly) {
    const msg = document.getElementById("messages");
    msg.textContent = "Plotly did not load. If you are offline on first load, open the page once with internet or vendor Plotly in the repo.";
    return;
  }
  App.init();
});
