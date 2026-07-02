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
  // Used as the home-base timezone/greeting (clock always shows this city's
  // time) and as the weather fallback. Find lat/lon at latlong.net.
  location: {
    label: "Budapest",
    lat: 47.4979,
    lon: 19.0402,
    timezone: "Europe/Budapest",
    units: "metric", // "metric" (°C, km/h) or "imperial" (°F, mph)
    // When true, the Weather card asks the browser for your actual GPS/IP
    // location and shows weather there instead of the preset above (falls
    // back to the preset if permission is denied or unavailable). The clock
    // and greeting always stay on the preset timezone above regardless.
    autoDetect: true,
  },

  // ---- CORS proxy ----------------------------------------------------------
  // Several data sources (RSS news, ICS calendars, some stock APIs) do not
  // send CORS headers, so the browser blocks direct fetches. We route those
  // through a proxy. The default is a public proxy — fine for personal use,
  // but for reliability host your own (see CLAUDE.md → "Self-hosted proxy").
  // The "{url}" token is replaced with the URL-encoded target.
  //
  // ACTIVE: your own private Cloudflare Worker proxy — fast, reliable, not
  // rate-limited. Requires a one-time deploy: `cd proxy && npx wrangler deploy`.
  // (Fallback: the public allorigins proxy below works with zero deploy but is
  // slow and frequently down/rate-limited — swap the two lines to use it.)
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

  // ---- Portfolio -----------------------------------------------------------
  // ⚠️ PUBLIC: this repo is public (the live page is behind Cloudflare Access,
  // but the repo on GitHub is not), so these numbers are readable by anyone.
  // The owner explicitly chose to commit them for convenience. A per-browser
  // private override exists via "＋ holdings" on the Markets card
  // (localStorage, wins over this) — submit an empty list there to fall back
  // to these committed values. `cash` is added to the total, excluded from P/L.
  portfolio: {
    currency: "USD",
    cash: 4008.00,
    holdings: [
      { symbol: "NVDA", shares: 40, cost: 30.46 },
      { symbol: "MSFT", shares: 4,  cost: 336.80 },
    ],
  },

  // ---- News ----------------------------------------------------------------
  // Custom-topic headlines: each `topics` entry becomes a Google News search
  // feed (keyless — Google ranks by relevance/recency), merged, sorted by
  // recency ("breaking" titles float to the top), capped at maxItems total.
  // Edit topics freely — anything you'd type into Google News search works
  // ("Formula 1", "OpenAI", "Budapest transit", '"Nvidia" earnings', …).
  // `feeds` also still takes plain RSS/Atom `{ name, url }` entries — but any
  // new hostname must be added to ALLOWED_HOSTS in proxy/worker.js + redeploy
  // (news.google.com, BBC, Al Jazeera, NPR are already allowlisted).
  news: {
    enabled: true,
    maxItems: 5,
    refreshMinutes: 15,
    topics: ["Formula 1", "artificial intelligence", "world news"],
    feeds: [],
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
  // Calendars are managed ON THE PAGE (click "manage" on the Today card):
  // add/edit/show-hide/remove any number of feeds, each with its own colour.
  // The list is stored server-side (Workers KV via /api/calendars, behind the
  // Cloudflare Access login — safe for secret Google iCal URLs, and it
  // follows you across browsers), with a localStorage fallback if the server
  // store is unreachable. `url`/`feeds` below are only BOOTSTRAP SEEDS:
  // imported into the store on the very first run, then managed on the page
  // like everything else (removing one there won't resurrect it from here).
  // Shown as three cards — Today / Tomorrow / This week (the 5 days after
  // tomorrow). `maxItems` caps events per card.
  calendar: {
    enabled: true,
    maxItems: 7,
    refreshMinutes: 30,
    url: "",
    // Bootstrap seed feeds (see note above — only used on the very first run).
    // `tv-shows.ics` is a committed *snapshot* of the pogdesign TV calendar,
    // NOT live/auto-updating: `/cat/view/<user>` (the browsable page) 500s
    // when fetched as a feed. Re-export from pogdesign.co.uk/cat and
    // overwrite tv-shows.ics when tracked shows change, or swap in the real
    // "Calendar Feed" export URL via the on-page manager to go live again.
    feeds: ["tv-shows.ics"],
  },

  // ---- To Do (Microsoft To Do) ----------------------------------------------
  // Shows an open-task-count pill in the top bar, backed by Microsoft Graph
  // (server-side, /api/todos — see CLAUDE.md for the one-time connection
  // bootstrap). Leave listName empty to use the account's default list
  // ("Tasks"); set it to target a specific named list instead (e.g. "Groceries").
  todo: {
    listName: "",
  },

  // ---- Theme ---------------------------------------------------------------
  // "auto" follows your OS; "dark" / "light" force a mode. Toggle anytime
  // with the button in the header (the choice is remembered).
  theme: "auto",
};
