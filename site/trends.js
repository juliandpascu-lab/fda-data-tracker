(() => {
  const colors = ["#4fe0a1", "#66a9ff", "#f5c66d", "#ff7f8e", "#b99cff", "#58d4e8", "#f29a67", "#c1e77d", "#e58ad2", "#a9b9d3"];
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);
  const n = (value) => Number(value);
  const fmt = (value, field) => field === "volume" ? n(value).toLocaleString(undefined, { maximumFractionDigits: 0 }) : n(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const rowsByItem = (rows) => Object.groupBy ? Object.groupBy(rows, (row) => row.item_id) : rows.reduce((groups, row) => ((groups[row.item_id] ||= []).push(row), groups), {});

  function emptyChart(target, text = "Not enough history for this chart yet.") { target.innerHTML = `<div class="chart-empty">${esc(text)}</div>`; }

  function lineChart(target, series, field) {
    if (!series.length || !series.some((line) => line.values.length)) { emptyChart(target); return; }
    const width = 780, height = 180, pad = { left: 42, right: 16, top: 12, bottom: 28 };
    const points = series.flatMap((line) => line.values.map((point) => point.value));
    let min = Math.min(...points), max = Math.max(...points);
    if (min === max) { min -= 1; max += 1; }
    const x = (index, length) => pad.left + (index / Math.max(1, length - 1)) * (width - pad.left - pad.right);
    const y = (value) => pad.top + ((max - value) / (max - min)) * (height - pad.top - pad.bottom);
    const lines = series.map((line, lineIndex) => {
      const path = line.values.map((point, index) => `${index ? "L" : "M"}${x(index, line.values.length).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
      return `<path d="${path}" fill="none" stroke="${colors[lineIndex % colors.length]}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(line.values.length - 1, line.values.length).toFixed(1)}" cy="${y(line.values.at(-1).value).toFixed(1)}" r="3.5" fill="${colors[lineIndex % colors.length]}"/>`;
    }).join("");
    const legend = series.map((line, index) => `<span style="color:${colors[index % colors.length]};margin-right:12px">● ${esc(line.name)} <small>${fmt(line.values.at(-1).value, field)}</small></span>`).join("");
    target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(field)} over time"><line x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}" stroke="rgba(157,183,220,.24)"/><line x1="${pad.left}" x2="${pad.left}" y1="${pad.top}" y2="${height - pad.bottom}" stroke="rgba(157,183,220,.24)"/><text x="${pad.left}" y="${height - 7}" fill="#647692" font-size="10">${esc(series[0].values[0].date)}</text><text x="${width - pad.right}" y="${height - 7}" text-anchor="end" fill="#647692" font-size="10">${esc(series[0].values.at(-1).date)}</text><text x="${pad.left - 5}" y="${pad.top + 4}" text-anchor="end" fill="#647692" font-size="10">${fmt(max, field)}</text><text x="${pad.left - 5}" y="${height - pad.bottom}" text-anchor="end" fill="#647692" font-size="10">${fmt(min, field)}</text>${lines}</svg><div class="muted" style="font-size:.7rem;line-height:1.9">${legend}</div>`;
  }

  function barChart(target, entries, color = "#4fe0a1", suffix = "") {
    if (!entries.length) { emptyChart(target); return; }
    const max = Math.max(...entries.map((entry) => Math.abs(entry.value)), 1);
    target.innerHTML = `<div style="display:grid;gap:9px">${entries.map((entry) => `<div style="display:grid;grid-template-columns:minmax(100px,1fr) 2fr 70px;align-items:center;gap:10px;font-size:.74rem"><span class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(entry.name)}</span><span style="height:8px;border-radius:999px;background:rgba(157,183,220,.12);overflow:hidden"><i style="display:block;width:${Math.max(2, Math.abs(entry.value) / max * 100)}%;height:100%;background:${entry.value < 0 ? "#ff7f8e" : color};border-radius:inherit"></i></span><span style="text-align:right;color:${entry.value < 0 ? "#ff7f8e" : "#4fe0a1"}">${entry.value >= 0 ? "+" : ""}${fmt(entry.value, "close_usd")}${suffix}</span></div>`).join("")}</div>`;
  }

  function setup(state) {
    const rows = state.rows;
    const groups = rowsByItem(rows);
    const items = Object.values(groups).map((itemRows) => itemRows[0]).sort((a, b) => a.item.localeCompare(b.item));
    const checks = $("#trend-items");
    checks.innerHTML = items.map((item, index) => `<label><input type="checkbox" value="${esc(item.item_id)}" ${index < 5 ? "checked" : ""}>${esc(item.item)}</label>`).join("");
    const selected = () => new Set([...checks.querySelectorAll("input:checked")].map((input) => input.value));
    const drawTrend = () => {
      const field = $("#trend-field").value;
      const series = items.filter((item) => selected().has(item.item_id)).map((item) => ({ name: item.item, values: (groups[item.item_id] || []).filter((row) => row[field] !== "").map((row) => ({ date: row.date, value: n(row[field]) })) }));
      lineChart($("#trend-chart"), series, field);
    };
    checks.addEventListener("change", drawTrend);
    $("#trend-field").addEventListener("change", drawTrend);
    drawTrend();

    const latestDate = state.latestDate;
    const latestRows = rows.filter((row) => row.date === latestDate);
    const latestMoves = latestRows.filter((row) => row.change_pct !== "").map((row) => ({ name: row.item, value: n(row.change_pct) })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 6);
    const topMove = latestMoves[0];
    $("#finding-one-title").textContent = topMove ? `${topMove.name} is the sharpest latest move` : "Latest moves are not available yet";
    $("#finding-one-text").textContent = topMove ? `The current snapshot ranks items by the absolute value of daily percentage change. ${topMove.name} moved ${topMove.value >= 0 ? "up" : "down"} ${Math.abs(topMove.value).toFixed(2)}% in the source response.` : "The first snapshot needs a prior observation before a percentage move can be calculated.";
    barChart($("#finding-one-chart"), latestMoves);

    const returns = items.map((item) => { const history = (groups[item.item_id] || []).filter((row) => row.close_usd !== ""); const first = n(history[0]?.close_usd), last = n(history.at(-1)?.close_usd); return { name: item.item, value: history.length > 1 && first ? (last / first - 1) * 100 : 0 }; }).sort((a, b) => b.value - a.value);
    const best = returns[0];
    $("#finding-two-title").textContent = best ? `${best.name} leads the full-history return` : "Full-history return is not available yet";
    $("#finding-two-text").textContent = best ? `This is calculated as (latest close ÷ first recorded close − 1) × 100. Across the rows currently stored, ${best.name} has the strongest change at ${best.value >= 0 ? "+" : ""}${best.value.toFixed(2)}%.` : "More than one observation is needed for a return calculation.";
    barChart($("#finding-two-chart"), returns.slice(0, 6), "#66a9ff", "%");

    const ranges = items.map((item) => { const values = (groups[item.item_id] || []).map((row) => n(row.close_usd)).filter(Number.isFinite); return { name: item.item, value: values.length ? Math.max(...values) - Math.min(...values) : 0 }; }).sort((a, b) => b.value - a.value);
    const widest = ranges[0];
    $("#finding-three-title").textContent = widest ? `${widest.name} has the widest close range` : "Close ranges are not available yet";
    $("#finding-three-text").textContent = widest ? `Range is the maximum recorded close minus the minimum recorded close in the history file. ${widest.name} spans ${widest.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} price units across its observations.` : "The history file has not accumulated enough values for a range.";
    barChart($("#finding-three-chart"), ranges.slice(0, 6), "#f5c66d");

    const activity = items.map((item) => { const values = (groups[item.item_id] || []).map((row) => n(row.volume)).filter(Number.isFinite); return { name: item.item, value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }; }).sort((a, b) => b.value - a.value);
    const active = activity[0];
    $("#finding-four-title").textContent = active ? `${active.name} has the highest average volume` : "Average volume is not available yet";
    $("#finding-four-text").textContent = active ? `Average volume is the arithmetic mean of each recorded volume value for an item. ${active.name} currently leads at ${active.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} reported units per observation.` : "The sources have not reported volume values yet.";
    barChart($("#finding-four-chart"), activity.slice(0, 6), "#b99cff");
  }

  if (window.dataTrackerReady) window.dataTrackerReady.then(setup).catch(() => {});
})();
