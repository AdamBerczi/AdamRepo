# CLAUDE.md

Guidance for Claude (Desktop, Code, or web) and humans working in this repo.
This file is the **single source of truth** — if you're picking this up fresh,
read the "Pick up here" section first, then the rest fills in the details.

---

## ⭐ Pick up here (current state & next actions)

**What this repo is:** a personal browser **start page** — a minimalist dashboard
with live widgets (weather, markets/portfolio, a 3-card calendar, Formula 1, clock;
news exists but is currently disabled). Zero build step: plain HTML/CSS/JS, no
framework, no dependencies. Open `index.html` and it runs.

**Status:** ✅ **Live in production, owner-only.** Hosted on **Cloudflare
Workers (static assets)** at **https://home.adam-berczi.workers.dev/**, gated
by **Cloudflare Access** restricted to `adam.berczi@gmail.com` (email
one-time-PIN login required before the page loads). The old public GitHub
Pages copy (`https://adamberczi.github.io/AdamRepo/`) is being turned off.
Current look: a dynamic time-of-day + weather **scene** background with
**glassmorphic** widgets, hero clock, serif-italic greeting. Features include
weather (geolocation-based, falls back to the Budapest preset), a markets
watchlist that becomes a **portfolio** tracker (value + day change +
gain/loss), a multi-feed calendar (incl. live pogdesign TV) split across
**three cards — Today / Tomorrow / This week**, and a Formula 1 card (next
race, qualifying countdown, standings tabs). News is built but **disabled**
(`news.enabled: false` in `config.js`) — flip it back on to bring it back.
The owner reviews changes on the live site and iterates.

**Workflow:** develop on a feature branch → merge to `master` → push.
Cloudflare auto-deploys the Worker in ~1 min (hard-refresh `Ctrl+Shift+R` to
dodge CSS/JS caching). Since the site now requires an Access login, the owner
verifies changes after signing in with the OTP email.

**Owner-only actions left** (the page works without these — Weather + F1
need nothing; Markets and Calendar use the proxy, and News would too if
re-enabled):

1. **Deploy the CORS proxy Worker.** On the owner's machine:
   ```bash
   cd proxy
   npx wrangler login      # one-time browser auth to Cloudflare
   npx wrangler deploy
   ```
   Publishes a **separate** Worker `personal-dash-proxy` to
   `https://personal-dash-proxy.adam-berczi.workers.dev/` — the URL `config.js`
   already points at. Does **not** touch the existing `gamebook-platform`
   Worker (or the `home` Worker serving the site itself).
   *(No-deploy alternative: uncomment the `api.allorigins.win` fallback line
   in `config.js`.)*

**Per-device setup the owner does in the browser (secrets never committed):**
- **Calendar:** click "＋ Connect calendar" (on the **Today** card) → paste
  secret iCal URLs, one per line (Google + pogdesign TV supported; stored in
  `localStorage["dash-calendar-urls"]`). One shared connection feeds all
  three calendar cards.
- **Portfolio:** click "＋ holdings" in the Markets card → paste
  `SYMBOL SHARES [AVG_COST]` lines (stored in `localStorage["dash-portfolio"]`).
  `config.js` ships with an empty committed portfolio on purpose (public repo)
  — real holdings only ever live in this per-browser localStorage.
- **Weather location:** the browser will prompt for location permission on
  first load; allow it for weather where you actually are. Deny/ignore it and
  the card silently falls back to the `location` preset in `config.js`
  (Budapest). Set `location.autoDetect: false` to always use the preset and
  skip the prompt entirely.

**Most likely next requests:** design tweaks from live feedback (scene palettes,
glass intensity, type, layout), add/remove widgets, add stocks/feeds/teams.
Most content changes = edit `config.js` (see "Common edits"); design = `styles.css`
+ `sceneFor` in `app.js`.

---

## File map

