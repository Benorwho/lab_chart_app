/* grid.js
   Lightweight editable grid with:
   selection (row or column)
   paste blocks (tsv or csv)
   add row, add col, add replicate
   delete selected
   undo, redo (snapshots)

   This keeps everything in memory. No storage.
*/

window.Grid = (() => {
  function createGridModel() {
    return {
      headers: ["ID", "Time", "Condition", "rep 1", "rep 2", "rep 3"],
      rows: [
        ["A", "0", "Control", "1.2", "1.1", "1.3"],
        ["A", "1", "Control", "1.8", "1.7", "1.9"],
        ["B", "0", "Treated", "0.9", "1.0", "0.8"]
      ]
    };
  }

  function mountGrid(mountEl, model, onChange) {
    const api = {
      model,
      selected: { kind: "none", index: -1 },
      undoStack: [],
      redoStack: [],
      activeCell: { r: 0, c: 1 }
    };

    function snapshot() {
      api.undoStack.push({
        headers: model.headers.slice(),
        rows: model.rows.map(r => r.slice())
      });
      api.redoStack = [];
    }

    function restoreFrom(snap) {
      model.headers = snap.headers.slice();
      model.rows = snap.rows.map(r => r.slice());
      api.selected = { kind: "none", index: -1 };
    }

    function render() {
      mountEl.innerHTML = "";

      const table = document.createElement("table");
      table.className = "gridTable";

      const thead = document.createElement("thead");
      const trh = document.createElement("tr");

      const corner = document.createElement("th");
      corner.textContent = "";
      corner.title = "Row selector";
      trh.appendChild(corner);

      model.headers.forEach((h, c) => {
        const th = document.createElement("th");
        th.textContent = h;
        th.dataset.col = String(c);

        if (api.selected.kind === "col" && api.selected.index === c) th.classList.add("selHead");

        th.addEventListener("click", () => {
          api.selected = { kind: "col", index: c };
          render();
        });

        trh.appendChild(th);
      });

      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      model.rows.forEach((row, r) => {
        const tr = document.createElement("tr");

        const thRow = document.createElement("td");
        thRow.textContent = String(r + 1);
        thRow.title = "Click to select row";
        if (api.selected.kind === "row" && api.selected.index === r) thRow.classList.add("selHead");

        thRow.addEventListener("click", () => {
          api.selected = { kind: "row", index: r };
          render();
        });

        tr.appendChild(thRow);

        model.headers.forEach((_, c) => {
          const td = document.createElement("td");
          const div = document.createElement("div");
          div.className = "cell";
          div.contentEditable = "true";
          div.spellcheck = false;
          div.dataset.r = String(r);
          div.dataset.c = String(c);
          div.textContent = row[c] ?? "";

          div.addEventListener("focus", () => {
            api.activeCell = { r, c };
          });

          div.addEventListener("input", () => {
            row[c] = div.textContent ?? "";
            markCellValidity(div, c, row[c], model.headers);
            notifyChange();
          });

          div.addEventListener("paste", (ev) => {
            ev.preventDefault();
            const text = (ev.clipboardData || window.clipboardData).getData("text");
            applyPaste(text, api.activeCell.r, api.activeCell.c);
          });

          markCellValidity(div, c, row[c], model.headers);

          td.appendChild(div);
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      mountEl.appendChild(table);
    }

    function notifyChange() {
      if (typeof onChange === "function") onChange(api.model);
    }

    function addRow() {
      snapshot();
      const newRow = new Array(model.headers.length).fill("");
      model.rows.push(newRow);
      render();
      notifyChange();
    }

    function addCol(name) {
      snapshot();
      const n = name || `col ${model.headers.length + 1}`;
      model.headers.push(n);
      model.rows.forEach(r => r.push(""));
      render();
      notifyChange();
    }

    function addReplicate() {
      snapshot();
      const next = nextRepName(model.headers);
      model.headers.push(next);
      model.rows.forEach(r => r.push(""));
      render();
      notifyChange();
    }

    function deleteSelected() {
      if (api.selected.kind === "none") return;

      snapshot();

      if (api.selected.kind === "row" && api.selected.index >= 0) {
        model.rows.splice(api.selected.index, 1);
      }

      if (api.selected.kind === "col" && api.selected.index >= 0) {
        const c = api.selected.index;
        model.headers.splice(c, 1);
        model.rows.forEach(r => r.splice(c, 1));
      }

      api.selected = { kind: "none", index: -1 };
      render();
      notifyChange();
    }

    function undo() {
      const snap = api.undoStack.pop();
      if (!snap) return;

      api.redoStack.push({
        headers: model.headers.slice(),
        rows: model.rows.map(r => r.slice())
      });

      restoreFrom(snap);
      render();
      notifyChange();
    }

    function redo() {
      const snap = api.redoStack.pop();
      if (!snap) return;

      api.undoStack.push({
        headers: model.headers.slice(),
        rows: model.rows.map(r => r.slice())
      });

      restoreFrom(snap);
      render();
      notifyChange();
    }

    function applyPaste(text, startR, startC) {
      if (!text) return;
      snapshot();

      const parsed = parseBlock(text);
      const rowsIn = parsed.rows;
      const colsIn = parsed.maxCols;

      const needRows = startR + rowsIn.length;
      const needCols = startC + colsIn;

      while (model.rows.length < needRows) {
        model.rows.push(new Array(model.headers.length).fill(""));
      }

      while (model.headers.length < needCols) {
        model.headers.push(`col ${model.headers.length + 1}`);
        model.rows.forEach(r => r.push(""));
      }

      rowsIn.forEach((rVals, rr) => {
        rVals.forEach((val, cc) => {
          const r = startR + rr;
          const c = startC + cc;
          model.rows[r][c] = val;
        });
      });

      render();
      notifyChange();
    }

    function parseBlock(text) {
      const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = raw.split("\n").filter(l => l.length > 0);

      const first = lines[0] || "";
      const commaCount = (first.match(/,/g) || []).length;
      const tabCount = (first.match(/\t/g) || []).length;
      const delim = tabCount >= commaCount ? "\t" : ",";

      const rows = lines.map(line => splitLine(line, delim));
      const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);

      return { rows, maxCols };
    }

    function splitLine(line, delim) {
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

        if (!inQuotes && ch === delim) {
          out.push(cur.trim());
          cur = "";
          continue;
        }

        cur += ch;
      }

      out.push(cur.trim());
      return out;
    }

    function nextRepName(headers) {
      const lower = headers.map(h => String(h).toLowerCase().trim());
      let maxN = 0;
      lower.forEach(h => {
        const m = h.match(/^(rep|replicate|iter|iterate|r)\s*[_ ]?\s*(\d+)$/i);
        if (!m) return;
        const n = parseInt(m[2], 10);
        if (Number.isFinite(n)) maxN = Math.max(maxN, n);
      });
      return `rep ${maxN + 1}`;
    }

    function markCellValidity(div, colIndex, value, headers) {
      const header = String(headers[colIndex] || "").toLowerCase().trim();
      const isRep = /^(iterate|iter|replicate|rep|r)\s*[_ ]?\s*\d+$/i.test(header);

      div.classList.remove("cell_bad");

      if (!isRep) return;

      const s = String(value ?? "").trim();
      if (!s) return;

      const n = Number(s);
      if (!Number.isFinite(n)) div.classList.add("cell_bad");
    }

    render();

    return {
      addRow,
      addCol,
      addReplicate,
      deleteSelected,
      undo,
      redo,
      getModel: () => api.model,
      setModel: (m) => {
        api.model.headers = m.headers.slice();
        api.model.rows = m.rows.map(r => r.slice());
        api.selected = { kind: "none", index: -1 };
        api.undoStack = [];
        api.redoStack = [];
        render();
        notifyChange();
      }
    };
  }

  return { createGridModel, mountGrid };
})();
