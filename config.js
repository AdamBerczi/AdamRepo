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
  // ACTIVE: public allorigins proxy — works with zero deploy (slower, public,
  // can be rate-limited). To switch to your own private/fast Worker, deploy it
  // (`cd proxy && npx wrangler deploy`) and swap the two lines below.
  corsProxy: "https://api.allorigins.win/raw?url={url}",
  // corsProxy: "https://personal-dash-proxy.adam-berczi.workers.dev/?url={url}",

  // ---- Stocks --------------------------------------------------------------
  // Add ticker symbols you want to watch. For non-US exchanges use the Yahoo
  // suffix (e.g. "OTP.BU" Budapest, "BMW.DE" Frankfurt, "SHEL.L" London).
  stocks: {
    enabled: true,
    symbols: ["AAPL", "MSFT", "NVDA", "TSLA", "OTP.BU", "BTC-USD"],
    refreshMinutes: 5,
  },

  // ---- Portfolio -----------------------------------------------------------
  // ⚠️ PUBLIC: this repo/site is public, so anything here is visible to anyone.
  // Committed holdings shown in the Markets/Portfolio card. Live prices are
  // fetched; you only specify shares + average cost per share. Optional `cash`
  // is added to the total value. (A private alternative is to leave `holdings`
  // empty and enter them on the page via "＋ holdings" — that stays in your
  // browser's localStorage and is never committed; localStorage overrides this.)
  portfolio: {
    currency: "USD",
    cash: 4008.00,
    holdings: [
      { symbol: "MSFT", shares: 4,  cost: 336.80 },
      { symbol: "NVDA", shares: 40, cost: 30.46 },
    ],
  },

  // ---- News ----------------------------------------------------------------
  // English-language breaking / important headlines. These are top-story /
  // front-page feeds (editorially curated for importance), merged and sorted by
  // recency; items whose title contains "breaking" are floated to the top.
  // Any RSS/Atom URL works — but add its hostname to ALLOWED_HOSTS in
  // proxy/worker.js (and redeploy) or the proxy returns 403.
  news: {
    enabled: true,
    maxItems: 9,
    refreshMinutes: 15,
    feeds: [
      { name: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml" },          // Top stories
      { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
      { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },              // Top stories
    ],
  },

  // ---- Formula 1 -----------------------------------------------------------
  // Next race + drivers' championship via the Jolpica (Ergast) API. Keyless,
  // CORS-enabled, no proxy needed. NB: F1 *Fantasy* has no free public API, so
  // this shows official standings/schedule, not fantasy prices/points.
  f1: {
    enabled: true,
    refreshMinutes: 60,
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
    // Public/non-secret .ics URLs (strings). Relative paths are served from this
    // site (no proxy); cross-origin feeds go through the proxy. This is the live
    // pogdesign TV calendar (auto-updating; /cat/view/<user> is the iCal feed).
    feeds: ["https://www.pogdesign.co.uk/cat/view/AdamCorvus"],
  },

  // ---- Theme ---------------------------------------------------------------
  // "auto" follows your OS; "dark" / "light" force a mode. Toggle anytime
  // with the button in the header (the choice is remembered).
  theme: "auto",
};