| File                 | Purpose                                                              |
|----------------------|---------------------------------------------------------------------|
| `index.html`         | Markup + empty widget "shells" filled in by JS                      |
| `styles.css`         | Design tokens (CSS vars), responsive grid, components, dark/light    |
| `app.js`             | All widget logic. One self-contained function per widget            |
| `config.js`          | **User-editable settings only.** No logic — just data               |
| `proxy/worker.js`    | Cloudflare CORS proxy with a host allowlist                         |
| `proxy/wrangler.toml`| Deploy config for the proxy Worker (`personal-dash-proxy`)          |
| `PLAN.md`            | Design rationale, layout mockup, data-source table                  |
| `CLAUDE.md`          | This file                                                            |

## Owner / environment facts

- Owner: Adam (email `adam.berczi@gmail.com`).
- Location preset: **Budapest** (lat 47.4979, lon 19.0402, `Europe/Budapest`, metric).
- GitHub repo: `adamberczi/adamrepo`; `master` is the deploy branch (Cloudflare
  builds the site Worker from it; GitHub Pages, formerly also serving `master`,
  is being turned off).
- Cloudflare account subdomain: `adam-berczi` (`*.adam-berczi.workers.dev`).
  Two Workers used by this project: `home` (the site itself, static assets,
  gated by Cloudflare Access) and `personal-dash-proxy` (the CORS proxy,
  below). An unrelated Worker `gamebook-platform` already exists on the
  account too — **do not modify or overwrite it.**
- Dev happens on feature branches; merge to `master` to publish.

## Architecture & conventions

- **No build step.** Do not add npm packages, bundlers, TypeScript, or frameworks
  unless explicitly asked. The whole value is that it's instant and dependency-free.
- **Fail-soft widgets.** Every widget catches its own errors and renders a short
  message via `fail(el, msg)`. One broken data source must never blank the page.
  Wrap any new fetch in try/catch and follow this pattern.
- **Config-driven.** Anything a user might change (symbols, feeds, teams, coords,
  links, theme) lives in `config.js`, read via `window.DASH_CONFIG`. Never
  hardcode personal data in `app.js`.
- **Escape untrusted strings.** Feed/API text is injected with `innerHTML`, so
  pass it through `esc()` first (done throughout). Keep doing this.
- **Styling.** Use existing CSS custom properties (`--accent`, `--text-dim`,
  `--up`/`--down`, `--radius`, glass tokens `--glass-bg`/`--glass-border`/
  `--glass-hi`, …). New widgets follow the `.card` / `.card__head` / `.card__body`
  pattern and inherit the glass surface automatically (the glass declarations are
  shared on `.card, .search__input, .ghost-btn, .link`).
- **Dynamic scene.** The `.scene` layer (in `index.html`) holds a **sun**,
  drifting **clouds**, and a **mountain ridge** SVG, over a layered gradient
  driven by `--scene-1..3` + `--accent`. `app.js → applyScene()` sets those
  colors from time of day (`sceneFor`) and the live weather code, positions the
  sun by hour (`--sun-x/--sun-y`), and sets `body[data-sky="clear|partly|cloudy|
  rain|night"]` which CSS uses to show/hide the sun and clouds. Colors are
  registered with `@property` so everything cross-fades. Edit palettes/tints in
  `sceneFor`. Don't hardcode a flat background.
- **Chrome.** No search bar or links grid. A fixed glass **top bar** (brand +
  serif greeting on the left; weather, clock, date, theme toggle on the right)
  and a **bottom taskbar** (brand left; updated-time + refresh right) frame the
  widget grid, taskbar-style.
- **Theme.** `[data-theme="dark|light"]` on `<html>`, persisted in
  `localStorage["dash-theme"]`; `"auto"` follows the OS. Dark = full scene +
  glass; light = a clean light variant (the accent still follows time of day).
- **Fonts.** Inter (UI) + Instrument Serif (the italic greeting) loaded from
  Google Fonts in `index.html`, with system fallbacks if offline.

## Data sources (and their quirks)

