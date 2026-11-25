(() => {
  const SHORTLIST_KEY = "fda-data-tracker-shortlist";
  const state = { rows: [], status: {}, latestDate: "", previousDate: "" };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]);
  const number = (value, digits = 2) => value === "" || value === null || value === undefined || Number.isNaN(Number(value)) ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const integer = (value) => value === "" || value === null || value === undefined || Number.isNaN(Number(value)) ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const pct = (value) => value === "" || value === null || value === undefined || Number.isNaN(Number(value)) ? "—" : `${Number(value) >= 0 ? "+" : ""}${number(value)}%`;
  const changeClass = (value) => value === "" || value === null || value === undefined ? "neutral" : Number(value) >= 0 ? "positive" : "negative";
  const labelize = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const centralFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23" });

  function parseCSV(text) {
    const records = [];
    let record = [], field = "", quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (char === "," && !quoted) { record.push(field); field = ""; continue; }
      if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[index + 1] === "\n") index += 1;
        record.push(field); field = "";
        if (record.some((cell) => cell !== "")) records.push(record);
        record = [];
        continue;
      }
      field += char;
    }
    if (field || record.length) { record.push(field); if (record.some((cell) => cell !== "")) records.push(record); }
    if (!records.length) return [];
    const headers = records.shift();
    return records.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  }

  function latest(rows) {
    return rows.length ? rows.reduce((max, row) => row.date > max ? row.date : max, rows[0].date) : "";
  }

  function previous(rows, latestDate) {
    return [...new Set(rows.map((row) => row.date).filter((date) => date < latestDate))].sort().pop() || "";
  }

  function readShortlist() {
    try { return new Set(JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]")); } catch { return new Set(); }
  }

  function saveShortlist(shortlist) { localStorage.setItem(SHORTLIST_KEY, JSON.stringify([...shortlist])); }

  async function loadData() {
    const [historyResponse, statusResponse] = await Promise.all([
      fetch("data/history.csv", { cache: "no-store" }),
      fetch("data/status.json", { cache: "no-store" }),
    ]);
    if (!historyResponse.ok || !statusResponse.ok) throw new Error("Tracker data is not available yet.");
    state.rows = parseCSV(await historyResponse.text());
    state.status = await statusResponse.json();
    state.latestDate = latest(state.rows);
    state.previousDate = previous(state.rows, state.latestDate);
    return state;
  }

  function latestRows() { return state.rows.filter((row) => row.date === state.latestDate); }
  function sourceRows() { return state.status.sources || []; }

  function centralParts(date) {
    return Object.fromEntries(centralFormatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  }

  function centralDateToUTC(year, month, day, hour, minute) {
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    const guess = new Date(desired);
    const parts = centralParts(guess);
    const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    return new Date(desired + (desired - observed));
  }

  function nextRefresh() {
    const now = new Date();
    const current = centralParts(now);
    const base = Date.UTC(Number(current.year), Number(current.month) - 1, Number(current.day));
    const candidates = [];
    for (let offset = 0; offset < 3; offset += 1) {
      const day = new Date(base + offset * 86400000);
      const year = day.getUTCFullYear(); const month = day.getUTCMonth() + 1; const date = day.getUTCDate();
      for (const [hour, minute, label] of [[8, 30, "Open"], [15, 0, "Close"]]) {
        const candidate = centralDateToUTC(year, month, date, hour, minute);
        if (candidate > now) candidates.push({ candidate, label });
      }
    }
    const next = candidates.sort((a, b) => a.candidate - b.candidate)[0];
    if (!next) return "—";
    const diff = Math.max(0, next.candidate - now);
    const hours = Math.floor(diff / 3600000); const minutes = Math.floor((diff % 3600000) / 60000);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).formatToParts(next.candidate);
    const formatted = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${next.label} · ${formatted.weekday} ${formatted.month} ${formatted.day}, ${formatted.hour}:${formatted.minute} ${formatted.dayPeriod} CT · ${hours}h ${minutes}m`;
  }

  function renderNextRefresh() {
    const target = $("#next-refresh");
    if (target) target.textContent = nextRefresh();
  }

  function miniSparkline(itemId) {
    const points = state.rows.filter((row) => row.item_id === itemId && row.close_usd !== "").map((row) => Number(row.close_usd)).filter(Number.isFinite);
    if (!points.length) return "";
    const width = 116, height = 28, pad = 3;
    let min = Math.min(...points), max = Math.max(...points);
    if (min === max) { min -= 1; max += 1; }
    const x = (index) => pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
    const y = (value) => pad + ((max - value) / (max - min)) * (height - pad * 2);
    const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point).toFixed(1)}`).join(" ");
    return `<svg class="mini-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(itemId)} close history"><path d="${path}"/><circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(points.at(-1)).toFixed(1)}" r="2.5"/></svg>`;
  }

  function renderTickerStrip() {
    const target = $("#ticker-strip");
    if (!target) return;
    target.innerHTML = latestRows().map((row) => `<div class="ticker-chip"><strong>${esc(row.item_id.toUpperCase())}</strong><small>$${number(row.close_usd)}</small><span class="${changeClass(row.change_pct)}">${pct(row.change_pct)}</span></div>`).join("") || '<span class="ticker-loading">No latest quotes are available.</span>';
  }

  function renderBreadth(rows) {
    const values = rows.filter((row) => row.change_pct !== "").map((row) => ({ ...row, move: Number(row.change_pct) }));
    const up = values.filter((row) => row.move > 0).length;
    const down = values.filter((row) => row.move < 0).length;
    const average = values.length ? values.reduce((sum, row) => sum + row.move, 0) / values.length : 0;
    const strongest = [...values].sort((a, b) => b.move - a.move)[0];
    const weakest = [...values].sort((a, b) => a.move - b.move)[0];
    const ratio = $("#breadth-ratio"); const bar = $("#breadth-bar"); const detail = $("#breadth-detail");
    if (ratio) ratio.textContent = `${up} up · ${down} down`;
    if (bar) { bar.style.width = values.length ? `${up / values.length * 100}%` : "0%"; bar.className = up >= down ? "positive" : "negative"; }
    if (detail) detail.textContent = `${values.length - up - down} unchanged or missing`;
    const strongestTarget = $("#strongest-item"); const strongestDetail = $("#strongest-detail");
    if (strongestTarget) strongestTarget.textContent = strongest ? strongest.item : "—";
    if (strongestDetail) strongestDetail.textContent = strongest ? pct(strongest.move) : "—";
    const weakestTarget = $("#weakest-item"); const weakestDetail = $("#weakest-detail");
    if (weakestTarget) weakestTarget.textContent = weakest ? weakest.item : "—";
    if (weakestDetail) weakestDetail.textContent = weakest ? pct(weakest.move) : "—";
    const averageTarget = $("#average-move");
    if (averageTarget) { averageTarget.textContent = pct(average); averageTarget.className = changeClass(average); }
  }

  function renderHeatmap(rows) {
    const target = $("#market-heatmap");
    if (!target) return;
    const values = rows.filter((row) => row.change_pct !== "").map((row) => ({ ...row, move: Number(row.change_pct) }));
    const maximum = Math.max(...values.map((row) => Math.abs(row.move)), 1);
    target.innerHTML = values.map((row) => `<div class="heat-cell ${changeClass(row.move)}" style="--heat:${Math.max(.16, Math.abs(row.move) / maximum * .8)}"><strong>${esc(row.item_id.toUpperCase())}</strong><span>${pct(row.move)}</span><small>$${number(row.close_usd)}</small></div>`).join("") || '<div class="empty">No movement data is available yet.</div>';
  }

  function renderQuality(rows) {
    const target = $("#data-quality");
    if (!target) return;
    let complete = 0;
    target.innerHTML = rows.map((row) => {
      const missing = ["close_usd", "change_pct", "volume"].filter((field) => row[field] === "" || row[field] === null || row[field] === undefined);
      if (!missing.length) complete += 1;
      return `<div class="quality-row"><div><strong>${esc(row.item)}</strong><small>${esc(row.source)} · ${esc(row.date)}</small></div><span class="quality-state ${missing.length ? "bad" : "good"}">${missing.length ? `Missing ${missing.join(", ")}` : "Complete"}</span></div>`;
    }).join("") || '<div class="empty">No rows are available for quality checks.</div>';
    const summary = $("#data-quality-summary"); const pill = $("#quality-pill");
    if (summary) summary.textContent = `${complete} of ${rows.length} latest rows contain close, change, and volume values.`;
    if (pill) { pill.textContent = rows.length && complete === rows.length ? "All complete" : `${complete}/${rows.length} complete`; pill.className = `status-pill ${complete === rows.length ? "" : "bad"}`; }
  }

  function renderMarketPulse() {
    const target = $("#market-pulse-chart");
    if (!target) return;
    const dates = [...new Set(state.rows.map((row) => row.date))].sort();
    const pulse = dates.map((date) => {
      const rows = state.rows.filter((row) => row.date === date && row.change_pct !== "");
      const values = rows.map((row) => Number(row.change_pct));
      return { date, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0, up: values.filter((value) => value > 0).length, down: values.filter((value) => value < 0).length };
    });
    if (!pulse.length) { target.innerHTML = '<div class="chart-empty">No history is available yet.</div>'; return; }
    const width = 920, height = 205, pad = { left: 44, right: 20, top: 18, bottom: 32 };
    const values = pulse.map((point) => point.average);
    let min = Math.min(...values, 0), max = Math.max(...values, 0);
    if (min === max) { min -= 1; max += 1; }
    const x = (index) => pad.left + (index / Math.max(1, pulse.length - 1)) * (width - pad.left - pad.right);
    const y = (value) => pad.top + ((max - value) / (max - min)) * (height - pad.top - pad.bottom);
    const line = pulse.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.average).toFixed(1)}`).join(" ");
    const area = `${line} L${x(pulse.length - 1).toFixed(1)},${height - pad.bottom} L${x(0).toFixed(1)},${height - pad.bottom} Z`;
    const zeroY = y(0);
    const points = pulse.map((point, index) => `<circle cx="${x(index).toFixed(1)}" cy="${y(point.average).toFixed(1)}" r="${index === pulse.length - 1 ? 5 : 3}" fill="${point.average >= 0 ? "#4fe0a1" : "#ff7f8e"}" stroke="#07111f" stroke-width="2"/>`).join("");
    const labels = pulse.length === 1 ? `<text x="${x(0)}" y="${height - 9}" fill="#647692" font-size="10" text-anchor="middle">${esc(pulse[0].date)}</text>` : `<text x="${x(0)}" y="${height - 9}" fill="#647692" font-size="10">${esc(pulse[0].date)}</text><text x="${x(pulse.length - 1)}" y="${height - 9}" fill="#647692" font-size="10" text-anchor="end">${esc(pulse.at(-1).date)}</text>`;
    const currentRows = latestRows().filter((row) => row.change_pct !== "").sort((a, b) => Math.abs(Number(b.change_pct)) - Math.abs(Number(a.change_pct)));
    const maxMove = Math.max(...currentRows.map((row) => Math.abs(Number(row.change_pct))), 1);
    const bars = currentRows.map((row) => { const move = Number(row.change_pct); const height = Math.max(8, Math.abs(move) / maxMove * 100); return `<div class="pulse-bar"><div class="pulse-bar-value ${changeClass(move)}">${pct(move)}</div><div class="pulse-bar-track"><i class="${changeClass(move)}" style="height:${height}%"></i></div><small>${esc(row.item_id.toUpperCase())}</small></div>`; }).join("");
    target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Average daily market move over time"><line x1="${pad.left}" x2="${width - pad.right}" y1="${zeroY}" y2="${zeroY}" stroke="rgba(157,183,220,.32)" stroke-dasharray="4 5"/><path d="${area}" fill="rgba(79,224,161,.12)"/><path d="${line}" fill="none" stroke="#4fe0a1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${points}${labels}<text x="${pad.left - 7}" y="${pad.top + 4}" fill="#647692" font-size="10" text-anchor="end">${max.toFixed(2)}%</text><text x="${pad.left - 7}" y="${height - pad.bottom + 4}" fill="#647692" font-size="10" text-anchor="end">${min.toFixed(2)}%</text></svg><div class="pulse-bars" aria-label="Current item movement bars">${bars}</div>`;
    const latest = pulse.at(-1);
    const breadth = $("#pulse-breadth");
    const average = $("#pulse-average");
    if (breadth) { breadth.textContent = `${latest.up} up / ${latest.down} down`; breadth.className = latest.up >= latest.down ? "positive" : "negative"; }
    if (average) { average.textContent = `Average ${pct(latest.average)}`; average.className = changeClass(latest.average); }
    const caption = $("#market-pulse-caption");
    if (caption) caption.textContent = `Average daily percentage move across ${latest.up + latest.down} tracked items · ${latest.date}`;
  }

  function renderSources() {
    const target = $("#source-list");
    if (!target) return;
    target.innerHTML = sourceRows().map((source) => `<div class="source-row"><div class="source-name">${esc(labelize(source.name))}<small>${source.ok ? `${integer(source.count)} item${Number(source.count) === 1 ? "" : "s"} received` : esc(source.error || "Collection failed")}</small></div><span class="status-pill ${source.ok ? "" : "bad"}">${source.ok ? "Healthy" : "Failed"}</span></div>`).join("") || '<div class="empty">No source results recorded.</div>';
  }

  function renderToday() {
    if (!$("#latest-values")) return;
    const status = state.status;
    $("#last-run").textContent = status.run_time || "Not run yet";
    $("#run-date").textContent = state.latestDate || "Awaiting first collection";
    $("#run-window").textContent = labelize(status.run_window || "manual");
    $("#days-with-success").textContent = integer(status.days_with_success);
    $("#item-count").textContent = integer(status.items);
    $("#new-count").textContent = integer(status.new_today);
    $("#gone-count").textContent = integer(status.gone_today);
    $("#source-count").textContent = `${sourceRows().filter((source) => source.ok).length}/${sourceRows().length || 0}`;
    $("#freshness-time").textContent = status.run_time || "—";
    $("#freshness-window").textContent = labelize(status.run_window || "manual");
    $("#freshness-health").textContent = `${sourceRows().filter((source) => source.ok).length}/${sourceRows().length || 0} healthy`;
    renderSources();
    renderTickerStrip();
    renderMarketPulse();
    const rows = latestRows();
    renderBreadth(rows);
    renderHeatmap(rows);
    renderQuality(rows);
    $("#latest-values").innerHTML = rows.map((row) => `<tr><td class="item-cell"><strong>${esc(row.item)}</strong><small>${esc(row.category)} · ${esc(row.item_id)}</small></td><td>${esc(row.source)}</td><td class="big-number">$${number(row.close_usd)}</td><td class="${changeClass(row.change_pct)} big-number">${pct(row.change_pct)}</td><td>${integer(row.volume)}</td></tr>`).join("") || '<tr><td class="empty" colspan="5">No market snapshot loaded yet.</td></tr>';
    const moves = [...rows].filter((row) => row.change_pct !== "").sort((a, b) => Math.abs(Number(b.change_pct)) - Math.abs(Number(a.change_pct))).slice(0, 5);
    $("#biggest-moves").innerHTML = moves.map((row) => `<div class="move"><div><strong>${esc(row.item)}</strong><small>$${number(row.close_usd)} current close</small></div><div class="move-value ${changeClass(row.change_pct)}">${pct(row.change_pct)}</div></div>`).join("") || '<div class="empty">No moves are available yet.</div>';
  }

  function renderBrowse() {
    const table = $("#browse-values");
    if (!table) return;
    const rows = latestRows();
    const category = $("#category-filter");
    const source = $("#source-filter");
    const search = $("#item-search");
    const sort = $("#sort-filter");
    const categories = [...new Set(rows.map((row) => row.category))].sort();
    const sources = [...new Set(rows.map((row) => row.source))].sort();
    category.innerHTML = '<option value="">All categories</option>' + categories.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join("");
    source.innerHTML = '<option value="">All sources</option>' + sources.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join("");

    const render = () => {
      const shortlist = readShortlist();
      let filtered = rows.filter((row) => (!category.value || row.category === category.value) && (!source.value || row.source === source.value) && (!search.value || row.item.toLowerCase().includes(search.value.toLowerCase())));
      const [field, direction] = sort.value.split(":");
      filtered.sort((a, b) => {
        if (field === "item") return a.item.localeCompare(b.item) * (direction === "desc" ? -1 : 1);
        const aValue = Number(a[field]); const bValue = Number(b[field]);
        return ((Number.isNaN(aValue) ? -Infinity : aValue) - (Number.isNaN(bValue) ? -Infinity : bValue)) * (direction === "desc" ? -1 : 1);
      });
      $("#browse-count").textContent = `${filtered.length} of ${rows.length} latest items`;
      table.innerHTML = filtered.map((row) => `<tr><td><button class="star ${shortlist.has(row.item_id) ? "on" : ""}" data-star="${esc(row.item_id)}" aria-label="${shortlist.has(row.item_id) ? "Remove" : "Add"} ${esc(row.item)} ${shortlist.has(row.item_id) ? "from" : "to"} shortlist">${shortlist.has(row.item_id) ? "★" : "☆"}</button></td><td class="item-cell"><strong>${esc(row.item)}</strong><small>${esc(row.item_id)} · ${esc(row.category)}</small>${miniSparkline(row.item_id)}</td><td>$${number(row.close_usd)}</td><td class="${changeClass(row.change_pct)}">${pct(row.change_pct)}</td><td>${integer(row.volume)}</td><td>${esc(row.date)}</td></tr>`).join("") || '<tr><td class="empty" colspan="6">No items match these filters.</td></tr>';
      $$("[data-star]").forEach((button) => button.addEventListener("click", () => { const next = readShortlist(); const id = button.dataset.star; next.has(id) ? next.delete(id) : next.add(id); saveShortlist(next); render(); }));
      $("#shortlist-note").textContent = `${shortlist.size} item${shortlist.size === 1 ? "" : "s"} saved in this browser`;
    };
    [category, source, search, sort].forEach((control) => control.addEventListener("input", render));
    render();
  }

  async function init() {
    try {
      await loadData();
      renderToday();
      renderBrowse();
      renderNextRefresh();
      window.setInterval(renderNextRefresh, 30000);
      document.documentElement.dataset.loaded = "true";
    } catch (error) {
      document.querySelectorAll("[data-error]").forEach((element) => { element.textContent = error.message; });
    }
  }

  window.trackerState = state;
  window.dataTrackerReady = init();
})();
