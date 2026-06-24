# CLAUDE.md

Guidance for Claude (Desktop, Code, or web) and humans working in this repo.
This file is the **single source of truth** — if you're picking this up fresh,
read the "Pick up here" section first, then the rest fills in the details.

---

## ⭐ Pick up here (current state & next actions)

**What this repo is:** a personal browser **start page** — a minimalist dashboard
with live widgets (weather, markets, news, sports, calendar, links, clock,
search). Zero build step: plain HTML/CSS/JS, no framework, no dependencies.
Open `index.html` and it runs.

**Status:** ✅ Built and merged to `master`. The page works today.

**Two things left to do (both require the owner's accounts — Claude can't do them
from a sandbox):**

1. **Deploy the CORS proxy Worker** (needed for News, Calendar, Markets — Weather
   and Sports work without it). On the owner's machine:
   ```bash
   cd proxy
   npx wrangler login      # one-time browser auth to Cloudflare
   npx wrangler deploy
   ```
   This publishes a **separate** Worker named `personal-dash-proxy` to
   `https://personal-dash-proxy.adam-berczi.workers.dev/` — the URL `config.js`
   already points at. It does **not** touch the existing `gamebook-platform`
   Worker. *(No-deploy alternative: uncomment the `api.allorigins.win` fallback
   line in `config.js` — works instantly, but slower/rate-limited.)*

2. **Enable GitHub Pages** to go live: repo **Settings → Pages → Deploy from
   branch → `master` / root**. Page will be at
   `https://adamberczi.github.io/adamrepo/`. Then set it as the browser
   home/new-tab page.

**Most likely next requests:** add/remove widgets, restyle, add stocks/feeds/
teams, wire the calendar. All of that = edit `config.js` (see "Common edits").

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
  `--up`/`--down`, `--radius`, …). One accent colour; keep it minimal. New
  widgets follow the `.card` / `.card__head` / `.card__body` markup pattern.
- **Theme.** `[data-theme="dark|light"]` on `<html>`, persisted in
  `localStorage["dash-theme"]`; `"auto"` follows the OS.

## Data sources (and their quirks)

- **Weather — Open-Meteo.** No key, CORS-friendly, called directly. Reliable.
- **Sports — ESPN public API** (`site.api.espn.com/.../scoreboard`). No key,
  CORS-enabled, called directly.
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
proxy returns 403 for that host. Current allowlist: Yahoo Finance, BBC, The
Verge, Hacker News (hnrss.org), Google Calendar.

No-deploy alternative: uncomment the `api.allorigins.win` line in `config.js`.

## Common edits (all in `config.js` unless noted)

- **Add a stock:** push a Yahoo symbol to `stocks.symbols` (suffixes: `.BU`
  Budapest, `.L` London, `.DE` Frankfurt; crypto like `BTC-USD`). If it's a new
  host it still goes through `query1.finance.yahoo.com`, already allowlisted.
- **Add a news feed:** add `{ name, url }` to `news.feeds`, **then add the feed's
  hostname to `ALLOWED_HOSTS` and redeploy the proxy.**
- **Add a sports league:** add `{ name, path, team }` to `sports.leagues`. `path`
  is the ESPN slug — `soccer/eng.1` (Premier League), `soccer/uefa.champions`,
  `soccer/hun.1` (NB I.), `basketball/nba`, `football/nfl`, `hockey/nhl`,
  `baseball/mlb`. `team` is a substring used to highlight your club. No proxy
  change needed (ESPN is direct).
- **Connect the calendar:** Google Calendar → Settings → "Integrate calendar" →
  "Secret address in iCal format" → paste into `calendar.url`. (`calendar.google.com`
  is already allowlisted.)
- **Change location:** edit `location` (lat/lon from latlong.net, IANA
  `timezone`, `units: "metric" | "imperial"`).
- **Add a quick link:** add `{ name, url }` to `links`.

## Testing changes

No test suite — verify in a browser. `fetch`/CORS behave differently on
`file://`, so prefer a local server:
```bash
python3 -m http.server 8000   # open http://localhost:8000
```
Check: no console errors; every widget loads or shows its fail message; theme
toggle works; layout holds at mobile width.

## Deployment

GitHub Pages serves the repo root on `master`. Merge a feature branch to
`master` to publish. The proxy is deployed separately via wrangler (above).
