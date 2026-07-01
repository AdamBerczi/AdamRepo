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
  // Try the browser's own location (GPS/Wi-Fi/IP) so weather reflects where
  // you actually are, not just the home-base preset. Resolves to null (never
  // rejects) on denial/timeout/unsupported browsers so callers can fall back.
  function getGeoCoords() {
    return new Promise((resolve) => {
      if (!navigator.geolocation || CFG.location?.autoDetect === false) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 10 * 60000 }
      );
    });
  }

  // Best-effort city name for detected coords. No key, CORS-enabled, designed
  // for client-side use. Fails soft to null so the caller can show a generic label.
  async function reverseGeocode(lat, lon) {
    try {
      const u = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
      u.search = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: "en" });
      const d = await getJSON(u.toString());
      return d.city || d.locality || d.principalSubdivision || null;
    } catch { return null; }
  }

  async function loadWeather() {
    const body = $("weatherBody"), loc = CFG.location || {};
    const imperial = loc.units === "imperial";
    try {
      const geo = await getGeoCoords();
      const lat = geo?.lat ?? loc.lat, lon = geo?.lon ?? loc.lon;
      const [d, label] = await Promise.all([
        (() => {
          const u = new URL("https://api.open-meteo.com/v1/forecast");
          u.search = new URLSearchParams({
            latitude: lat, longitude: lon, timezone: geo ? "auto" : (loc.timezone || "auto"),
            current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m",
            daily: "weather_code,temperature_2m_max,temperature_2m_min",
            temperature_unit: imperial ? "fahrenheit" : "celsius",
            wind_speed_unit: imperial ? "mph" : "kmh",
            forecast_days: "5",
          });
          return getJSON(u.toString());
        })(),
        geo ? reverseGeocode(lat, lon) : Promise.resolve(loc.label || ""),
      ]);
      $("weatherLoc").textContent = label || (geo ? "My location" : (loc.label || ""));
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
  // Portfolio holdings come from localStorage (private, entered on the page) if
  // present, otherwise from CFG.portfolio.holdings (committed). localStorage
  // wins so a per-browser override beats the committed default. Each holding:
  // { symbol, shares, cost? (avg cost/share) }.
  const PF_KEY = "dash-portfolio";
  const getPortfolio = () => {
    try { const a = JSON.parse(localStorage.getItem(PF_KEY)); if (Array.isArray(a) && a.length) return a; } catch {}
    const c = CFG.portfolio && CFG.portfolio.holdings;
    return Array.isArray(c) ? c : [];
  };
  const getCash = () => (CFG.portfolio && +CFG.portfolio.cash) || 0;
  const cashCur = () => (CFG.portfolio && CFG.portfolio.currency) || "USD";
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
    // Per-currency totals. `value` = market value of holdings (used for P/L vs
    // `cost`); `cash` is tracked separately and added to the displayed total but
    // never counted as a gain.
    const totals = {};
    const bucket = (cur) => totals[cur] || (totals[cur] = { value: 0, day: 0, cost: 0, cash: 0, hasCost: false });
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
      const t = bucket(cur);
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

    const cash = getCash();
    let cashRow = "";
    if (cash > 0) {
      const cur = cashCur();
      bucket(cur).cash += cash;
      cashRow = `<div class="tick">
        <div><div class="tick__sym">Cash</div></div>
        <div class="tick__right"><div class="tick__price">${fmtCur(cash, cur)}</div></div></div>`;
    }

    const summary = Object.entries(totals).map(([cur, t]) => {
      const total = t.value + t.cash;
      const dCls = t.day >= 0 ? "up" : "down";
      let plPart = "";
      if (t.hasCost) {
        const pl = t.value - t.cost, plPct = t.cost ? (pl / t.cost) * 100 : 0;
        plPart = ` · <span class="${pl >= 0 ? "up" : "down"}">${pl >= 0 ? "+" : "−"}${fmtCur(Math.abs(pl), cur)} (${pl >= 0 ? "+" : "−"}${Math.abs(plPct).toFixed(1)}%)</span>`;
      }
      return `<div class="pf-sum">
        <div class="pf-sum__cur">${esc(cur)}</div>
        <div class="pf-sum__r">
          <div class="pf-sum__val">${fmtCur(total, cur)}</div>
          <div class="pf-sum__meta"><span class="${dCls}">${t.day >= 0 ? "▲" : "▼"} ${fmtCur(Math.abs(t.day), cur)} today</span>${plPart}</div>
        </div></div>`;
    }).join("");

    body.innerHTML = summary + rows + cashRow;
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
    const symbols = holdings.length ? [...new Set(holdings.map((h) => h.symbol))] : watch;
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
      // Float explicit "breaking" items to the top, then sort by recency.
      const isBreaking = (t) => /\bbreaking\b/i.test(t || "");
      all.forEach((n) => { n.breaking = isBreaking(n.title); });
      all.sort((a, b) => (b.breaking - a.breaking) || ((b.date?.getTime() || 0) - (a.date?.getTime() || 0)));
      all = all.slice(0, cfg.maxItems || 8);
      body.innerHTML = `<div class="feed">${all.map((n) => `
        <div class="feed__item">
          <a href="${esc(n.link)}" target="_blank" rel="noopener">${n.breaking ? `<span class="brk">Breaking</span> ` : ""}${esc(n.title)}</a>
          <div class="feed__meta"><span>${esc(n.source)}</span>${n.date ? `<span>· ${relTime(n.date)}</span>` : ""}</div>
        </div>`).join("")}</div>`;
    } catch (e) {
      fail(body, "News unavailable. Check the proxy/feeds in config.js.");
    }
  }

  /* ========================================================================
   * Formula 1 — Jolpica (Ergast successor). Keyless, CORS-enabled, no proxy.
   * Next race + a live countdown to qualifying, with Drivers/Constructors tabs.
   * ======================================================================*/
  // Constructor brand colours, used as team "icons" (Ergast constructorId keys).
  const F1_TEAM = {
    red_bull: "#3671C6", ferrari: "#E8002D", mercedes: "#27F4D2", mclaren: "#FF8000",
    aston_martin: "#229971", alpine: "#0093CC", williams: "#64C4FF", rb: "#6692FF",
    sauber: "#52E252", haas: "#B6BABD", audi: "#009597", cadillac: "#B58842",
    alphatauri: "#5E8FAA", alfa: "#C92D4B",
  };
  const teamColor = (id) => F1_TEAM[id] || "#9aa0ad";
  const teamIcon = (id) => `<span class="f1-team" style="--c:${teamColor(id)}"></span>`;

  const f1State = { drivers: [], constructors: [], tab: "drivers", quali: null, qualiLabel: "" };

  function fmtCountdown(ms) {
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }
  function updateQualiCountdown() {
    const el = document.getElementById("f1Count");
    if (!el || !f1State.quali) return;
    const diff = f1State.quali.getTime() - Date.now();
    el.textContent = diff > 0 ? fmtCountdown(diff) : "underway";
  }

  function renderF1() {
    const body = $("f1Body");
    if (!body) return;
    const drivers = f1State.drivers.slice(0, 6).map((d) => `
      <div class="match">
        <div class="match__teams"><span class="f1-pos">${esc(d.position)}</span>${teamIcon(d.Constructors?.[0]?.constructorId)} ${esc(d.Driver?.familyName || "")}
          <span class="tick__name">${esc(d.Constructors?.[0]?.name || "")}</span></div>
        <div class="match__score">${esc(d.points)}</div>
      </div>`).join("");
    const constructors = f1State.constructors.slice(0, 6).map((c) => `
      <div class="match">
        <div class="match__teams"><span class="f1-pos">${esc(c.position)}</span>${teamIcon(c.Constructor?.constructorId)} ${esc(c.Constructor?.name || "")}</div>
        <div class="match__score">${esc(c.points)}</div>
      </div>`).join("");
    const list = f1State.tab === "constructors" ? constructors : drivers;

    body.innerHTML = `
      <div class="f1-grid">
        <div class="f1-left">${f1State.nextHtml || `<div class="skeleton">No upcoming race.</div>`}</div>
        <div class="f1-right">
          <div class="f1-tabs">
            <button class="f1-tab${f1State.tab === "drivers" ? " is-on" : ""}" data-tab="drivers">Drivers</button>
            <button class="f1-tab${f1State.tab === "constructors" ? " is-on" : ""}" data-tab="constructors">Constructors</button>
          </div>
          ${list || `<div class="skeleton">Standings unavailable.</div>`}
        </div>
      </div>`;
    body.querySelectorAll(".f1-tab").forEach((b) => b.onclick = () => { f1State.tab = b.dataset.tab; renderF1(); });
    updateQualiCountdown();
  }

  async function loadF1() {
    const body = $("f1Body"), cfg = CFG.f1 || {};
    if (!cfg.enabled) { $("f1Card").style.display = "none"; return; }
    try {
      const base = "https://api.jolpi.ca/ergast/f1/current";
      const [nextR, drvR, conR] = await Promise.allSettled([
        getJSON(base + "/next.json"),
        getJSON(base + "/driverStandings.json"),
        getJSON(base + "/constructorStandings.json"),
      ]);
      if (drvR.status === "fulfilled")
        f1State.drivers = drvR.value?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
      if (conR.status === "fulfilled")
        f1State.constructors = conR.value?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];

      f1State.quali = null; f1State.nextHtml = "";
      if (nextR.status === "fulfilled") {
        const race = nextR.value?.MRData?.RaceTable?.Races?.[0];
        if (race) {
          const loc = [race.Circuit?.Location?.locality, race.Circuit?.Location?.country].filter(Boolean).join(", ");
          const q = race.Qualifying;
          let qline = "";
          if (q?.date) {
            f1State.quali = new Date(`${q.date}T${q.time || "00:00:00Z"}`);
            const ql = f1State.quali.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
            qline = `<div class="f1-quali">Qualifying in <b id="f1Count">—</b><span class="f1-quali__at">${esc(ql)}</span></div>`;
          } else if (race.date) {
            const rd = new Date(`${race.date}T${race.time || "12:00:00Z"}`);
            qline = `<div class="f1-quali__at">${esc(rd.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</div>`;
          }
          f1State.nextHtml = `<div class="f1-next__label">Next race</div>
            <div class="f1-next__name">${esc(race.raceName)}</div>
            <div class="f1-next__meta">Round ${esc(race.round)}${loc ? " · " + esc(loc) : ""}</div>
            ${qline}`;
          $("f1Sub").textContent = "R" + esc(race.round);
        }
      }
      if (!f1State.drivers.length && !f1State.nextHtml) throw new Error("no f1 data");
      renderF1();
    } catch (e) {
      fail(body, "F1 data unavailable (Jolpica/Ergast may be down).");
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
        if (name === "SUMMARY") cur.summary = icsUnescape(val);
        else if (name === "DTSTART") cur.start = parseICSDate(val, key);
        else if (name === "LOCATION") cur.location = icsUnescape(val);
      }
    }
    return events;
  }
  // RFC 5545 text-escaping: \n \, \; \\ → newline/comma/semicolon/backslash.
  const icsUnescape = (s) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

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
      const url = new URL(u, location.href); // resolves relative paths like "tv-shows.ics"
      const h = url.hostname.replace(/^www\./, "");
      if (h.includes("pogdesign") || /tv/i.test(url.pathname)) return "TV";
      if (h.includes("google")) return "Cal";
      return h.includes("github") ? "" : h.split(".")[0];
    } catch { return ""; }
  }
  // Same-origin / relative feeds (e.g. a committed .ics) are fetched directly;
  // cross-origin feeds (Google, pogdesign live) go through the CORS proxy.
  const calNeedsProxy = (u) => /^https?:\/\//i.test(u) && new URL(u, location.href).origin !== location.origin;

  // Renders a bucket of events using the existing .evt list markup, or an
  // empty-state message when the bucket has nothing in it.
  function renderEvents(events, emptyMsg) {
    if (!events.length) return `<div class="skeleton">${emptyMsg}</div>`;
    return events.map((e) => {
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
  }

  // Calendar is split into three cards — Today / Tomorrow / This week (the 5
  // days after tomorrow) — all fed by the same merged, multi-feed event list
  // (Google + pogdesign TV, etc.), just bucketed by day.
  async function loadCalendar() {
    const cfg = CFG.calendar || {};
    const cards = [$("calTodayCard"), $("calTomorrowCard"), $("calWeekCard")];
    const bodies = [$("calTodayBody"), $("calTomorrowBody"), $("calWeekBody")];
    if (!cfg.enabled) { cards.forEach((c) => c.style.display = "none"); return; }

    const urls = getCalUrls();
    $("calTodaySub").innerHTML = urls.length ? `<a href="#" id="calEdit">edit</a>` : "";
    const e1 = $("calEdit"); if (e1) e1.onclick = (e) => { e.preventDefault(); connectCalendar(); };

    if (!urls.length) {
      bodies[0].innerHTML = `<div class="skeleton">No calendar connected.<br>
        <button class="ghost-btn ghost-btn--sm" id="calConnect" style="margin-top:10px">＋ Connect calendar</button></div>`;
      $("calConnect").onclick = connectCalendar;
      bodies[1].innerHTML = `<div class="skeleton">Connect a calendar (Today card) to see more.</div>`;
      bodies[2].innerHTML = `<div class="skeleton">Connect a calendar (Today card) to see more.</div>`;
      $("calTomorrowSub").textContent = ""; $("calWeekSub").textContent = "";
      return;
    }
    try {
      const now = new Date();
      const day = (n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
      const todayStart = day(0), tomorrowStart = day(1), dayAfterStart = day(2), weekEnd = day(7);

      $("calTomorrowSub").textContent = tomorrowStart.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      $("calWeekSub").textContent = `${dayAfterStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })}–${day(6).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

      const settled = await Promise.allSettled(urls.map(async (u) => {
        const text = await getText(u, { useProxy: calNeedsProxy(u) });
        const src = calSource(u);
        return parseICS(text).map((ev) => ({ ...ev, source: src }));
      }));
      const all = settled.filter((s) => s.status === "fulfilled").flatMap((s) => s.value)
        .filter((e) => e.start && e.start.date >= todayStart)
        .sort((a, b) => a.start.date - b.start.date);

      const max = cfg.maxItems || 6;
      const today = all.filter((e) => e.start.date < tomorrowStart).slice(0, max);
      const tomorrow = all.filter((e) => e.start.date >= tomorrowStart && e.start.date < dayAfterStart).slice(0, max);
      const week = all.filter((e) => e.start.date >= dayAfterStart && e.start.date < weekEnd).slice(0, max);

      bodies[0].innerHTML = renderEvents(today, "No events today.");
      bodies[1].innerHTML = renderEvents(tomorrow, "No events tomorrow.");
      bodies[2].innerHTML = renderEvents(week, "Nothing else this week.");
    } catch (e) {
      const msg = `Calendar unavailable. Check the URLs (<a href="#" class="calEdit2">edit</a>) and that the proxy allows the host.`;
      bodies.forEach((b) => fail(b, msg));
      document.querySelectorAll(".calEdit2").forEach((b) => b.onclick = (ev) => { ev.preventDefault(); connectCalendar(); });
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
    loadWeather(); loadStocks(); loadNews(); loadCalendar(); loadF1();
    $("footStatus").textContent = "Updated " + new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  function schedule(fn, minutes) { if (minutes > 0) setInterval(fn, minutes * 60000); }

  function init() {
    initTheme();
    tickClock(); setInterval(tickClock, 1000 * 15);
    setInterval(() => applyScene(lastWeatherCode), 10 * 60000); // track time-of-day
    setInterval(updateQualiCountdown, 1000); // live F1 qualifying countdown
    refreshAll();
    schedule(loadWeather, 15);
    schedule(loadStocks, CFG.stocks?.refreshMinutes || 5);
    schedule(loadNews, CFG.news?.refreshMinutes || 20);
    schedule(loadCalendar, CFG.calendar?.refreshMinutes || 30);
    schedule(loadF1, CFG.f1?.refreshMinutes || 60);
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
