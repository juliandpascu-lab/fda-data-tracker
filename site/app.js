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

  function renderTickerStrip() {
    const target = $("#ticker-strip");
    if (!target) return;
    target.innerHTML = latestRows().map((row) => `<div class="ticker-chip"><strong>${esc(row.item_id.toUpperCase())}</strong><small>$${number(row.close_usd)}</small><span class="${changeClass(row.change_pct)}">${pct(row.change_pct)}</span></div>`).join("") || '<span class="ticker-loading">No latest quotes are available.</span>';
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
    target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Average daily market move over time"><line x1="${pad.left}" x2="${width - pad.right}" y1="${zeroY}" y2="${zeroY}" stroke="rgba(157,183,220,.32)" stroke-dasharray="4 5"/><path d="${area}" fill="rgba(79,224,161,.12)"/><path d="${line}" fill="none" stroke="#4fe0a1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${points}${labels}<text x="${pad.left - 7}" y="${pad.top + 4}" fill="#647692" font-size="10" text-anchor="end">${max.toFixed(2)}%</text><text x="${pad.left - 7}" y="${height - pad.bottom + 4}" fill="#647692" font-size="10" text-anchor="end">${min.toFixed(2)}%</text></svg>`;
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
    $("#days-with-success").textContent = integer(status.days_with_success);
    $("#item-count").textContent = integer(status.items);
    $("#new-count").textContent = integer(status.new_today);
    $("#gone-count").textContent = integer(status.gone_today);
    $("#source-count").textContent = `${sourceRows().filter((source) => source.ok).length}/${sourceRows().length || 0}`;
    renderSources();
    renderTickerStrip();
    renderMarketPulse();
    const rows = latestRows();
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
      table.innerHTML = filtered.map((row) => `<tr><td><button class="star ${shortlist.has(row.item_id) ? "on" : ""}" data-star="${esc(row.item_id)}" aria-label="${shortlist.has(row.item_id) ? "Remove" : "Add"} ${esc(row.item)} ${shortlist.has(row.item_id) ? "from" : "to"} shortlist">${shortlist.has(row.item_id) ? "★" : "☆"}</button></td><td class="item-cell"><strong>${esc(row.item)}</strong><small>${esc(row.item_id)} · ${esc(row.category)}</small></td><td>$${number(row.close_usd)}</td><td class="${changeClass(row.change_pct)}">${pct(row.change_pct)}</td><td>${integer(row.volume)}</td><td>${esc(row.date)}</td></tr>`).join("") || '<tr><td class="empty" colspan="6">No items match these filters.</td></tr>';
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
      document.documentElement.dataset.loaded = "true";
    } catch (error) {
      document.querySelectorAll("[data-error]").forEach((element) => { element.textContent = error.message; });
    }
  }

  window.trackerState = state;
  window.dataTrackerReady = init();
})();
