/* =============================================================================
 * app.js — start page logic
 * Vanilla JS, no dependencies. Each widget is an isolated, fail-soft module:
 * if one data source is down, the rest of the page still works.
 * ===========================================================================*/
(() => {
  "use strict";
  const CFG = window.DASH_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  // ---- helpers -------------------------------------------------------------
  const proxy = (url) =>
    (CFG.corsProxy || "{url}").replace("{url}", encodeURIComponent(url));

  async function getJSON(url, { useProxy = false } = {}) {
    const res = await fetch(useProxy ? proxy(url) : url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function getText(url, { useProxy = false } = {}) {
    const res = await fetch(useProxy ? proxy(url) : url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  const fail = (el, msg) => { el.innerHTML = `<div class="err">${msg}</div>`; };
  const fmtMoney = (n) =>
    n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const relTime = (d) => {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  };

  /* ========================================================================
   * Scene — dynamic background by time of day, tinted by live weather.
   * Sets animatable CSS vars (--scene-1..3, --accent) that the body gradient
   * reads; @property in CSS makes the swap cross-fade.
   * ======================================================================*/
  let lastWeatherCode = null;
  const _hx = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const _hex = (r) => "#" + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = _hx(a), B = _hx(b); return _hex(A.map((v, i) => v + (B[i] - v) * t)); };

  function localHour(date) {
    const h = date.toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: CFG.location?.timezone });
    const n = parseInt(h, 10);
    return isNaN(n) ? date.getHours() : n;
  }

  function sceneFor(date, code) {
    const h = localHour(date);
    // base palette by time of day: [glow, mid, deep], accent
    let s;
    if (h >= 22 || h < 5)      s = { stops: ["#222d4a", "#0d1120", "#05060c"], accent: "#8aa0ff" }; // night
    else if (h < 8)            s = { stops: ["#46314f", "#241a30", "#0e0b18"], accent: "#ff9e7a" }; // dawn
    else if (h < 11)           s = { stops: ["#27506b", "#122a3c", "#08131f"], accent: "#5bb6e6" }; // morning
    else if (h < 16)           s = { stops: ["#2a5160", "#143038", "#0a181d"], accent: "#52c6bb" }; // midday
    else if (h < 19)           s = { stops: ["#6f3c2e", "#3a2320", "#160d0e"], accent: "#ff8a5c" }; // golden hour
    else                       s = { stops: ["#3c2b52", "#1d1730", "#0c0a16"], accent: "#c98bff" }; // dusk

    // weather tint
    const c = code;
    const cloud = [2, 3, 45, 48].includes(c);
    const rain = (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95 && c <= 99);
    const snow = (c >= 71 && c <= 77) || c === 85 || c === 86;
    if (rain) { s.stops = s.stops.map((x) => mix(x, "#1b2632", 0.5)); s.accent = mix(s.accent, "#6f93c0", 0.5); }
    else if (snow) { s.stops = s.stops.map((x) => mix(x, "#566373", 0.42)); s.accent = mix(s.accent, "#bcd0e8", 0.5); }
    else if (cloud) { s.stops = s.stops.map((x) => mix(x, "#363b46", 0.32)); s.accent = mix(s.accent, "#9aa6b8", 0.35); }
    return s;
  }

  function applyScene(code) {
    const date = new Date();
    const s = sceneFor(date, code);
    const root = document.documentElement.style;
    root.setProperty("--accent", s.accent);
    if (document.documentElement.dataset.theme !== "light") {
      root.setProperty("--scene-1", s.stops[0]);
      root.setProperty("--scene-2", s.stops[1]);
      root.setProperty("--scene-3", s.stops[2]);
    } else {
      // light theme uses the stylesheet's light scene; only the accent follows time
      ["--scene-1", "--scene-2", "--scene-3"].forEach((p) => root.removeProperty(p));
    }

    // Sun position by hour (low near sunrise/sunset, high at midday) and the
    // sky condition that shows/hides the sun + clouds + ridge layers.
    const h = localHour(date);
    root.setProperty("--sun-x", Math.max(5, Math.min(95, ((h - 6) / 13) * 100)) + "%");
    root.setProperty("--sun-y", Math.max(26, Math.min(92, 26 + (Math.abs(h - 13) / 7) * 64)) + "%");
    let sky;
    if (h >= 21 || h < 5) sky = "night";
    else if (code == null || code === 0 || code === 1) sky = "clear";
    else if (code === 2) sky = "partly";
    else if ([3, 45, 48, 71, 73, 75, 77, 85, 86].includes(code)) sky = "cloudy";
    else sky = "rain";
    document.body.dataset.sky = sky;
  }

  /* ========================================================================
   * Clock, greeting, theme
   * ======================================================================*/
  function tickClock() {
    const now = new Date();
    const tz = CFG.location?.timezone;
    const opts = { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz };
    const [h, m] = now.toLocaleTimeString("en-GB", opts).split(":");
    $("clock").innerHTML = `${h}<span>:</span>${m}`;
    $("date").textContent = now.toLocaleDateString(undefined,
      { weekday: "long", day: "numeric", month: "long", timeZone: tz });
    const hr = +now.toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: tz });
    const part = hr < 5 ? "Good night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    $("greeting").textContent = CFG.name ? `${part}, ${CFG.name}.` : part + ".";
  }

  function initTheme() {
    const saved = localStorage.getItem("dash-theme") || CFG.theme || "auto";
    apply(saved);
    $("themeBtn").addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme || "dark";
      const next = cur === "dark" ? "light" : "dark";
      localStorage.setItem("dash-theme", next);
      apply(next);
    });
    function apply(mode) {
      const m = mode === "auto"
        ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
        : mode;
      document.documentElement.dataset.theme = m;
      applyScene(lastWeatherCode);
    }
  }

  /* ========================================================================
   * Weather — Open-Meteo (no API key required)
   * ======================================================================*/
  const WX = {
    0: ["Clear", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁️"], 45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
    61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
    66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
    71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
    80: ["Showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Heavy showers", "⛈️"],
    85: ["Snow showers", "🌨️"], 86: ["Snow showers", "❄️"],
    95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm", "⛈️"], 99: ["Thunderstorm", "⛈️"],
  };
  async function loadWeather() {
    const body = $("weatherBody"), loc = CFG.location || {};
    $("weatherLoc").textContent = loc.label || "";
    const imperial = loc.units === "imperial";
    try {
      const u = new URL("https://api.open-meteo.com/v1/forecast");
      u.search = new URLSearchParams({
        latitude: loc.lat, longitude: loc.lon, timezone: loc.timezone || "auto",
        current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min",
        temperature_unit: imperial ? "fahrenheit" : "celsius",
        wind_speed_unit: imperial ? "mph" : "kmh",
        forecast_days: "5",
      });
      const d = await getJSON(u.toString());
      const c = d.current, [desc, ico] = WX[c.weather_code] || ["—", "•"];
      lastWeatherCode = c.weather_code; applyScene(lastWeatherCode);
      const tU = imperial ? "°F" : "°C", wU = imperial ? "mph" : "km/h";
      const tb = document.getElementById("tbWeather");
      if (tb) tb.textContent = `${ico} ${Math.round(c.temperature_2m)}${tU}`;
      const days = d.daily.time.map((t, i) => {
        const [, dico] = WX[d.daily.weather_code[i]] || ["", "•"];
        const dn = new Date(t).toLocaleDateString(undefined, { weekday: "short" });
        return `<div class="wx-day"><b>${i === 0 ? "Today" : dn}</b>
          <div class="ico">${dico}</div>
          <div class="t">${Math.round(d.daily.temperature_2m_max[i])}°<i> ${Math.round(d.daily.temperature_2m_min[i])}°</i></div></div>`;
      }).join("");
      body.innerHTML = `
        <div class="wx-now">
          <div class="wx-icon">${ico}</div>
          <div>
            <div class="wx-temp">${Math.round(c.temperature_2m)}${tU}</div>
            <div class="wx-desc">${desc} · feels ${Math.round(c.apparent_temperature)}${tU}</div>
            <div class="wx-meta">💧 ${c.relative_humidity_2m}%  ·  🌬️ ${Math.round(c.wind_speed_10m)} ${wU}</div>
          </div>
        </div>
        <div class="wx-days">${days}</div>`;
    } catch (e) {
      fail(body, "Weather unavailable. Check your location coords in config.js.");
    }
  }

  /* ========================================================================
   * Stocks — Yahoo Finance quote endpoint (via CORS proxy)
   * ======================================================================*/
  // Portfolio holdings are a *private* figure, so they live in localStorage only
  // (never committed). Each holding: { symbol, shares, cost? (avg cost/share) }.
  const PF_KEY = "dash-portfolio";
  const getPortfolio = () => { try { return JSON.parse(localStorage.getItem(PF_KEY)) || []; } catch { return []; } };
  const fmtCur = (n, cur) => {
    try { return n.toLocaleString(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 }); }
    catch { return fmtMoney(n) + (cur && cur !== "USD" ? " " + cur : ""); }
  };

  // Paste/edit holdings as plain text — one per line: "SYMBOL SHARES [AVG_COST]".
  function managePortfolio() {
    const tmpl = getPortfolio().map((h) => `${h.symbol} ${h.shares}${h.cost != null ? " " + h.cost : ""}`).join("\n");
    const input = prompt(
      "Your holdings, one per line:\n  SYMBOL  SHARES  AVG_COST\n" +
      "e.g.  AAPL 10 150.25   (avg cost optional — needed for gain/loss)\n" +
      "Non-US tickers use Yahoo suffixes, e.g. OTP.BU, BMW.DE, SHEL.L.\n\n" +
      "Stored only in this browser. Submit empty to clear.",
      tmpl
    );
    if (input === null) return;
    const holdings = input.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const p = l.split(/\s+/);
      const symbol = (p[0] || "").toUpperCase();
      const shares = parseFloat(p[1]);
      const cost = p[2] != null ? parseFloat(p[2]) : NaN;
      if (!symbol || !isFinite(shares)) return null;
      return { symbol, shares, cost: isFinite(cost) ? cost : null };
    }).filter(Boolean);
    localStorage.setItem(PF_KEY, JSON.stringify(holdings));
    loadStocks();
  }

  function renderTick(q) {
    const chg = q.regularMarketChangePercent ?? 0;
    const cls = chg >= 0 ? "up" : "down", arrow = chg >= 0 ? "▲" : "▼";
    const price = q.regularMarketPrice != null ? fmtMoney(q.regularMarketPrice) : "—";
    const cur = q.currency && q.currency !== "USD" ? " " + q.currency : "";
    return `<div class="tick">
      <div><div class="tick__sym">${esc(q.symbol)}</div>
        <div class="tick__name">${esc((q.shortName || "").slice(0, 22))}</div></div>
      <div class="tick__right">
        <div class="tick__price">${price}${cur}</div>
        <div class="tick__chg ${cls}">${arrow} ${Math.abs(chg).toFixed(2)}%</div>
      </div></div>`;
  }

  function renderPortfolio(body, holdings, bySym) {
    const totals = {}; // grouped by currency so mixed-currency portfolios stay honest
    const rows = holdings.map((h) => {
      const q = bySym[h.symbol];
      if (!q || q.regularMarketPrice == null) {
        return `<div class="tick"><div><div class="tick__sym">${esc(h.symbol)}</div>
          <div class="tick__name">no quote</div></div></div>`;
      }
      const cur = q.currency || "USD";
      const value = q.regularMarketPrice * h.shares;
      const dayPct = q.regularMarketChangePercent ?? 0;
      const dayVal = (q.regularMarketChange ?? 0) * h.shares;
      const t = totals[cur] || (totals[cur] = { value: 0, day: 0, cost: 0, hasCost: false });
      t.value += value; t.day += dayVal;
      let plStr = "";
      if (h.cost != null) {
        const costVal = h.cost * h.shares, pl = value - costVal, plPct = costVal ? (pl / costVal) * 100 : 0;
        t.cost += costVal; t.hasCost = true;
        plStr = `<div class="tick__pl ${pl >= 0 ? "up" : "down"}">${pl >= 0 ? "+" : "−"}${fmtCur(Math.abs(pl), cur)} (${pl >= 0 ? "+" : "−"}${Math.abs(plPct).toFixed(1)}%)</div>`;
      }
      const dCls = dayPct >= 0 ? "up" : "down", arrow = dayPct >= 0 ? "▲" : "▼";
      return `<div class="tick">
        <div><div class="tick__sym">${esc(h.symbol)}</div>
          <div class="tick__name">${esc(String(h.shares))} sh${h.cost != null ? " @ " + fmtMoney(h.cost) : ""}</div></div>
        <div class="tick__right">
          <div class="tick__price">${fmtCur(value, cur)}</div>
          <div class="tick__chg ${dCls}">${arrow} ${Math.abs(dayPct).toFixed(2)}%</div>
          ${plStr}
        </div></div>`;
    }).join("");

    const summary = Object.entries(totals).map(([cur, t]) => {
      const dCls = t.day >= 0 ? "up" : "down";
      let plPart = "";
      if (t.hasCost) {
        const pl = t.value - t.cost, plPct = t.cost ? (pl / t.cost) * 100 : 0;
        plPart = ` · <span class="${pl >= 0 ? "up" : "down"}">${pl >= 0 ? "+" : "−"}${fmtCur(Math.abs(pl), cur)} (${pl >= 0 ? "+" : "−"}${Math.abs(plPct).toFixed(1)}%)</span>`;
      }
      return `<div class="pf-sum">
        <div class="pf-sum__cur">${esc(cur)}</div>
        <div class="pf-sum__r">
          <div class="pf-sum__val">${fmtCur(t.value, cur)}</div>
          <div class="pf-sum__meta"><span class="${dCls}">${t.day >= 0 ? "▲" : "▼"} ${fmtCur(Math.abs(t.day), cur)} today</span>${plPart}</div>
        </div></div>`;
    }).join("");

    body.innerHTML = summary + rows;
  }

  // Quotes via Yahoo's v8 chart endpoint (one request per symbol). Unlike the
  // old v7 /finance/quote, v8 /finance/chart needs no session "crumb"/cookie, so
  // it works reliably through the proxy. Returns objects shaped like the fields
  // renderTick/renderPortfolio expect.
  async function fetchQuotes(symbols) {
    const settled = await Promise.allSettled(symbols.map(async (sym) => {
      const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
      const d = await getJSON(u, { useProxy: true });
      const r = d?.chart?.result?.[0];
      const m = r?.meta;
      if (!m || m.regularMarketPrice == null) throw new Error("no data: " + sym);
      const price = m.regularMarketPrice;
      const prev = m.chartPreviousClose ?? m.previousClose ?? price;
      return {
        symbol: m.symbol || sym,
        shortName: m.shortName || m.longName || m.exchangeName || "",
        regularMarketPrice: price,
        regularMarketChange: prev != null ? price - prev : 0,
        regularMarketChangePercent: prev ? ((price - prev) / prev) * 100 : 0,
        currency: m.currency || "USD",
      };
    }));
    return settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  }

  async function loadStocks() {
    const body = $("stocksBody"), cfg = CFG.stocks || {};
    const holdings = getPortfolio(), watch = cfg.symbols || [];
    const symbols = [...new Set([...holdings.map((h) => h.symbol), ...watch])];
    const title = $("stocksTitle");
    if (!cfg.enabled || !symbols.length) { $("stocksCard").style.display = "none"; return; }

    // header affordance: add / edit holdings
    $("stocksSub").innerHTML = `<a href="#" id="pfManage">${holdings.length ? "edit" : "＋ holdings"}</a>`;
    const mb = $("pfManage"); if (mb) mb.onclick = (e) => { e.preventDefault(); managePortfolio(); };

    try {
      const rows = await fetchQuotes(symbols);
      if (!rows.length) throw new Error("no data");
      if (title) title.textContent = holdings.length ? "Portfolio" : "Markets";
      if (holdings.length) {
        renderPortfolio(body, holdings, Object.fromEntries(rows.map((q) => [q.symbol, q])));
      } else {
        body.innerHTML = rows.map(renderTick).join("");
      }
    } catch (e) {
      fail(body, "Markets unavailable — the quote source couldn't be reached. Make sure the CORS proxy is deployed (or use the allorigins fallback in config.js). See CLAUDE.md.");
    }
  }

  /* ========================================================================
   * News — parse RSS/Atom from multiple feeds (via CORS proxy)
   * ======================================================================*/
  function parseFeed(xmlText, sourceName) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = [...doc.querySelectorAll("item, entry")];
    return items.map((it) => {
      const get = (sel) => it.querySelector(sel)?.textContent?.trim() || "";
      let link = get("link");
      if (!link) link = it.querySelector("link")?.getAttribute("href") || "";
      const dateStr = get("pubDate") || get("published") || get("updated");
      return {
        title: get("title"),
        link,
        source: sourceName,
        date: dateStr ? new Date(dateStr) : null,
      };
    }).filter((x) => x.title && x.link);
  }
  async function loadNews() {
    const body = $("newsBody"), cfg = CFG.news || {};
    if (!cfg.enabled || !cfg.feeds?.length) { $("newsCard").style.display = "none"; return; }
    try {
      const settled = await Promise.allSettled(
        cfg.feeds.map(async (f) => parseFeed(await getText(f.url, { useProxy: true }), f.name))
      );
      let all = settled.filter((s) => s.status === "fulfilled").flatMap((s) => s.value);
      if (!all.length) throw new Error("no items");
      all.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      all = all.slice(0, cfg.maxItems || 8);
      body.innerHTML = `<div class="feed">${all.map((n) => `
        <div class="feed__item">
          <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>
          <div class="feed__meta"><span>${esc(n.source)}</span>${n.date ? `<span>· ${relTime(n.date)}</span>` : ""}</div>
        </div>`).join("")}</div>`;
    } catch (e) {
      fail(body, "News unavailable. Check the proxy/feeds in config.js.");
    }
  }

  /* ========================================================================
   * Sports — ESPN public scoreboard API (no key, CORS-enabled)
   * ======================================================================*/
  async function loadSports() {
    const body = $("sportsBody"), cfg = CFG.sports || {};
    if (!cfg.enabled || !cfg.leagues?.length) { $("sportsCard").style.display = "none"; return; }
    try {
      const out = await Promise.allSettled(cfg.leagues.map(async (lg) => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${lg.path}/scoreboard`;
        const d = await getJSON(url);
        return { lg, events: (d.events || []).slice(0, 4) };
      }));
      const blocks = out.filter((o) => o.status === "fulfilled" && o.value.events.length).map(({ value }) => {
        const { lg, events } = value;
        const games = events.map((ev) => {
          const comp = ev.competitions?.[0];
          const teams = comp?.competitors || [];
          const home = teams.find((t) => t.homeAway === "home") || teams[0] || {};
          const away = teams.find((t) => t.homeAway === "away") || teams[1] || {};
          const st = ev.status?.type || {};
          const mark = (t) => {
            const nm = t.team?.shortDisplayName || t.team?.displayName || "?";
            const mine = lg.team && (t.team?.displayName || "").toLowerCase().includes(lg.team.toLowerCase());
            return mine ? `<span class="mine">${esc(nm)}</span>` : esc(nm);
          };
          let right;
          if (st.state === "in") right = `<span class="match__live">${esc(st.shortDetail || "LIVE")}</span>`;
          else if (st.completed) right = `<span class="match__score">${away.score ?? ""}–${home.score ?? ""}</span>`;
          else right = `<span class="match__when">${new Date(ev.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${new Date(ev.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>`;
          return `<div class="match"><div class="match__teams">${mark(away)} <span style="color:var(--text-faint)">@</span> ${mark(home)}</div>${right}</div>`;
        }).join("");
        return `<div class="league-name">${esc(lg.name)}</div>${games}`;
      });
      body.innerHTML = blocks.length ? blocks.join("") : `<div class="skeleton">No fixtures right now.</div>`;
    } catch (e) {
      fail(body, "Sports unavailable. Check league paths in config.js.");
    }
  }

  /* ========================================================================
   * Calendar — fetch & parse an .ics feed (via CORS proxy)
   * ======================================================================*/
  function parseICS(text) {
    // Unfold folded lines (RFC 5545: continuation lines start with space/tab)
    const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
    const events = [];
    let cur = null;
    for (const line of lines) {
      if (line.startsWith("BEGIN:VEVENT")) cur = {};
      else if (line.startsWith("END:VEVENT")) { if (cur?.start) events.push(cur); cur = null; }
      else if (cur) {
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        const key = line.slice(0, idx), val = line.slice(idx + 1);
        const name = key.split(";")[0];
        if (name === "SUMMARY") cur.summary = val;
        else if (name === "DTSTART") cur.start = parseICSDate(val, key);
        else if (name === "LOCATION") cur.location = val;
      }
    }
    return events;
  }
  function parseICSDate(val, key) {
    if (/VALUE=DATE/.test(key) || /^\d{8}$/.test(val)) {
      const y = +val.slice(0, 4), m = +val.slice(4, 6) - 1, d = +val.slice(6, 8);
      return { date: new Date(y, m, d), allDay: true };
    }
    const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
    if (!m) return null;
    const [, y, mo, da, h, mi, s, z] = m;
    const d = z ? new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi, +s)) : new Date(+y, +mo - 1, +da, +h, +mi, +s);
    return { date: d, allDay: false };
  }
  // Calendar URLs are *secret* (anyone with one can read that calendar), so they
  // live only in this browser's localStorage — never committed. Multiple feeds
  // are supported (e.g. a Google calendar + a pogdesign TV calendar); events
  // from all of them are merged, sorted, and tagged with a short source label.
  const CAL_KEY = "dash-calendar-urls";
  function getCalUrls() {
    const out = [];
    try { const a = JSON.parse(localStorage.getItem(CAL_KEY)); if (Array.isArray(a)) out.push(...a); } catch {}
    const legacy = localStorage.getItem("dash-calendar-url"); if (legacy) out.push(legacy); // migrate old single key
    const cfg = CFG.calendar || {};
    if (cfg.url) out.push(cfg.url);
    (cfg.feeds || []).forEach((f) => out.push(typeof f === "string" ? f : f && f.url));
    return [...new Set(out.filter(Boolean))];
  }
  function calSource(u) {
    try {
      const h = new URL(u).hostname.replace(/^www\./, "");
      if (h.includes("pogdesign")) return "TV";
      if (h.includes("google")) return "Cal";
      return h.split(".")[0];
    } catch { return ""; }
  }

  async function loadCalendar() {
    const body = $("calendarBody"), cfg = CFG.calendar || {};
    if (!cfg.enabled) { $("calendarCard").style.display = "none"; return; }
    const urls = getCalUrls();
    $("calSub").innerHTML = urls.length ? `<a href="#" id="calEdit">edit</a>` : "";
    const e1 = $("calEdit"); if (e1) e1.onclick = (e) => { e.preventDefault(); connectCalendar(); };

    if (!urls.length) {
      body.innerHTML = `<div class="skeleton">No calendar connected.<br>
        <button class="ghost-btn ghost-btn--sm" id="calConnect" style="margin-top:10px">＋ Connect calendar</button></div>`;
      $("calConnect").onclick = connectCalendar;
      return;
    }
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const settled = await Promise.allSettled(urls.map(async (u) => {
        const text = await getText(u, { useProxy: true });
        const src = calSource(u);
        return parseICS(text).map((ev) => ({ ...ev, source: src }));
      }));
      const events = settled.filter((s) => s.status === "fulfilled").flatMap((s) => s.value)
        .filter((e) => e.start && e.start.date >= start)
        .sort((a, b) => a.start.date - b.start.date)
        .slice(0, cfg.maxItems || 6);
      if (!events.length) { body.innerHTML = `<div class="skeleton">No upcoming events.</div>`; return; }
      body.innerHTML = events.map((e) => {
        const d = e.start.date;
        const time = e.start.allDay ? "All day"
          : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        const src = e.source ? ` · <span class="evt__src">${esc(e.source)}</span>` : "";
        return `<div class="evt">
          <div class="evt__date"><b>${d.getDate()}</b><span>${d.toLocaleDateString(undefined, { month: "short" })}</span></div>
          <div class="evt__body">${esc(e.summary || "(untitled)")}
            <div class="evt__time">${time}${src}${e.location ? " · " + esc(e.location.slice(0, 24)) : ""}</div></div>
        </div>`;
      }).join("");
    } catch (e) {
      fail(body, `Calendar unavailable. Check the URLs (<a href="#" id="calEdit2">edit</a>) and that the proxy allows the host.`);
      const b2 = $("calEdit2"); if (b2) b2.onclick = (ev) => { ev.preventDefault(); connectCalendar(); };
    }
  }

  // Prompt for one or more iCal URLs (one per line). Stored locally only.
  function connectCalendar() {
    const current = getCalUrls().join("\n");
    const input = prompt(
      "Paste iCal / .ics URLs — one per line. Multiple calendars are supported:\n" +
      "• Google: Settings → 'Integrate calendar' → 'Secret address in iCal format'\n" +
      "• pogdesign TV: pogdesign.co.uk/cat → pick shows → copy the iCal subscribe URL\n\n" +
      "Stored only in this browser. Submit empty to clear all.",
      current
    );
    if (input === null) return; // cancelled
    const urls = input.split("\n").map((l) => l.trim().replace(/^webcal:\/\//i, "https://")).filter(Boolean);
    if (urls.some((u) => !/^https:\/\//i.test(u))) { alert("Each line must be an https:// URL."); return; }
    localStorage.setItem(CAL_KEY, JSON.stringify(urls));
    localStorage.removeItem("dash-calendar-url");
    loadCalendar();
  }

  /* ========================================================================
   * Orchestration
   * ======================================================================*/
  function refreshAll() {
    loadWeather(); loadStocks(); loadNews(); loadSports(); loadCalendar();
    $("footStatus").textContent = "Updated " + new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  function schedule(fn, minutes) { if (minutes > 0) setInterval(fn, minutes * 60000); }

  function init() {
    initTheme();
    tickClock(); setInterval(tickClock, 1000 * 15);
    setInterval(() => applyScene(lastWeatherCode), 10 * 60000); // track time-of-day
    refreshAll();
    schedule(loadWeather, 15);
    schedule(loadStocks, CFG.stocks?.refreshMinutes || 5);
    schedule(loadNews, CFG.news?.refreshMinutes || 20);
    schedule(loadSports, CFG.sports?.refreshMinutes || 10);
    schedule(loadCalendar, CFG.calendar?.refreshMinutes || 30);
    $("refreshBtn").addEventListener("click", refreshAll);
    // Refresh when the tab regains focus after being hidden a while.
    let hidden = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hidden = Date.now();
      else if (Date.now() - hidden > 5 * 60000) refreshAll();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
