# CLAUDE.md

Guidance for Claude (Desktop, Code, or web) and humans working in this repo.
This file is the **single source of truth** — if you're picking this up fresh,
read the "Pick up here" section first, then the rest fills in the details.

---

## ⭐ Pick up here (current state & next actions)

**What this repo is:** a personal browser **start page** — a minimalist dashboard
with live widgets (weather, markets/portfolio, news, calendar, Formula 1, clock).
Zero build step: plain HTML/CSS/JS, no framework, no dependencies.
Open `index.html` and it runs.

**Status:** ✅ **Live in production.** Merged to `master` and published via
GitHub Pages at **https://adamberczi.github.io/AdamRepo/** (Pages is enabled,
serving `master` / root). Current look: a dynamic time-of-day + weather **scene**
background with **glassmorphic** widgets, hero clock, serif-italic greeting.
Features include weather, a markets watchlist that becomes a **portfolio**
tracker (value + day change + gain/loss), breaking news, a multi-feed calendar
(incl. live pogdesign TV), and a Formula 1 card (next race, qualifying countdown,
standings tabs). The owner reviews changes on the live site and iterates.

**Workflow:** develop on a feature branch → merge to `master` → push. Pages
auto-deploys in ~1 min (hard-refresh `Ctrl+Shift+R` to dodge CSS/JS caching).

**Owner-only actions left** (the page works without these — Weather + F1
need nothing; News, Markets, Calendar use the proxy):

1. **Deploy the CORS proxy Worker.** On the owner's machine:
   ```bash
   cd proxy
   npx wrangler login      # one-time browser auth to Cloudflare
   npx wrangler deploy
   ```
   Publishes a **separate** Worker `personal-dash-proxy` to
   `https://personal-dash-proxy.adam-berczi.workers.dev/` — the URL `config.js`
   already points at. Does **not** touch the existing `gamebook-platform`
   Worker. *(No-deploy alternative: uncomment the `api.allorigins.win` fallback
   line in `config.js`.)*

2. **Lock the site down to the owner only, via Cloudflare Access.** The
   GitHub Pages site is currently public (anyone with the URL can view it —
   there's no server to gate access, and any client-side password would be
   readable straight out of the public repo). Decided approach: move hosting
   to **Cloudflare Pages** (same static files, no build step) and put
   **Cloudflare Access** in front of it, restricted to `adam.berczi@gmail.com`
   only. This requires the Cloudflare dashboard (login + a couple of clicks
   Claude can't do from here) — one-time setup:
   1. **Workers & Pages → Create → Pages → Connect to Git** → select
      `adamberczi/adamrepo` → build settings: no build command, output
      directory `/` (repo root, since there's no build step) → Save and
      Deploy. Gives a `*.pages.dev` URL and auto-deploys on every push to
      `master`, same as Pages does today.
   2. **Zero Trust dashboard → set up a team domain** (one-time, free tier —
      50 seats). Then **Access → Applications → Add an application →
      Self-hosted** → application domain = the `*.pages.dev` URL from step 1
      → **policy**: Allow, Include → Emails → `adam.berczi@gmail.com` only.
      Visitors now get a Cloudflare one-time-PIN email login before seeing
      anything; only that address can pass.
   3. **Turn off GitHub Pages** (repo Settings → Pages → set Source to
      "None") once the Cloudflare Pages + Access URL is confirmed working, so
      the old public unauthenticated copy stops serving.
   4. Update the **Status** line below and the **Deployment** section with
      the new `*.pages.dev` URL once live.

**Per-device setup the owner does in the browser (secrets never committed):**
- **Calendar:** click "＋ Connect calendar" → paste secret iCal URLs, one per
  line (Google + pogdesign TV supported; stored in
  `localStorage["dash-calendar-urls"]`).
- **Portfolio:** click "＋ holdings" in the Markets card → paste
  `SYMBOL SHARES [AVG_COST]` lines (stored in `localStorage["dash-portfolio"]`).

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
- GitHub repo: `adamberczi/adamrepo`; site repo root served by Pages on `master`.
- Cloudflare account subdomain: `adam-berczi` (`*.adam-berczi.workers.dev`).
  An unrelated Worker `gamebook-platform` already exists there — **do not modify
  or overwrite it.** The proxy here is a deliberately separate Worker.
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
- **Formula 1 — Jolpica/Ergast** (`api.jolpi.ca/ergast/f1/...`). No key,
  CORS-enabled, called directly. Shows the next race, a live **countdown to
  qualifying** (1s ticker, `updateQualiCountdown`), and **Drivers/Constructors**
  standings tabs with team-colour icons (`F1_TEAM` map). The card is
  double-width (`.card--f1` span 4) with a two-column `.f1-grid`. (F1 *Fantasy*
  has no free public API — official needs login, the community scrape is stale;
  only paid APIs cover fantasy prices/points.)
- **News (RSS), Calendar (.ics), Markets (Yahoo Finance)** do **not** send CORS
  headers, so they are routed through `CFG.corsProxy` (the Cloudflare Worker).

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
    holdings:[{symbol,shares,cost}] }`. ⚠️ The repo/site is public, so this
    exposes the portfolio. `cash` is added to the displayed total but excluded
    from gain/loss.
  With avg cost it computes total gain/loss; without it, just value + day change.
  Mixed currencies are summed per-currency. Uses the Yahoo quote feed (via proxy).
- **Add a news feed:** add `{ name, url }` to `news.feeds`, **then add the feed's
  hostname to `ALLOWED_HOSTS` and redeploy the proxy.** News is set to
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
- **Change location:** edit `location` (lat/lon from latlong.net, IANA
  `timezone`, `units: "metric" | "imperial"`).

## Testing changes

No test suite — verify in a browser. `fetch`/CORS behave differently on
`file://`, so prefer a local server:
```bash
python3 -m http.server 8000   # open http://localhost:8000
```
Check: no console errors; every widget loads or shows its fail message; theme
toggle works; layout holds at mobile width.

## Deployment

Currently: GitHub Pages serves the repo root on `master` (public, no auth).
Merge a feature branch to `master` to publish. The proxy is deployed
separately via wrangler (above).

**In progress:** migrating hosting to **Cloudflare Pages** with **Cloudflare
Access** gating it to `adam.berczi@gmail.com` only — see the owner-only
action above. Once cut over: push to `master` → Cloudflare Pages
auto-deploys the `*.pages.dev` URL → Access challenges every visitor with an
email OTP and only lets the owner's address through. GitHub Pages gets
turned off at that point so there's no unauthenticated copy left live. No
code changes are needed for the migration itself — `index.html` only uses
relative asset paths, so it serves the same from repo root under either
host.
