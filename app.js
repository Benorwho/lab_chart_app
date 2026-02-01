/* app.js v0.3.0
   Adds:
   table editor mode via Grid
   summary stats mode (use provided value and error columns)
   table export (HTML, PNG, PDF)
   local Plotly and local html-to-image

   No storage. No cookies. No analytics.
*/

const App = (() => {
  const state = {
    mode: "paste",
    view: "chart",

    headers: [],
    rows: [],
    replicateCols: [],

    colId: "ID",
    colTime: "",
    colCondition: "",

    statsMode: "replicates",
    colValue: "",
    colError: "",
    colN: "",
    summaryErrorMeaning: "sd",

    computed: [],
    lastFigure: null,

    gridApi: null,
    gridModel: null,
    workflowStep: 1
  };

  const els = {};

  function init() {
    cacheEls();
    bindEvents();
    setEmptyChart(true);

    if (!window.Plotly) logMsg("Plotly not found. Check libs/plotly.min.js", "err");
    if (!window.htmlToImage) logMsg("html-to-image not found. Check libs/html-to-image.min.js", "err");

    initGrid();
    logMsg("✨ Ready! Load data to begin.", "ok");
    updateButtons();
    
    // Enhanced v0.3: Initialize workflow and UI
    updateWorkflowProgress(1);
    updateButtonTooltips();
  }

  function cacheEls() {
    // Enhanced v0.3 elements
    els.btnHelp = document.getElementById("btnHelp");
    els.helpModal = document.getElementById("helpModal");
    els.btnCloseHelp = document.getElementById("btnCloseHelp");
    els.dataPreview = document.getElementById("dataPreview");
    els.dataStats = document.getElementById("dataStats");

    els.tabPaste = document.getElementById("tabPaste");
    els.tabGrid = document.getElementById("tabGrid");
    els.panePaste = document.getElementById("panePaste");
    els.paneGrid = document.getElementById("paneGrid");

    els.tabViewChart = document.getElementById("tabViewChart");
    els.tabViewTable = document.getElementById("tabViewTable");
    els.viewChart = document.getElementById("viewChart");
    els.viewTable = document.getElementById("viewTable");

    els.fileInput = document.getElementById("fileInput");
    els.pasteArea = document.getElementById("pasteArea");
    els.btnParse = document.getElementById("btnParse");
    els.btnLoadExample = document.getElementById("btnLoadExample");

    els.btnClearAll = document.getElementById("btnClearAll");

    els.btnGridAddRow = document.getElementById("btnGridAddRow");
    els.btnGridAddCol = document.getElementById("btnGridAddCol");
    els.btnGridAddRep = document.getElementById("btnGridAddRep");
    els.btnGridDelete = document.getElementById("btnGridDelete");
    els.btnGridUndo = document.getElementById("btnGridUndo");
    els.btnGridRedo = document.getElementById("btnGridRedo");
    els.toggleLive = document.getElementById("toggleLive");

    els.statsMode = document.getElementById("statsMode");
    els.colId = document.getElementById("colId");
    els.colTime = document.getElementById("colTime");
    els.colCondition = document.getElementById("colCondition");
    els.replicateList = document.getElementById("replicateList");
    els.replicateBlock = document.getElementById("replicateBlock");

    els.summaryBlock = document.getElementById("summaryBlock");
    els.colValue = document.getElementById("colValue");
    els.colError = document.getElementById("colError");
    els.colN = document.getElementById("colN");
    els.errorMeaning = document.getElementById("errorMeaning");

    els.btnCompute = document.getElementById("btnCompute");
    els.btnDownloadProcessed = document.getElementById("btnDownloadProcessed");

    els.chartType = document.getElementById("chartType");
    els.xMode = document.getElementById("xMode");
    els.groupMode = document.getElementById("groupMode");
    els.errorMode = document.getElementById("errorMode");
    els.toggleRaw = document.getElementById("toggleRaw");
    els.toggleGrid = document.getElementById("toggleGrid");
    els.toggleLegend = document.getElementById("toggleLegend");

    els.filterIds = document.getElementById("filterIds");
    els.filterConditions = document.getElementById("filterConditions");

    els.btnRender = document.getElementById("btnRender");
    els.btnResetView = document.getElementById("btnResetView");

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

    els.tableTitle = document.getElementById("tableTitle");
    els.tableCaption = document.getElementById("tableCaption");
    els.tableVariant = document.getElementById("tableVariant");
    els.tableDecimals = document.getElementById("tableDecimals");
    els.btnExportTableHtml = document.getElementById("btnExportTableHtml");
    els.btnExportTablePng = document.getElementById("btnExportTablePng");
    els.btnExportTablePdf = document.getElementById("btnExportTablePdf");

    els.messages = document.getElementById("messages");
    els.chart = document.getElementById("chart");
    els.emptyState = document.getElementById("emptyState");

    els.previewTable = document.getElementById("previewTable");
    els.previewHead = els.previewTable.querySelector("thead");
    els.previewBody = els.previewTable.querySelector("tbody");

    els.gridMount = document.getElementById("gridMount");
  }

  function bindEvents() {
    // Enhanced v0.3 - Help modal
    if (els.btnHelp) {
      els.btnHelp.addEventListener("click", showHelpModal);
    }
    if (els.btnCloseHelp && els.helpModal) {
      els.btnCloseHelp.addEventListener("click", hideHelpModal);
      const backdrop = els.helpModal.querySelector(".modal_backdrop");
      if (backdrop) backdrop.addEventListener("click", hideHelpModal);
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyboardShortcuts);

    // Panel collapse
    document.querySelectorAll(".panel_collapsible").forEach(panel => {
      const header = panel.querySelector(".panel_header");
      if (header) {
        header.addEventListener("click", () => togglePanel(panel));
      }
    });

    els.tabPaste.addEventListener("click", () => setMode("paste"));
    els.tabGrid.addEventListener("click", () => setMode("grid"));

    els.tabViewChart.addEventListener("click", () => setView("chart"));
    els.tabViewTable.addEventListener("click", () => setView("table"));

    els.fileInput.addEventListener("change", onFilePicked);
    els.btnParse.addEventListener("click", onParse);
    els.btnLoadExample.addEventListener("click", loadExample);

    els.btnClearAll.addEventListener("click", clearAll);

    els.btnGridAddRow.addEventListener("click", () => { state.gridApi.addRow(); });
    els.btnGridAddCol.addEventListener("click", () => { state.gridApi.addCol(); });
    els.btnGridAddRep.addEventListener("click", () => { state.gridApi.addReplicate(); });
    els.btnGridDelete.addEventListener("click", () => { state.gridApi.deleteSelected(); });
    els.btnGridUndo.addEventListener("click", () => { state.gridApi.undo(); });
    els.btnGridRedo.addEventListener("click", () => { state.gridApi.redo(); });

    els.statsMode.addEventListener("change", () => {
      state.statsMode = els.statsMode.value;
      syncStatsModeUI();
      computeIfLive();
    });

    els.errorMeaning.addEventListener("change", () => {
      state.summaryErrorMeaning = els.errorMeaning.value;
      computeIfLive();
    });

    els.colId.addEventListener("change", () => { state.colId = els.colId.value; refreshFilters(); computeIfLive(); });
    els.colTime.addEventListener("change", () => { state.colTime = els.colTime.value; setupXModeOptions(); computeIfLive(); });
    els.colCondition.addEventListener("change", () => { state.colCondition = els.colCondition.value; refreshFilters(); computeIfLive(); });

    els.colValue.addEventListener("change", () => { state.colValue = els.colValue.value; computeIfLive(); });
    els.colError.addEventListener("change", () => { state.colError = els.colError.value; computeIfLive(); });
    els.colN.addEventListener("change", () => { state.colN = els.colN.value; computeIfLive(); });

    els.btnCompute.addEventListener("click", computeNow);
    els.btnRender.addEventListener("click", renderChart);
    els.btnResetView.addEventListener("click", resetView);

    els.btnDownloadProcessed.addEventListener("click", downloadProcessedCsv);

    els.btnExportSvg.addEventListener("click", () => exportFigure("svg"));
    els.btnExportPng.addEventListener("click", () => exportFigure("png"));

    els.btnExportTableHtml.addEventListener("click", exportTableHtml);
    els.btnExportTablePng.addEventListener("click", exportTablePng);
    els.btnExportTablePdf.addEventListener("click", exportTablePdf);

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

  function initGrid() {
    state.gridModel = window.Grid.createGridModel();
    state.gridApi = window.Grid.mountGrid(els.gridMount, state.gridModel, (model) => {
      if (state.mode !== "grid") return;
      if (els.toggleLive.checked) {
        loadFromGridModel(model);
        computeNow(true);
      } else {
        loadFromGridModel(model);
        updateButtons();
      }
    });

    loadFromGridModel(state.gridModel);
    setupSelectors();
    syncStatsModeUI();
    refreshFilters();
    setupXModeOptions();
    updateButtons();
  }

  function setMode(mode) {
    state.mode = mode;

    els.tabPaste.classList.toggle("segBtn_active", mode === "paste");
    els.tabGrid.classList.toggle("segBtn_active", mode === "grid");

    els.panePaste.classList.toggle("pane_active", mode === "paste");
    els.paneGrid.classList.toggle("pane_active", mode === "grid");

    if (mode === "grid") {
      loadFromGridModel(state.gridApi.getModel());
      setupSelectors();
      syncStatsModeUI();
      refreshFilters();
      setupXModeOptions();
      updateButtons();
      if (els.toggleLive.checked) computeNow(true);
    }
  }

  function setView(view) {
    state.view = view;
    els.tabViewChart.classList.toggle("segBtn_active", view === "chart");
    els.tabViewTable.classList.toggle("segBtn_active", view === "table");
    els.viewChart.classList.toggle("view_active", view === "chart");
    els.viewTable.classList.toggle("view_active", view === "table");
  }

  function syncStatsModeUI() {
    const isSummary = state.statsMode === "summary";
    els.summaryBlock.style.display = isSummary ? "block" : "none";
    els.replicateBlock.style.display = isSummary ? "none" : "block";

    els.toggleRaw.disabled = isSummary;
    if (isSummary) els.toggleRaw.checked = false;

    if (isSummary) {
      els.errorMode.value = els.errorMeaning.value;
      els.errorMode.disabled = true;
    } else {
      els.errorMode.disabled = false;
    }
  }

  function computeIfLive() {
    if (state.mode === "grid" && !els.toggleLive.checked) return;
    if (!state.rows.length) return;
    computeNow(true);
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
    const text = (els.pasteArea.value || "").trim();
    if (!text) {
      logMsg("No data found. Paste CSV or TSV, or upload a CSV file.", "err");
      return;
    }

    let parsed;
    try {
      parsed = parseDelimited(text);
    } catch (err) {
      logMsg(`Parsing failed: ${err.message}`, "err");
      return;
    }

    state.headers = parsed.headers;
    state.rows = parsed.rows;

    setupSelectors();
    autoDetectReplicates();
    syncStatsModeUI();
    refreshFilters();
    setupXModeOptions();

    state.computed = [];
    state.lastFigure = null;
    if (window.Plotly) Plotly.purge(els.chart);
    setEmptyChart(true);

    logMsg(`Parsed ${state.rows.length} rows and ${state.headers.length} columns. Now configure columns.`, "ok");
    updateButtons();
    
    // Enhanced v0.3: Show data preview and update workflow
    showDataPreview();
    updateWorkflowProgress(2); // Move to Configure step
    updateButtonTooltips();
  }

  function loadFromGridModel(model) {
    state.headers = model.headers.slice();
    state.rows = model.rows.map(r => {
      const obj = {};
      state.headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
      return obj;
    });
  }

  function setupSelectors() {
    const headers = state.headers;
    if (!headers.length) return;

    fillSelect(els.colId, headers, pickDefault(headers, ["id", "sample", "name"], "ID"));
    fillSelect(els.colTime, ["", ...headers], pickDefault(headers, ["time", "t"], ""));
    fillSelect(els.colCondition, ["", ...headers], pickDefault(headers, ["condition", "group", "treatment"], ""));

    state.colId = els.colId.value;
    state.colTime = els.colTime.value;
    state.colCondition = els.colCondition.value;

    fillSelect(els.colValue, headers, pickDefault(headers, ["protein conc. (mg/l)", "protein", "value", "y"], ""));
    fillSelect(els.colError, ["", ...headers], pickDefault(headers, ["stdv", "stdev", "sd", "sem", "error"], ""));
    fillSelect(els.colN, ["", ...headers], pickDefault(headers, ["n", "count"], ""));

    state.colValue = els.colValue.value;
    state.colError = els.colError.value;
    state.colN = els.colN.value;
  }

  function autoDetectReplicates() {
    const detected = [];
    for (const h of state.headers) {
      if (isReplicateHeader(h)) detected.push(h);
    }
    state.replicateCols = detected;
    renderReplicateChecklist(state.headers, detected);

    if (!detected.length) logMsg("No replicate columns auto detected. Select them manually or switch to summary mode.", "warn");
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
        state.replicateCols = getChosenReplicatesFromUI(headers);
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

  function refreshFilters() {
    if (!state.rows.length || !state.colId) return;

    const ids = uniqueValues(state.rows.map(r => safeString(r[state.colId]))).filter(Boolean).sort();
    fillMultiSelect(els.filterIds, ids);

    if (state.colCondition) {
      const conds = uniqueValues(state.rows.map(r => safeString(r[state.colCondition]))).filter(Boolean).sort();
      fillMultiSelect(els.filterConditions, conds);
      els.filterConditions.disabled = false;
    } else {
      fillMultiSelect(els.filterConditions, []);
      els.filterConditions.disabled = true;
    }
  }

  function setupXModeOptions() {
    const options = [];
    options.push({ value: "id", label: "ID" });
    if (state.colTime) options.push({ value: "time", label: `Time (${state.colTime})` });

    const numericCols = findNumericColumns(state.rows, state.headers, 25);
    numericCols.forEach(c => {
      if (c !== state.colTime && c !== state.colId && c !== state.colCondition) {
        options.push({ value: `col:${c}`, label: `Column (${c})` });
      }
    });

    els.xMode.innerHTML = "";
    options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      els.xMode.appendChild(o);
    });

    els.xMode.value = state.colTime ? "time" : "id";
  }

  function computeNow(silent) {
    clearMsgs();

    if (!state.rows.length || !state.headers.length) {
      logMsg("No data loaded yet.", "err");
      updateButtons();
      return;
    }

    state.colId = els.colId.value;
    state.colTime = els.colTime.value;
    state.colCondition = els.colCondition.value;
    state.statsMode = els.statsMode.value;

    state.colValue = els.colValue.value;
    state.colError = els.colError.value;
    state.colN = els.colN.value;
    state.summaryErrorMeaning = els.errorMeaning.value;

    syncStatsModeUI();

    if (!state.colId) {
      logMsg("ID column is required.", "err");
      updateButtons();
      return;
    }

    if (state.statsMode === "replicates") {
      state.replicateCols = getChosenReplicatesFromUI(state.headers);
      if (!state.replicateCols.length) {
        logMsg("Select at least one replicate column, or switch to summary mode.", "err");
        updateButtons();
        return;
      }
      state.computed = computeFromReplicates();
    } else {
      if (!state.colValue) {
        logMsg("Pick a value column for summary mode.", "err");
        updateButtons();
        return;
      }
      state.computed = computeFromSummaryColumns();
      els.errorMode.value = state.summaryErrorMeaning;
    }

    renderPreviewTable(20);
    updateButtons();

    if (!silent) logMsg("Computed. Now render your chart.", "ok");

    // Enhanced v0.3: Update workflow
    updateWorkflowProgress(4); // Move to Visualize step
    updateButtonTooltips();

    renderChart();
  }

  function computeFromSummaryColumns() {
    const warnings = [];
    const out = [];

    state.rows.forEach((row, idx) => {
      const id = safeString(row[state.colId]).trim();
      const timeVal = state.colTime ? toNumberOrNull(row[state.colTime]) : null;
      const condition = state.colCondition ? safeString(row[state.colCondition]).trim() : "";

      const value = toNumberOrNull(row[state.colValue]);
      const err = state.colError ? toNumberOrNull(row[state.colError]) : null;
      const n = state.colN ? (toNumberOrNull(row[state.colN]) ?? null) : null;

      if (!id) warnings.push(`Row ${idx + 2} has empty ID.`);
      if (value === null) warnings.push(`Row ${idx + 2} has missing or non numeric value in ${state.colValue}.`);

      out.push({
        __rowIndex: idx,
        ID: id,
        Time: timeVal,
        Condition: condition,
        n: n === null ? (value === null ? 0 : 1) : Math.max(0, Math.floor(n)),
        mean: value,
        stdev: state.summaryErrorMeaning === "sd" ? err : null,
        sem: state.summaryErrorMeaning === "sem" ? err : null,
        replicates: {}
      });
    });

    if (warnings.length) logMsg(warnings.slice(0, 8).join("\n"), "warn");
    return out;
  }

  function computeFromReplicates() {
    const warnings = [];
    const out = [];

    state.rows.forEach((row, idx) => {
      const id = safeString(row[state.colId]).trim();
      const timeVal = state.colTime ? toNumberOrNull(row[state.colTime]) : null;
      const condition = state.colCondition ? safeString(row[state.colCondition]).trim() : "";

      const reps = {};
      const nums = [];
      const invalid = [];

      state.replicateCols.forEach(col => {
        reps[col] = row[col];
        const raw = safeString(row[col]).trim();
        if (!raw) return;
        const n = toNumberOrNull(raw);
        if (n === null) invalid.push(`${col}="${raw}"`);
        else nums.push(n);
      });

      const n = nums.length;
      const mean = n ? average(nums) : null;
      const stdev = n >= 2 ? sampleStdev(nums) : null;
      const sem = n >= 2 ? (stdev / Math.sqrt(n)) : null;

      if (!id) warnings.push(`Row ${idx + 2} has empty ID.`);
      if (invalid.length) warnings.push(`Row ${idx + 2} has non numeric replicate values: ${invalid.join(", ")}`);
      if (n < 1) warnings.push(`Row ${idx + 2} has no numeric replicate values.`);
      if (n < 2) warnings.push(`Row ${idx + 2} has n < 2. Error bars hidden for that row.`);

      out.push({
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

    if (warnings.length) logMsg(warnings.slice(0, 8).join("\n"), "warn");
    return out;
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
      logMsg("Filter removed all rows. Clear filters to show data.", "warn");
      Plotly.purge(els.chart);
      setEmptyChart(true);
      state.lastFigure = null;
      updateButtons();
      return;
    }

    const fontSize = clampInt(parseInt(els.fontSize.value || "14", 10), 8, 28);
    const markerSize = clampInt(parseInt(els.markerSize.value || "7", 10), 2, 24);
    const lineWidth = clampInt(parseInt(els.lineWidth.value || "2", 10), 1, 10);
    const errorWidth = clampInt(parseInt(els.errorWidth.value || "2", 10), 1, 10);
    const capSize = clampInt(parseInt(els.capSize.value || "6", 10), 0, 20);

    const showGrid = els.toggleGrid.checked;
    const showLegend = els.toggleLegend.checked;

    const title = safeString(els.title.value).trim();
    const xTitle = safeString(els.xTitle.value).trim();
    const yTitle = safeString(els.yTitle.value).trim() || (state.statsMode === "summary" ? state.colValue : "Mean");

    const colors = ardaThemeTokens();

    const baseLayout = {
      paper_bgcolor: colors.paperBg,
      plot_bgcolor: colors.plotBg,
      font: { family: "Space Grotesk, system-ui, -apple-system, Segoe UI, Roboto, Arial", size: fontSize, color: colors.fg },
      margin: { l: 70, r: 20, t: title ? 60 : 30, b: 60 },
      title: title ? { text: title, x: 0.02, xanchor: "left", y: 0.98 } : undefined,
      xaxis: {
        title: xTitle || undefined,
        showgrid: showGrid,
        gridcolor: colors.grid,
        zeroline: false,
        showline: true,
        linecolor: colors.axis,
        ticks: "outside",
        ticklen: 6
      },
      yaxis: {
        title: yTitle || undefined,
        showgrid: showGrid,
        gridcolor: colors.grid,
        zeroline: false,
        showline: true,
        linecolor: colors.axis,
        ticks: "outside",
        ticklen: 6
      },
      showlegend: showLegend
    };

    applyLegendPosition(baseLayout);

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false
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
  }

  function makeBarFigure(rows, xMode, groupMode, errorMode, overlayRaw, markerSize, errorWidth, capSize) {
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
    const offsets = seriesKeys.length > 1 ? computeOffsets(seriesKeys.length, 0.7) : [0];

    const traces = [];

    seriesKeys.forEach((sk, i) => {
      const subset = rows.filter(r => seriesKeyFn(r) === sk);

      const x = [];
      const y = [];
      const err = [];

      categories.forEach(cat => {
        const rowForCat = subset.find(r => keyFn(r) === cat);
        if (!rowForCat) return;

        const xi = xIndexByKey.get(cat) + offsets[i];
        x.push(xi);
        y.push(rowForCat.mean ?? NaN);

        const e = pickError(rowForCat, errorMode);
        const hasErr = rowForCat.n >= 2 || state.statsMode === "summary";
        err.push((errorMode === "none" || !hasErr) ? 0 : (e ?? 0));
      });

      traces.push({
        type: "bar",
        name: sk,
        x,
        y,
        marker: { color: "#EAB262" },
        error_y: errorMode === "none" ? undefined : {
          type: "data",
          array: err,
          visible: true,
          thickness: errorWidth,
          width: capSize
        }
      });
    });

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

  function makeScatterFigure(rows, xMode, groupMode, errorMode, overlayRaw, markerSize, errorWidth, capSize) {
    const xAccessor = makeXAccessor(xMode);
    const groupAccessor = makeGroupAccessor(groupMode);

    const groups = groupRows(rows, groupAccessor);
    const traces = [];

    Object.keys(groups).sort().forEach(g => {
      const subset = groups[g].filter(r => xAccessor(r) !== null && r.mean !== null);

      const x = subset.map(xAccessor);
      const y = subset.map(r => r.mean);
      const err = subset.map(r => {
        const hasErr = r.n >= 2 || state.statsMode === "summary";
        return (errorMode === "none" || !hasErr) ? 0 : (pickError(r, errorMode) ?? 0);
      });

      traces.push({
        type: "scatter",
        mode: "markers",
        name: g,
        x,
        y,
        marker: { size: markerSize, color: "#2A4A44" },
        error_y: errorMode === "none" ? undefined : {
          type: "data",
          array: err,
          visible: true,
          thickness: errorWidth,
          width: capSize
        }
      });

      if (overlayRaw && state.statsMode === "replicates") {
        traces.push(makeRawOverlayForXY(subset, xAccessor, markerSize));
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
      const err = subset.map(r => {
        const hasErr = r.n >= 2 || state.statsMode === "summary";
        return (errorMode === "none" || !hasErr) ? 0 : (pickError(r, errorMode) ?? 0);
      });

      traces.push({
        type: "scatter",
        mode: "lines+markers",
        name: g,
        x,
        y,
        line: { width: lineWidth, color: "#2A4A44" },
        marker: { size: markerSize, color: "#2A4A44" },
        error_y: errorMode === "none" ? undefined : {
          type: "data",
          array: err,
          visible: true,
          thickness: errorWidth,
          width: capSize
        }
      });

      if (overlayRaw && state.statsMode === "replicates") {
        traces.push(makeRawOverlayForXY(subset, xAccessor, Math.max(3, Math.floor(markerSize * 0.85))));
      }
    });

    return { data: traces, layout: {} };
  }

  function makeRawOverlayForXY(subset, xAccessor, markerSize) {
    const x = [];
    const y = [];

    subset.forEach(r => {
      const xv = xAccessor(r);
      if (xv === null) return;

      state.replicateCols.forEach(col => {
        const v = toNumberOrNull(r.replicates[col]);
        if (v === null) return;
        x.push(xv);
        y.push(v);
      });
    });

    return {
      type: "scatter",
      mode: "markers",
      name: "raw",
      x,
      y,
      marker: { size: markerSize, opacity: 0.55, color: "#2A4A44" },
      showlegend: false
    };
  }

  function buildBarX(rows, xMode) {
    const keyOf = makeBarKeyAccessor(xMode);

    const keys = [];
    rows.forEach(r => {
      const k = keyOf(r);
      if (k === null) return;
      keys.push(k);
    });

    const categories = uniqueValues(keys).sort((a, b) => {
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
    return (r) => {
      const ids = uniqueValues(state.computed.map(x => x.ID)).filter(Boolean).sort();
      const idx = ids.indexOf(r.ID);
      return idx >= 0 ? idx : null;
    };
  }

  function makeGroupAccessor(groupMode) {
    if (groupMode === "condition" && state.colCondition) return (r) => r.Condition || "(blank)";
    if (groupMode === "id") return (r) => r.ID || "(blank)";
    return () => "Series";
  }

  function pickError(row, errorMode) {
    if (errorMode === "sd") return row.stdev;
    if (errorMode === "sem") return row.sem;
    return null;
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

  function resetView() {
    if (!state.lastFigure) return;
    Plotly.react(els.chart, state.lastFigure.data, state.lastFigure.layout, state.lastFigure.config);
  }

  function exportFigure(fmt) {
    if (!state.lastFigure) return;

    const scale = clampInt(parseInt(els.pngScale.value || "2", 10), 1, 6);
    const filenameBase = makeSafeFilename(state.lastFigure.layout.title?.text || "figure");

    const opts = fmt === "png"
      ? { format: "png", width: 1200, height: 720, scale }
      : { format: "svg" };

    Plotly.toImage(els.chart, opts).then((dataUrl) => {
      downloadDataUrl(`${filenameBase}.${fmt}`, dataUrl);
      logMsg(`Exported ${filenameBase}.${fmt}`, "ok");
    }).catch(err => {
      logMsg(`Export failed: ${err.message}`, "err");
    });
  }

  function exportTableHtml() {
    const pack = buildExportTablePack();
    if (!pack) return;

    const html = window.TableExport.buildTableHtml({
      title: els.tableTitle.value || "",
      caption: els.tableCaption.value || "",
      meta: pack.meta,
      columns: pack.columns,
      rows: pack.rows
    });

    window.TableExport.exportHtmlFile("table_export.html", html);
    logMsg("Exported table_export.html", "ok");
  }

  async function exportTablePng() {
    const pack = buildExportTablePack();
    if (!pack) return;

    const html = window.TableExport.buildTableHtml({
      title: els.tableTitle.value || "",
      caption: els.tableCaption.value || "",
      meta: pack.meta,
      columns: pack.columns,
      rows: pack.rows
    });

    const scale = clampInt(parseInt(els.pngScale.value || "2", 10), 1, 6);
    await window.TableExport.exportPngFromHtml(html, "table_export.png", scale);
    logMsg("Exported table_export.png", "ok");
  }

  function exportTablePdf() {
    const pack = buildExportTablePack();
    if (!pack) return;

    const html = window.TableExport.buildTableHtml({
      title: els.tableTitle.value || "",
      caption: els.tableCaption.value || "",
      meta: pack.meta,
      columns: pack.columns,
      rows: pack.rows
    });

    window.TableExport.exportPdfPrintView(html);
  }

  function buildExportTablePack() {
    if (!state.computed.length) {
      logMsg("Compute data first.", "err");
      return null;
    }

    const variant = els.tableVariant.value;
    const decimals = clampInt(parseInt(els.tableDecimals.value || "3", 10), 0, 10);
    const errorMode = els.errorMode.value;

    const metaParts = [];
    if (variant === "summary") {
      if (errorMode === "sd") metaParts.push("Error is SD");
      if (errorMode === "sem") metaParts.push("Error is SEM");
      if (errorMode === "none") metaParts.push("No error bars");
    }
    const lowN = state.computed.filter(r => r.n < 2).length;
    if (lowN > 0 && errorMode !== "none" && state.statsMode === "replicates") metaParts.push(`${lowN} row(s) have n < 2`);

    const meta = metaParts.join(" | ");

    let columns;
    let rows;

    if (variant === "summary") {
      columns = ["ID"];
      if (state.colTime) columns.push("Time");
      if (state.colCondition) columns.push("Condition");
      columns.push("Mean");
      if (errorMode !== "none") columns.push(errorMode.toUpperCase());
      columns.push("n");

      rows = state.computed.map(r => {
        const arr = [];
        arr.push(r.ID || "");
        if (state.colTime) arr.push(r.Time === null ? "" : String(r.Time));
        if (state.colCondition) arr.push(r.Condition || "");
        arr.push(formatNum(r.mean, decimals));
        if (errorMode !== "none") arr.push(formatNum(pickError(r, errorMode), decimals));
        arr.push(String(r.n ?? ""));
        return arr;
      });
    } else {
      columns = ["ID"];
      if (state.colTime) columns.push("Time");
      if (state.colCondition) columns.push("Condition");

      if (state.statsMode === "replicates") {
        columns = columns.concat(state.replicateCols);
      } else {
        columns.push(state.colValue || "Value");
        if (state.colError) columns.push(state.colError);
        if (state.colN) columns.push(state.colN);
      }

      columns = columns.concat(["mean", "stdev", "sem", "n"]);

      rows = state.computed.map(r => {
        const arr = [];
        arr.push(r.ID || "");
        if (state.colTime) arr.push(r.Time === null ? "" : String(r.Time));
        if (state.colCondition) arr.push(r.Condition || "");

        if (state.statsMode === "replicates") {
          state.replicateCols.forEach(col => arr.push(safeString(r.replicates[col])));
        } else {
          arr.push(formatNum(r.mean, decimals));
          if (state.colError) arr.push(formatNum(pickError(r, els.errorMeaning.value), decimals));
          if (state.colN) arr.push(String(r.n ?? ""));
        }

        arr.push(formatNum(r.mean, decimals));
        arr.push(formatNum(r.stdev, decimals));
        arr.push(formatNum(r.sem, decimals));
        arr.push(String(r.n ?? ""));
        return arr;
      });
    }

    return { meta, columns, rows };
  }

  function downloadProcessedCsv() {
    if (!state.computed.length) return;

    let headers = ["ID"];
    if (state.colTime) headers.push("Time");
    if (state.colCondition) headers.push("Condition");

    if (state.statsMode === "replicates") headers = headers.concat(state.replicateCols);
    else headers.push(state.colValue || "Value");

    headers = headers.concat(["mean", "stdev", "sem", "n"]);

    const lines = [];
    lines.push(headers.map(csvEscape).join(","));

    state.computed.forEach(r => {
      const row = [];
      row.push(r.ID);

      if (state.colTime) row.push(r.Time === null ? "" : String(r.Time));
      if (state.colCondition) row.push(r.Condition || "");

      if (state.statsMode === "replicates") {
        state.replicateCols.forEach(col => row.push(safeString(r.replicates[col])));
      } else {
        row.push(r.mean === null ? "" : numToString(r.mean));
      }

      row.push(r.mean === null ? "" : numToString(r.mean));
      row.push(r.stdev === null ? "" : numToString(r.stdev));
      row.push(r.sem === null ? "" : numToString(r.sem));
      row.push(String(r.n));

      lines.push(row.map(csvEscape).join(","));
    });

    const csv = lines.join("\n");
    downloadText("processed_data.csv", csv, "text/csv;charset=utf-8");
    logMsg("Downloaded processed_data.csv", "ok");
  }

  function renderPreviewTable(limit) {
    const cols = ["ID"];
    if (state.colTime) cols.push("Time");
    if (state.colCondition) cols.push("Condition");

    if (state.statsMode === "replicates") cols.push(...state.replicateCols);
    else cols.push(state.colValue || "Value");

    cols.push("mean", "stdev", "sem", "n");

    els.previewHead.innerHTML = "";
    els.previewBody.innerHTML = "";

    const trh = document.createElement("tr");
    cols.forEach(c => {
      const th = document.createElement("th");
      th.textContent = c;
      trh.appendChild(th);
    });
    els.previewHead.appendChild(trh);

    state.computed.slice(0, limit).forEach(r => {
      const tr = document.createElement("tr");
      cols.forEach(c => {
        const td = document.createElement("td");
        td.textContent = previewCell(r, c);
        tr.appendChild(td);
      });
      els.previewBody.appendChild(tr);
    });
  }

  function previewCell(r, col) {
    if (col === "ID") return r.ID || "";
    if (col === "Time") return r.Time === null ? "" : String(r.Time);
    if (col === "Condition") return r.Condition || "";
    if (col === "mean") return r.mean === null ? "" : numToString(r.mean);
    if (col === "stdev") return r.stdev === null ? "" : numToString(r.stdev);
    if (col === "sem") return r.sem === null ? "" : numToString(r.sem);
    if (col === "n") return String(r.n ?? "");
    if (state.replicateCols.includes(col)) return safeString(r.replicates[col]);
    if (state.statsMode === "summary" && col === (state.colValue || "Value")) return r.mean === null ? "" : numToString(r.mean);
    return "";
  }

  function loadExample() {
    const example =
`ID,Time,Condition,rep 1,rep 2,rep 3
C13- X,0,Overnight,4438.5,4252.4,4624.6
C13- DS-amylased,0,Overnight,2403.0,1865.0,2941.1
C13-DS-amylased +16hr+1hrmix,0,Overnight,2094.8,1529.5,2660.1
C13-pptspn-final avg,0,Overnight,405.8,369.2,442.4`;

    els.pasteArea.value = example;
    logMsg("Example loaded. Click Parse data.", "ok");
  }

  function clearAll() {
    state.headers = [];
    state.rows = [];
    state.replicateCols = [];
    state.computed = [];
    state.lastFigure = null;

    els.pasteArea.value = "";
    els.fileInput.value = "";

    els.replicateList.innerHTML = "";
    els.colId.innerHTML = "";
    els.colTime.innerHTML = "";
    els.colCondition.innerHTML = "";
    els.colValue.innerHTML = "";
    els.colError.innerHTML = "";
    els.colN.innerHTML = "";

    fillMultiSelect(els.filterIds, []);
    fillMultiSelect(els.filterConditions, []);
    els.filterConditions.disabled = true;

    els.previewHead.innerHTML = "";
    els.previewBody.innerHTML = "";

    if (window.Plotly) Plotly.purge(els.chart);
    setEmptyChart(true);

    clearMsgs();
    logMsg("Cleared. Ready to start fresh.", "ok");
    updateButtons();
    
    // Enhanced v0.3: Reset workflow
    state.workflowStep = 1;
    updateWorkflowProgress(1);
    showDataPreview(); // Will hide preview since no data
    updateButtonTooltips();
  }

  function updateButtons() {
    const hasData = state.rows.length > 0 && state.headers.length > 0;
    const hasComputed = state.computed.length > 0;

    let canCompute = hasData;

    if (hasData && state.statsMode === "replicates") {
      canCompute = canCompute && (state.replicateCols.length > 0 || getChosenReplicatesFromUI(state.headers).length > 0);
    }
    if (hasData && state.statsMode === "summary") {
      canCompute = canCompute && !!state.colValue;
    }

    els.btnCompute.disabled = !canCompute;
    els.btnRender.disabled = !hasComputed;
    els.btnResetView.disabled = !hasComputed;

    els.btnDownloadProcessed.disabled = !hasComputed;

    const hasFigure = !!state.lastFigure;
    els.btnExportSvg.disabled = !hasFigure;
    els.btnExportPng.disabled = !hasFigure;

    els.btnExportTableHtml.disabled = !hasComputed;
    els.btnExportTablePng.disabled = !hasComputed;
    els.btnExportTablePdf.disabled = !hasComputed;
  }

  function setEmptyChart(isEmpty) {
    els.emptyState.style.display = isEmpty ? "grid" : "none";
  }

  function clearMsgs() { els.messages.innerHTML = ""; }

  function logMsg(text, kind) {
    const div = document.createElement("div");
    div.className = `msg msg_${kind || "ok"}`;
    div.textContent = text;
    els.messages.appendChild(div);
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
    const fb = headers.find(h => h.toLowerCase().trim() === fallback.toLowerCase());
    return fb || "";
  }

  function isReplicateHeader(h) {
    const s = String(h || "").trim().toLowerCase();
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
    if (n === null || n === undefined || !Number.isFinite(n)) return "";
    const abs = Math.abs(n);
    if (abs >= 1000 || (abs > 0 && abs < 0.001)) return n.toExponential(3);
    return Number(n.toFixed(6)).toString();
  }

  function formatNum(n, decimals) {
    if (n === null || n === undefined || !Number.isFinite(n)) return "";
    return Number(n.toFixed(decimals)).toString();
  }

  function makeSafeFilename(name) {
    const base = safeString(name).trim() || "figure";
    return base.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 60) || "figure";
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadUrl(filename, url);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
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
    if (/[,"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }

  function parseDelimited(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim().length);
    if (lines.length < 2) throw new Error("Need a header row and at least one data row.");

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
      headers.forEach((h, idx) => { rowObj[h] = cells[idx] !== undefined ? cells[idx] : ""; });
      rows.push(rowObj);
    }

    return { headers, rows };
  }

  function parseLine(line, delimiter) {
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

  function ardaThemeTokens() {
    return {
      paperBg: "#EAE8DC",
      plotBg: "rgba(255,255,255,0.0)",
      fg: "#1B1B1D",
      grid: "rgba(27,27,29,0.12)",
      axis: "rgba(27,27,29,0.35)"
    };
  }

  window.addEventListener("DOMContentLoaded", () => {
    init();
  });

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => {
  if (!window.Plotly) {
    const msg = document.getElementById("messages");
    msg.textContent = "Plotly did not load. Confirm libs/plotly.min.js exists.";
    return;
  }
  App.init();
});

  // Enhanced UX functions for v0.3.0
  
  function showHelpModal() {
    if (els.helpModal) {
      els.helpModal.style.display = "grid";
      document.body.style.overflow = "hidden";
    }
  }

  function hideHelpModal() {
    if (els.helpModal) {
      els.helpModal.style.display = "none";
      document.body.style.overflow = "";
    }
  }

  function togglePanel(panel) {
    panel.classList.toggle("panel_collapsed");
  }

  function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      if (state.mode === "grid") {
        const inGrid = document.activeElement.closest(".gridMount");
        if (inGrid && state.gridApi) {
          e.preventDefault();
          state.gridApi.undo();
        }
      }
    }
    
    // Ctrl/Cmd + Y or Shift+Z for redo
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      if (state.mode === "grid") {
        const inGrid = document.activeElement.closest(".gridMount");
        if (inGrid && state.gridApi) {
          e.preventDefault();
          state.gridApi.redo();
        }
      }
    }
    
    // ESC to close modals
    if (e.key === "Escape") {
      if (els.helpModal && els.helpModal.style.display !== "none") {
        hideHelpModal();
      }
    }
  }

  function updateWorkflowProgress(step) {
    state.workflowStep = Math.max(state.workflowStep, step);
    
    const steps = document.querySelectorAll(".workflow_step");
    steps.forEach((stepEl, idx) => {
      const stepNum = idx + 1;
      
      if (stepNum < state.workflowStep) {
        stepEl.setAttribute("data-completed", "true");
        stepEl.setAttribute("data-active", "false");
      } else if (stepNum === state.workflowStep) {
        stepEl.setAttribute("data-completed", "false");
        stepEl.setAttribute("data-active", "true");
      } else {
        stepEl.setAttribute("data-completed", "false");
        stepEl.setAttribute("data-active", "false");
      }
    });
  }

  function showDataPreview() {
    if (!els.dataPreview || !els.dataStats) return;
    
    const rowCount = state.rows.length;
    const colCount = state.headers.length;
    
    if (rowCount > 0 && colCount > 0) {
      els.dataStats.textContent = `${rowCount} rows × ${colCount} columns`;
      els.dataPreview.style.display = "block";
    } else {
      els.dataPreview.style.display = "none";
    }
  }

  function updateButtonTooltips() {
    if (els.btnCompute) {
      if (els.btnCompute.disabled) {
        els.btnCompute.title = state.headers.length === 0 
          ? "Load data first" 
          : "Configure columns to enable";
      } else {
        els.btnCompute.title = "Compute statistics (Ctrl+Enter)";
      }
    }
    
    if (els.btnRender) {
      if (els.btnRender.disabled) {
        els.btnRender.title = state.computed.length === 0 
          ? "Compute data first" 
          : "Configure chart settings";
      } else {
        els.btnRender.title = "Render chart";
      }
    }
  }

    msg.textContent = "Plotly did not load. Confirm libs/plotly.min.js exists.";
    return;
  }
  App.init();
});