- **Weather — Open-Meteo.** No key, CORS-friendly, called directly. Reliable.
  Prefers the browser's own geolocation (`getGeoCoords()`) over the
  `location` preset in `config.js`; falls back silently on denial/timeout/
  unsupported browsers (`location.autoDetect: false` disables the prompt
  entirely). When geolocation succeeds, the card's location label comes from
  a best-effort reverse-geocode via **BigDataCloud's client-reverse-geocode**
  endpoint (no key, CORS-enabled, built for client-side use — fails soft to
  "My location" if it errors). The **clock/greeting always stay on the
  `location.timezone` preset** regardless of detected weather location —
  that's your home-base time, not wherever the browser happens to be.
- **Formula 1 — Jolpica/Ergast** (`api.jolpi.ca/ergast/f1/...`). No key,
  CORS-enabled, called directly. Shows the next race, a live **countdown to
  qualifying** (1s ticker, `updateQualiCountdown`), and **Drivers/Constructors**
  standings tabs with team-colour icons (`F1_TEAM` map). The card is
  full-width (`.card--f1` span 6, its own row above the calendar row) with a
  two-column `.f1-grid`. (F1 *Fantasy* has no free public API — official
  needs login, the community scrape is stale; only paid APIs cover fantasy
  prices/points.)
- **Calendar (.ics) — three cards.** `loadCalendar()` fetches every connected
  feed once, merges the events, **expands recurring ones** (see below), then
  buckets them by local day boundary into **Today** / **Tomorrow** / **This
  week** (the 5 days after tomorrow) and renders each bucket into its own
  card via the shared `renderEvents()` helper. All three sit together in one
  row below the full-width F1 card (`.card--cal` span 2 × 3 = 6), so they get
  equal height automatically from the grid's default row-stretch — no
  explicit height CSS needed, just keep them in the same DOM row.
  `calendar.maxItems` caps events *per card*, not globally. The "＋ Connect
  calendar" / "edit" control only lives on the Today card (one shared URL
  list feeds all three); the other two only show a subtitle (date / date
  range) and their own empty-state message.
  - **Recurring events (RRULE).** `parseICS` now also captures `RRULE` and
    `EXDATE`. Most Google Calendar entries are recurring, and their `DTSTART`
    is just the *first-ever* occurrence (often long past) — without
    expansion they'd never pass the "is this upcoming?" filter and would
    silently never appear, which was exactly the "calendar shows empty but
    there are events" bug. `expandRecurrence()` (in `app.js`, near
    `parseICSDate`) is a **minimal** RFC 5545 engine: `DAILY`/`WEEKLY`/
    `MONTHLY`/`YEARLY` with `INTERVAL`, `COUNT`, `UNTIL`, and `BYDAY` (for
    weekly) — covers the common Google Calendar patterns, not the full spec
    (no `BYMONTHDAY`/`BYSETPOS`/etc.). Only expands within the display
    window (today → +7 days), so it stays fast even for years-old series.
- **News (RSS), Calendar (.ics), Markets (Yahoo Finance)** do **not** send CORS
  headers, so they are routed through `CFG.corsProxy` (the Cloudflare Worker).
  (News is currently disabled — see Status above — but the code/proxy path
  is untouched so re-enabling is a one-line `config.js` flip.)

### The CORS proxy (`/proxy`)

`proxy/worker.js` reads `?url=`, fetches the target, and returns it with
`Access-Control-Allow-Origin: *` — but **only for hostnames in its
`ALLOWED_HOSTS` allowlist**, so it can't be abused as an open proxy.

Deploy / update:
```bash
cd proxy && npx wrangler login && npx wrangler deploy
```
It deploys as the separate Worker `personal-dash-proxy` (see `wrangler.toml`) and
touches nothing else on the account.

⚠️ **When you add a new news feed, calendar, or stock source to `config.js`, also
add its hostname to `ALLOWED_HOSTS` in `proxy/worker.js` and redeploy**, or the
proxy returns 403 for that host. Current allowlist: Yahoo Finance, BBC,
Al Jazeera, NPR, The Verge, Hacker News (hnrss.org), Google Calendar,
pogdesign.co.uk (TV calendar).

No-deploy alternative: uncomment the `api.allorigins.win` line in `config.js`.

## Common edits (all in `config.js` unless noted)

