/* =============================================================================
 * config.js — Personal start page configuration
 * -----------------------------------------------------------------------------
 * This is the ONLY file you need to edit to personalize your home page.
 * Everything is plain data. No build step. Save and refresh the page.
 * ===========================================================================*/

window.DASH_CONFIG = {
  // ---- Identity ------------------------------------------------------------
  // Shown in the greeting. Leave name empty to hide it.
  name: "Adam",

  // ---- Location & time -----------------------------------------------------
  // Used by the weather widget and the clock. Find lat/lon at latlong.net.
  location: {
    label: "Budapest",
    lat: 47.4979,
    lon: 19.0402,
    timezone: "Europe/Budapest",
    units: "metric", // "metric" (°C, km/h) or "imperial" (°F, mph)
  },

  // ---- CORS proxy ----------------------------------------------------------
  // Several data sources (RSS news, ICS calendars, some stock APIs) do not
  // send CORS headers, so the browser blocks direct fetches. We route those
  // through a proxy. The default is a public proxy — fine for personal use,
  // but for reliability host your own (see CLAUDE.md → "Self-hosted proxy").
  // The "{url}" token is replaced with the URL-encoded target.
  //
  // Points at the dedicated proxy Worker in /proxy (deploy with
  // `cd proxy && npx wrangler deploy`). It only proxies the host allowlist in
  // proxy/worker.js. The public fallback below works without deploying anything.
  corsProxy: "https://personal-dash-proxy.adam-berczi.workers.dev/?url={url}",
  // corsProxy: "https://api.allorigins.win/raw?url={url}",

  // ---- Stocks --------------------------------------------------------------
  // Add ticker symbols you want to watch. For non-US exchanges use the Yahoo
  // suffix (e.g. "OTP.BU" Budapest, "BMW.DE" Frankfurt, "SHEL.L" London).
  stocks: {
    enabled: true,
    symbols: ["AAPL", "MSFT", "NVDA", "TSLA", "OTP.BU", "BTC-USD"],
    refreshMinutes: 5,
  },

  // ---- News ----------------------------------------------------------------
  // Any RSS/Atom feed URL works. Headlines are merged and sorted by date.
  news: {
    enabled: true,
    maxItems: 9,
    refreshMinutes: 20,
    feeds: [
      { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
      { name: "Hacker News", url: "https://hnrss.org/frontpage" },
    ],
  },

  // ---- Sports --------------------------------------------------------------
  // Powered by ESPN's public scoreboard API (no key needed). Each entry is a
  // league; the widget shows recent/live/upcoming games and highlights your
  // team. Find league slugs in CLAUDE.md → "Sports leagues".
  sports: {
    enabled: true,
    refreshMinutes: 10,
    leagues: [
      { name: "Premier League", path: "soccer/eng.1", team: "Arsenal" },
      { name: "Champions League", path: "soccer/uefa.champions", team: "" },
      { name: "NBA", path: "basketball/nba", team: "Lakers" },
    ],
  },

  // ---- Calendar ------------------------------------------------------------
  // iCal URLs are SECRET (anyone with one can read that calendar), so they are
  // NOT stored here. Connect them from the page: click "＋ Connect calendar" in
  // the Calendar card and paste one URL per line. Multiple feeds are merged —
  // e.g. a Google calendar ("Integrate calendar" → "Secret address in iCal
  // format") plus a pogdesign TV calendar (pogdesign.co.uk/cat → pick shows →
  // iCal subscribe URL). Saved only in your browser's localStorage.
  // `url`/`feeds` below are optional non-secret fallbacks — usually left empty.
  calendar: {
    enabled: true,
    maxItems: 7,
    refreshMinutes: 30,
    url: "",
    feeds: [], // optional public .ics URLs (strings) — secrets go in the page
  },

  // ---- Theme ---------------------------------------------------------------
  // "auto" follows your OS; "dark" / "light" force a mode. Toggle anytime
  // with the button in the header (the choice is remembered).
  theme: "auto",
};
