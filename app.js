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

  // All widget fetches go through this: a hung upstream aborts after 12s so a
  // dead data source shows its fail message instead of stalling the card forever.
  async function fetchT(url, ms = 12000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try { return await fetch(url, { mode: "cors", signal: ctl.signal }); }
    finally { clearTimeout(t); }
  }
  async function getJSON(url, { useProxy = false } = {}) {
    const res = await fetchT(useProxy ? proxy(url) : url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function getText(url, { useProxy = false } = {}) {
    const res = await fetchT(useProxy ? proxy(url) : url);
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
    // "Dusk rice" palette: every hour of the day stays inside the same moody
    // charcoal + dusty-rose family (see styles.css header) — time of day only
    // shifts the warmth/brightness a little, it never changes identity.
    // [glow, mid, deep], accent.
    let s;
    if (h >= 22 || h < 5)      s = { stops: ["#221c26", "#121016", "#08070b"], accent: "#c48b90" }; // night — mauve-charcoal
    else if (h < 8)            s = { stops: ["#382630", "#1c151d", "#0c090e"], accent: "#e8a894" }; // dawn — peach-rose
    else if (h < 11)           s = { stops: ["#2e252d", "#181419", "#0b0a0d"], accent: "#dfa09c" }; // morning
    else if (h < 16)           s = { stops: ["#322a30", "#1a161b", "#0c0b0e"], accent: "#d99b98" }; // midday — lightest
    else if (h < 19)           s = { stops: ["#43282d", "#211317", "#0e090b"], accent: "#eb9c8b" }; // golden hour — warmest
    else                       s = { stops: ["#38222f", "#1b121c", "#0c080e"], accent: "#dd93a0" }; // dusk — the hero look

    // weather tint: desaturate toward grey, never leave the family
    const c = code;
    const cloud = [2, 3, 45, 48].includes(c);
    const rain = (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95 && c <= 99);
    const snow = (c >= 71 && c <= 77) || c === 85 || c === 86;
    if (rain) { s.stops = s.stops.map((x) => mix(x, "#1d1c22", 0.45)); s.accent = mix(s.accent, "#9b8f96", 0.4); }
    else if (snow) { s.stops = s.stops.map((x) => mix(x, "#3d3a42", 0.4)); s.accent = mix(s.accent, "#cfc4c8", 0.4); }
    else if (cloud) { s.stops = s.stops.map((x) => mix(x, "#26242a", 0.3)); s.accent = mix(s.accent, "#a89aa0", 0.28); }
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
    const clockHtml = `${h}<span>:</span>${m}`;
    $("clock").innerHTML = clockHtml;                 // bar clock (small)
    const hc = $("heroClock"); if (hc) hc.innerHTML = clockHtml; // hero clock (big)
    $("date").textContent = now.toLocaleDateString(undefined,
      { weekday: "short", day: "numeric", month: "short", timeZone: tz });
    const hd = $("heroDate"); if (hd) hd.textContent = now.toLocaleDateString(undefined,
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
  // Last successfully detected location, cached so the very first paint after
  // a reload is already local weather (no permission-prompt / GPS wait).
  const GEO_KEY = "dash-geo";
  function readGeoCache() {
    try {
      const g = JSON.parse(localStorage.getItem(GEO_KEY));
      if (g && isFinite(g.lat) && isFinite(g.lon)) return g;
    } catch {}
    return null;
  }

  // Try the browser's own location (GPS/Wi-Fi/IP) so weather reflects where
  // you actually are, not just the home-base preset. Resolves to null (never
  // rejects) on denial/timeout/unsupported browsers so callers can fall back.
  // Checks the Permissions API first so a previously-denied prompt resolves
  // instantly instead of eating the full geolocation timeout.
  function getGeoCoords() {
    return new Promise((resolve) => {
      if (!navigator.geolocation || CFG.location?.autoDetect === false) return resolve(null);
      const ask = () => navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 10 * 60000 }
      );
      if (navigator.permissions?.query) {
        navigator.permissions.query({ name: "geolocation" })
          .then((st) => (st.state === "denied" ? resolve(null) : ask()))
          .catch(ask);
      } else ask();
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

  // Fetch + render weather for one specific spot. `detected` switches the
  // forecast timezone to the spot's own ("auto") instead of the preset's.
  // A sequence counter makes the newest call win: if a slow earlier fetch
  // (e.g. the preset paint) resolves after the geolocation upgrade, it's
  // discarded instead of overwriting the fresher render.
  let wxSeq = 0;
  async function renderWeatherAt(lat, lon, label, detected) {
    const seq = ++wxSeq;
    const body = $("weatherBody"), loc = CFG.location || {};
    const imperial = loc.units === "imperial";
    try {
      const u = new URL("https://api.open-meteo.com/v1/forecast");
      u.search = new URLSearchParams({
        latitude: lat, longitude: lon, timezone: detected ? "auto" : (loc.timezone || "auto"),
        current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min",
        temperature_unit: imperial ? "fahrenheit" : "celsius",
        wind_speed_unit: imperial ? "mph" : "kmh",
        forecast_days: "5",
      });
      const d = await getJSON(u.toString());
      if (seq !== wxSeq) return; // a newer render superseded this one
      $("weatherLoc").textContent = label || (detected ? "My location" : "");
      const c = d.current, [desc, ico] = WX[c.weather_code] || ["—", "•"];
      lastWeatherCode = c.weather_code; applyScene(lastWeatherCode);
      const tU = imperial ? "°F" : "°C", wU = imperial ? "mph" : "km/h";
      // bar pill: icon + temp + short place name (yasb-module style)
      const tb = document.getElementById("tbWeather");
      const place = String(label || "").split(",")[0].trim();
      if (tb) tb.textContent = `${ico} ${Math.round(c.temperature_2m)}${tU}${place ? " · " + place : ""}`;
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
      // Don't clobber an already-rendered card when a background re-render
      // (e.g. the geolocation upgrade) fails — only fail if nothing is shown.
      if (!body.querySelector(".wx-now")) fail(body, "Weather unavailable. Check your location coords in config.js.");
    }
  }

  // Render-first weather: paint immediately from the best spot we already know
  // (last detected location, else the config preset — never wait on a
  // permission prompt), then ask for live geolocation in the background and
  // re-render + cache it only if the answer meaningfully moved.
  async function loadWeather() {
    const loc = CFG.location || {};
    const cached = readGeoCache();
    if (cached) renderWeatherAt(cached.lat, cached.lon, cached.label, true);
    else renderWeatherAt(loc.lat, loc.lon, loc.label || "", false);

    const geo = await getGeoCoords();
    if (!geo) return; // denied/unavailable → the paint above stands
    const moved = !cached || Math.abs(geo.lat - cached.lat) > 0.02 || Math.abs(geo.lon - cached.lon) > 0.02;
    if (!moved) return;
    const label = (await reverseGeocode(geo.lat, geo.lon)) || "My location";
    try { localStorage.setItem(GEO_KEY, JSON.stringify({ lat: geo.lat, lon: geo.lon, label })); } catch {}
    renderWeatherAt(geo.lat, geo.lon, label, true);
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
        // Key by the *requested* symbol: Yahoo sometimes normalizes it (case,
        // suffix), and renderPortfolio looks quotes up by the holding's symbol.
        symbol: sym,
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

    const pill = $("tbMarket");
    try {
      const rows = await fetchQuotes(symbols);
      if (!rows.length) throw new Error("no data");
      if (title) title.textContent = holdings.length ? "Portfolio" : "Markets";
      const bySym = Object.fromEntries(rows.map((q) => [q.symbol, q]));
      if (holdings.length) {
        renderPortfolio(body, holdings, bySym);
        // bar pill: today's P/L across holdings (assumes one primary currency)
        let day = 0, val = 0;
        holdings.forEach((h) => {
          const q = bySym[h.symbol]; if (!q) return;
          day += (q.regularMarketChange ?? 0) * h.shares;
          val += (q.regularMarketPrice ?? 0) * h.shares;
        });
        const pct = val - day ? (day / (val - day)) * 100 : 0;
        const cls = day >= 0 ? "up" : "down", arrow = day >= 0 ? "▲" : "▼";
        if (pill) pill.innerHTML =
          `<span class="${cls}">${arrow} ${day >= 0 ? "+" : "−"}${fmtCur(Math.abs(day), cashCur())} (${Math.abs(pct).toFixed(2)}%)</span>`;
      } else {
        body.innerHTML = rows.map(renderTick).join("");
        // watchlist mode: show the day's average move across the list
        const avg = rows.reduce((s, q) => s + (q.regularMarketChangePercent ?? 0), 0) / rows.length;
        const cls = avg >= 0 ? "up" : "down", arrow = avg >= 0 ? "▲" : "▼";
        if (pill) pill.innerHTML = `markets <span class="${cls}">${arrow} ${Math.abs(avg).toFixed(2)}%</span>`;
      }
    } catch (e) {
      if (pill) pill.innerHTML = `markets <span class="down">⚠</span>`;
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
    // Custom topics: each entry in cfg.topics becomes a Google News RSS
    // *search* feed (keyless, editorially ranked by Google News) — merged
    // with any plain RSS feeds in cfg.feeds. Both go through the proxy.
    const topicFeeds = (cfg.topics || []).map((t) => ({
      name: t,
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(t)}&hl=en-US&gl=US&ceid=US:en`,
    }));
    const feeds = [...(cfg.feeds || []), ...topicFeeds];
    if (!cfg.enabled || !feeds.length) { $("newsCard").style.display = "none"; return; }
    $("newsSub").textContent = (cfg.topics || []).join(" · ");
    try {
      const settled = await Promise.allSettled(
        feeds.map(async (f) => parseFeed(await getText(f.url, { useProxy: true }), f.name))
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
        else if (name === "RRULE") cur.rrule = val;
        else if (name === "EXDATE") {
          const dates = val.split(",").map((v) => parseICSDate(v, key)).filter(Boolean).map((p) => p.date);
          (cur.exdates || (cur.exdates = [])).push(...dates);
        }
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

  // Minimal RFC 5545 RRULE expansion — most Google Calendar entries are
  // recurring, so without this their DTSTART (the *first ever* occurrence,
  // often long past) is the only date we know about and they'd never show
  // up as "upcoming". Covers DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL,
  // COUNT, UNTIL, and BYDAY (weekly) — enough for the common cases, not a
  // full RFC 5545 engine. Returns occurrence Dates within [rangeStart, rangeEnd).
  function expandRecurrence(dtstart, rrule, exdates, rangeStart, rangeEnd) {
    const parts = {};
    rrule.split(";").forEach((p) => { const [k, v] = p.split("="); if (k) parts[k] = v; });
    const freq = parts.FREQ;
    if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return [];
    const interval = Math.max(1, parseInt(parts.INTERVAL, 10) || 1);
    const count = parts.COUNT ? parseInt(parts.COUNT, 10) : Infinity;
    const until = parts.UNTIL ? (parseICSDate(parts.UNTIL, "UNTIL") || {}).date : null;
    const exSet = new Set((exdates || []).map((d) => d.getTime()));
    const DAY_NUM = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const byday = parts.BYDAY ? parts.BYDAY.split(",").map((c) => DAY_NUM[c]).filter((n) => n != null) : null;
    const out = [];

    if (freq === "WEEKLY" && byday?.length) {
      let weekStart = new Date(dtstart); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      let n = 0;
      for (let w = 0; w < 1000 && weekStart < rangeEnd; w++, weekStart.setDate(weekStart.getDate() + 7 * interval)) {
        const occs = byday.map((dn) => { const d = new Date(weekStart); d.setDate(d.getDate() + dn); return d; })
          .filter((d) => d >= dtstart).sort((a, b) => a - b);
        for (const occ of occs) {
          n++;
          if (until && occ > until) return out;
          if (n > count) return out;
          if (occ >= rangeStart && occ < rangeEnd && !exSet.has(occ.getTime())) out.push(occ);
        }
      }
      return out;
    }

    let occ = new Date(dtstart);
    for (let n = 1; n <= count && n <= 20000 && occ < rangeEnd; n++) {
      if (until && occ > until) break;
      if (occ >= rangeStart && !exSet.has(occ.getTime())) out.push(new Date(occ));
      if (freq === "DAILY") occ.setDate(occ.getDate() + interval);
      else if (freq === "WEEKLY") occ.setDate(occ.getDate() + 7 * interval);
      else if (freq === "MONTHLY") occ.setMonth(occ.getMonth() + interval);
      else occ.setFullYear(occ.getFullYear() + interval);
    }
    return out;
  }

  // Calendar URLs are *secret* (anyone with one can read that calendar), so they
  // live only in this browser's localStorage — never committed. Multiple feeds
  // are supported (e.g. a Google calendar + a pogdesign TV calendar); events
  // from all of them are merged, sorted, and tagged with a short source label.
  const CAL_KEY = "dash-calendar-urls";
  // Private URLs only (localStorage) — this is what the connect modal edits.
  // Any number of feeds is supported (multiple Google calendars, TV, etc.);
  // they're just lines in the textarea, merged like every other feed.
  function getPrivateCalUrls() {
    const out = [];
    try { const a = JSON.parse(localStorage.getItem(CAL_KEY)); if (Array.isArray(a)) out.push(...a); } catch {}
    const legacy = localStorage.getItem("dash-calendar-url"); if (legacy) out.push(legacy); // migrate old single key
    return [...new Set(out.filter(Boolean))];
  }
  // Private + committed (config.js) feeds — this is what actually gets fetched.
  function getCalUrls() {
    const cfg = CFG.calendar || {};
    const out = getPrivateCalUrls();
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
    // Private (localStorage) feeds are where secret Google calendar URLs
    // live; if none are connected yet, say "＋ connect" instead of a bare
    // "edit" so it's obvious no personal calendar is hooked up on this device.
    const hasPrivate = getPrivateCalUrls().length > 0;
    $("calTodaySub").innerHTML = urls.length ? `<a href="#" id="calEdit">${hasPrivate ? "edit" : "＋ connect"}</a>` : "";
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

      // Fetch every feed, but keep failures visible instead of swallowing
      // them: a wrong URL (e.g. an HTML page instead of an .ics feed), a
      // proxy 403, or a dead host used to render as a silent "No events".
      const results = await Promise.all(urls.map(async (u) => {
        const src = calSource(u);
        try {
          const text = await getText(u, { useProxy: calNeedsProxy(u) });
          if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("response is not an iCal feed (got HTML?)");
          return { ok: true, events: parseICS(text).map((ev) => ({ ...ev, source: src })) };
        } catch (err) {
          console.warn("[dash] calendar feed failed:", u, err);
          let host = src; try { host = new URL(u, location.href).hostname; } catch {}
          return { ok: false, name: src || host };
        }
      }));
      const failedFeeds = results.filter((r) => !r.ok).map((r) => r.name);
      const raw = results.filter((r) => r.ok).flatMap((r) => r.events);
      if (!raw.length && failedFeeds.length) throw new Error("all feeds failed: " + failedFeeds.join(", "));
      if (failedFeeds.length) {
        // innerHTML += re-parses the subtitle and drops the edit link's click
        // handler, so rebind it after appending the failure note.
        $("calTodaySub").innerHTML += ` · <span class="err" style="font-size:inherit">⚠ ${esc(failedFeeds.join(", "))} failed</span>`;
        const e2 = $("calEdit"); if (e2) e2.onclick = (e) => { e.preventDefault(); connectCalendar(); };
      }
      // Non-recurring events pass through if upcoming; recurring events (most
      // Google Calendar entries) are expanded into the occurrences that fall
      // in our display window, since their DTSTART alone is usually stale.
      const all = raw.flatMap((ev) => {
        if (!ev.start) return [];
        if (!ev.rrule) return ev.start.date >= todayStart ? [ev] : [];
        return expandRecurrence(ev.start.date, ev.rrule, ev.exdates, todayStart, weekEnd)
          .map((date) => ({ ...ev, start: { date, allDay: ev.start.allDay } }));
      }).sort((a, b) => a.start.date - b.start.date);

      const max = cfg.maxItems || 6;
      const today = all.filter((e) => e.start.date < tomorrowStart).slice(0, max);
      const tomorrow = all.filter((e) => e.start.date >= tomorrowStart && e.start.date < dayAfterStart).slice(0, max);
      const week = all.filter((e) => e.start.date >= dayAfterStart && e.start.date < weekEnd).slice(0, max);

      const todayEmpty = hasPrivate ? "No events today."
        : `No events today. Google Calendar isn't connected on this device — use "＋ connect" above.`;
      bodies[0].innerHTML = renderEvents(today, todayEmpty);
      bodies[1].innerHTML = renderEvents(tomorrow, "No events tomorrow.");
      bodies[2].innerHTML = renderEvents(week, "Nothing else this week.");
    } catch (e) {
      const msg = `Calendar unavailable — ${esc(e.message || "fetch failed")}. Check the URLs (<a href="#" class="calEdit2">edit</a>) and that the proxy allows the host.`;
      bodies.forEach((b) => fail(b, msg));
      document.querySelectorAll(".calEdit2").forEach((b) => b.onclick = (ev) => { ev.preventDefault(); connectCalendar(); });
    }
  }

  // Modal for entering one or more private iCal URLs — a real <textarea>
  // instead of window.prompt(), which is single-line and unreliable for
  // pasting/typing several calendar URLs (a native prompt() can't hold
  // multi-line input reliably; e.g. Enter submits the whole dialog). Any
  // number of feeds is supported: several Google calendars, TV, etc. — every
  // non-empty line becomes its own feed, merged with the committed ones.
  function connectCalendar() {
    const overlay = $("calModalOverlay"), input = $("calModalInput"), err = $("calModalErr");
    input.value = getPrivateCalUrls().join("\n");
    err.textContent = "";
    overlay.classList.add("is-open");
    input.focus();
  }
  function closeCalModal() { $("calModalOverlay").classList.remove("is-open"); }
  function saveCalModal() {
    const input = $("calModalInput"), err = $("calModalErr");
    const urls = input.value.split("\n").map((l) => l.trim().replace(/^webcal:\/\//i, "https://")).filter(Boolean);
    const bad = urls.filter((u) => !/^https:\/\//i.test(u));
    if (bad.length) { err.textContent = `Not a valid https:// URL: "${bad[0].slice(0, 40)}"`; return; }
    localStorage.setItem(CAL_KEY, JSON.stringify(urls));
    localStorage.removeItem("dash-calendar-url");
    closeCalModal();
    loadCalendar();
  }
  function initCalModal() {
    const overlay = $("calModalOverlay");
    $("calModalSave").addEventListener("click", saveCalModal);
    $("calModalCancel").addEventListener("click", closeCalModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeCalModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) closeCalModal();
    });
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
    initCalModal();
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
    // Bar modules (weather/markets) open on hover via CSS; clicking toggles
    // them too so they work on touch. Clicking anywhere else closes them.
    document.querySelectorAll(".bar-module").forEach((m) => {
      m.addEventListener("click", (e) => {
        if (e.target.closest("a, button")) return; // don't hijack edit links
        m.classList.toggle("is-open");
      });
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".bar-module"))
        document.querySelectorAll(".bar-module.is-open").forEach((m) => m.classList.remove("is-open"));
    });
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
