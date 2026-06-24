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
    }
  }

  /* ========================================================================
   * Search — DuckDuckGo with bang shortcuts (!g google, !yt youtube, etc.)
   * ======================================================================*/
  function initSearch() {
    const bangs = {
      g: "https://www.google.com/search?q=",
      yt: "https://www.youtube.com/results?search_query=",
      gh: "https://github.com/search?q=",
      w: "https://en.wikipedia.org/w/index.php?search=",
      maps: "https://www.google.com/maps/search/",
    };
    $("searchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      let q = $("searchInput").value.trim();
      if (!q) return;
      const m = q.match(/^!(\w+)\s+(.*)/);
      if (m && bangs[m[1]]) { location.href = bangs[m[1]] + encodeURIComponent(m[2]); return; }
      if (/^https?:\/\//.test(q) || /^[\w-]+\.\w{2,}($|\/)/.test(q)) {
        location.href = /^https?:\/\//.test(q) ? q : "https://" + q; return;
      }
      location.href = "https://duckduckgo.com/?q=" + encodeURIComponent(q);
    });
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
      const tU = imperial ? "°F" : "°C", wU = imperial ? "mph" : "km/h";
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
  async function loadStocks() {
    const body = $("stocksBody"), cfg = CFG.stocks || {};
    if (!cfg.enabled || !cfg.symbols?.length) { $("stocksCard").style.display = "none"; return; }
    try {
      const url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
        encodeURIComponent(cfg.symbols.join(","));
      const d = await getJSON(url, { useProxy: true });
      const rows = d?.quoteResponse?.result || [];
      if (!rows.length) throw new Error("no data");
      body.innerHTML = rows.map((q) => {
        const chg = q.regularMarketChangePercent ?? 0;
        const cls = chg >= 0 ? "up" : "down";
        const arrow = chg >= 0 ? "▲" : "▼";
        const price = q.regularMarketPrice != null ? fmtMoney(q.regularMarketPrice) : "—";
        const cur = q.currency && q.currency !== "USD" ? " " + q.currency : "";
        return `<div class="tick">
          <div><div class="tick__sym">${esc(q.symbol)}</div>
            <div class="tick__name">${esc((q.shortName || "").slice(0, 22))}</div></div>
          <div class="tick__right">
            <div class="tick__price">${price}${cur}</div>
            <div class="tick__chg ${cls}">${arrow} ${Math.abs(chg).toFixed(2)}%</div>
          </div></div>`;
      }).join("");
      $("stocksSub").textContent = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      fail(body, "Markets unavailable. The stock source may be rate-limited; see CLAUDE.md for alternatives.");
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
  async function loadCalendar() {
    const body = $("calendarBody"), cfg = CFG.calendar || {};
    if (!cfg.enabled) { $("calendarCard").style.display = "none"; return; }
    if (!cfg.url) {
      body.innerHTML = `<div class="skeleton">Add your calendar's secret iCal URL in <b>config.js</b> to see upcoming events.</div>`;
      return;
    }
    try {
      const text = await getText(cfg.url, { useProxy: true });
      const now = new Date();
      const events = parseICS(text)
        .filter((e) => e.start && e.start.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        .sort((a, b) => a.start.date - b.start.date)
        .slice(0, cfg.maxItems || 6);
      if (!events.length) { body.innerHTML = `<div class="skeleton">No upcoming events.</div>`; return; }
      body.innerHTML = events.map((e) => {
        const d = e.start.date;
        const time = e.start.allDay ? "All day"
          : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        return `<div class="evt">
          <div class="evt__date"><b>${d.getDate()}</b><span>${d.toLocaleDateString(undefined, { month: "short" })}</span></div>
          <div class="evt__body">${esc(e.summary || "(untitled)")}
            <div class="evt__time">${time}${e.location ? " · " + esc(e.location.slice(0, 30)) : ""}</div></div>
        </div>`;
      }).join("");
    } catch (e) {
      fail(body, "Calendar unavailable. Confirm the iCal URL and proxy in config.js.");
    }
  }

  /* ========================================================================
   * Links
   * ======================================================================*/
  function loadLinks() {
    const body = $("linksBody"), links = CFG.links || [];
    if (!links.length) { $("linksCard").style.display = "none"; return; }
    body.innerHTML = links.map((l) =>
      `<a class="link" href="${esc(l.url)}"><span class="link__dot"></span>${esc(l.name)}</a>`).join("");
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
    initTheme(); initSearch(); loadLinks();
    tickClock(); setInterval(tickClock, 1000 * 15);
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
