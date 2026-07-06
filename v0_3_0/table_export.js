/* table_export.js
   Exports processed data as:
   HTML file with embedded styles
   PNG using html-to-image
   PDF via print view (browser Save as PDF)
*/

window.TableExport = (() => {
  function buildTableHtml(opts) {
    const title = escapeHtml(opts.title || "");
    const caption = escapeHtml(opts.caption || "");
    const meta = escapeHtml(opts.meta || "");
    const css = exportCss();

    const thead = `<thead><tr>${opts.columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${opts.rows.map(r => `<tr>${r.map(v => `<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title || "Table export"}</title>
<style>${css}</style>
</head>
<body>
  <div class="wrap">
    ${title ? `<div class="tTitle">${title}</div>` : ``}
    ${caption ? `<div class="tCaption">${caption}</div>` : ``}
    ${meta ? `<div class="tMeta">${meta}</div>` : ``}
    <div class="tBox">
      <table>
        ${thead}
        ${tbody}
      </table>
    </div>
  </div>
</body>
</html>`;
  }

  function exportHtmlFile(filename, html) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadUrl(filename, url);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function exportPngFromHtml(html, filename, scale) {
    const frame = document.createElement("div");
    frame.style.position = "fixed";
    frame.style.left = "-99999px";
    frame.style.top = "0";
    frame.style.width = "1100px";
    frame.style.background = "#ffffff";
    frame.innerHTML = html;

    document.body.appendChild(frame);

    const wrap = frame.querySelector(".wrap") || frame;
    const dataUrl = await window.htmlToImage.toPng(wrap, { pixelRatio: scale || 2 });

    document.body.removeChild(frame);
    downloadDataUrl(filename, dataUrl);
  }

  function exportPdfPrintView(html) {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;

    w.document.open();
    w.document.write(html);
    w.document.close();

    w.focus();
    setTimeout(() => w.print(), 200);
  }

  function exportCss() {
    return `
      body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#111;background:#fff}
      .wrap{padding:28px;max-width:1100px;margin:0 auto}
      .tTitle{font-weight:800;font-size:20px;margin-bottom:6px}
      .tCaption{font-size:12px;color:#444;margin-bottom:10px;line-height:1.35}
      .tMeta{font-size:11px;color:#666;margin-bottom:14px}
      .tBox{border:1px solid rgba(0,0,0,0.18);border-radius:10px;overflow:hidden}
      table{width:100%;border-collapse:collapse;font-size:12px}
      thead th{background:#f6f6f6;text-align:left;padding:10px;border-bottom:1px solid rgba(0,0,0,0.15);font-weight:800}
      tbody td{padding:9px 10px;border-bottom:1px solid rgba(0,0,0,0.08);white-space:nowrap}
      tbody tr:last-child td{border-bottom:none}
      @media print{
        body{background:#fff}
        .wrap{padding:0}
      }
    `;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function downloadUrl(filename, url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadDataUrl(filename, dataUrl) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return { buildTableHtml, exportHtmlFile, exportPngFromHtml, exportPdfPrintView };
})();