- **Add a stock (watchlist):** push a Yahoo symbol to `stocks.symbols` (suffixes:
  `.BU` Budapest, `.L` London, `.DE` Frankfurt; crypto like `BTC-USD`). Quotes
  come from Yahoo's **v8 `/finance/chart`** endpoint (`fetchQuotes`, one request
  per symbol, via the proxy) — not the old v7 `/finance/quote`, which now needs a
  session crumb and 401s for keyless calls. Host `query1.finance.yahoo.com` is
  allowlisted. The watchlist shows only when no portfolio holdings are set.
- **Portfolio:** two sources, localStorage wins over committed config.
  - *Private (per browser):* on the page the Markets/Portfolio card shows
    "＋ holdings" / "edit" — paste `SYMBOL SHARES [AVG_COST]` lines (e.g.
    `AAPL 10 150.25`). Stored in `localStorage["dash-portfolio"]`, never committed.
  - *Committed (public):* `CFG.portfolio` in `config.js` — `{ currency, cash,
    holdings:[{symbol,shares,cost}] }`. ⚠️ The repo/site is public, so anything
    put here is visible to anyone browsing the repo on GitHub — **left empty
    by default** (`holdings: [], cash: 0`) for exactly that reason. Real
    numbers belong in the private localStorage form above. `cash` (if you do
    commit it) is added to the displayed total but excluded from gain/loss.
  With avg cost it computes total gain/loss; without it, just value + day change.
  Mixed currencies are summed per-currency. Uses the Yahoo quote feed (via proxy).
- **News (currently disabled, `news.enabled: false`):** add `{ name, url }` to
  `news.feeds`, **then add the feed's hostname to `ALLOWED_HOSTS` and redeploy
  the proxy.** Set `enabled: true` to bring the card back. News is set to
  English breaking/important top-story feeds (BBC, Al Jazeera, NPR); titles
  containing "breaking" are floated to the top and get a Breaking badge.
- **Connect calendars (multi-feed):** events from all feeds are merged, sorted,
  and tagged by source. Two ways to add feeds:
  - *Committed (public):* `calendar.feeds` in `config.js` — array of .ics URL
    strings. The live **pogdesign TV** calendar is here
    (`https://www.pogdesign.co.uk/cat/view/<user>` is the iCal feed, auto-updating;
    host allowlisted). Relative paths (e.g. `something.ics` in the repo) are
    fetched same-origin with no proxy; cross-origin feeds use the proxy
    (`calNeedsProxy`).
  - *Private (per browser):* secret iCal URLs (e.g. a Google "Secret address in
    iCal format") go on the page via "＋ Connect calendar", one per line — stored
    in `localStorage["dash-calendar-urls"]`, never committed. Any new host still
    needs adding to `ALLOWED_HOSTS` if you later switch off allorigins.
- **Change home-base location:** edit `location` (lat/lon from latlong.net,
  IANA `timezone`, `units: "metric" | "imperial"`). This is the clock/greeting
  timezone and the weather fallback. `location.autoDetect` (default `true`)
  controls whether Weather asks the browser for your real location instead —
  set `false` to always use this preset and skip the permission prompt.

## Testing changes

No test suite — verify in a browser. `fetch`/CORS behave differently on
`file://`, so prefer a local server:
```bash
python3 -m http.server 8000   # open http://localhost:8000
```
Check: no console errors; every widget loads or shows its fail message; theme
toggle works; layout holds at mobile width.

## Deployment

The site is served by the Cloudflare Worker `home` at
**https://home.adam-berczi.workers.dev/** (repo root as static assets, no
build step), auto-deploying on push to `master`. **Cloudflare Access** sits in
front of it, restricted to `adam.berczi@gmail.com` — every visitor gets an
email one-time-PIN challenge before the page loads; nobody else can pass.
GitHub Pages (`https://adamberczi.github.io/AdamRepo/`) formerly served the
same public copy from `master` and is being turned off (repo Settings →
Pages → Source: None), so no unauthenticated copy stays live. The CORS proxy
(`personal-dash-proxy`) is a separate Worker, deployed independently via
wrangler (above). No code changes were needed for the migration — `index.html`
only uses relative asset paths, so it serves identically from repo root under
either host.
