# CLAUDE.md

Guidance for Claude (Desktop, Code, or web) and humans working in this repo.
This file is the **single source of truth** — if you're picking this up fresh,
read the "Pick up here" section first, then the rest fills in the details.

---

## ⭐ Pick up here (current state & next actions)

**What this repo is:** a personal browser **start page** — a minimalist dashboard
with live widgets (weather, markets/portfolio, a 3-card calendar, Formula 1,
custom-topic news, clock). Zero build step: plain HTML/CSS/JS, no framework,
no dependencies. Open `index.html` and it runs.

**Status:** ✅ **Live in production, owner-only.** Hosted on **Cloudflare
Workers (static assets)** at **https://home.adam-berczi.workers.dev/**, gated
by **Cloudflare Access** restricted to `adam.berczi@gmail.com` (email
one-time-PIN login required before the page loads). The old public GitHub
Pages copy (`https://adamberczi.github.io/AdamRepo/`) is being turned off.
Current look: **"dusk rice"** — a moody dusk-mountain scene (charcoal sky,
dusty-rose cloud glow, near-black ridge silhouettes) behind **flat,
near-opaque charcoal panels with hairline dusty-rose borders**, monospace
(JetBrains Mono) UI type, a serif-italic greeting, and a single rose accent
plus a monkeytype-yellow data accent — modeled on a Windows rice screenshot
the owner supplied (Windhawk/yasb-style). **No glassmorphism/blur.**
Features include
weather (geolocation-based, falls back to the Budapest preset), a markets
watchlist that becomes a **portfolio** tracker (value + day change +
gain/loss), a multi-feed calendar (incl. a committed pogdesign TV snapshot)
split across **three cards — Today / Tomorrow / This week**, and a Formula 1 card (next
race, qualifying countdown, standings tabs), and **custom-topic news** (top 5,
via keyless Google News search RSS — topics set in `config.js`).
The owner reviews changes on the live site and iterates.

**Workflow:** develop on a feature branch → merge to `master` → push.
Cloudflare auto-deploys the Worker in ~1 min. ⚠️ **Whenever `app.js`,
`config.js`, or `styles.css` change, bump the `?v=N` query strings on all
three tags in `index.html`** — that's the cache-buster that guarantees
browsers/edge caches load the new bundle (stale assets once caused "my fix
isn't live" reports: old JS + old config kept rendering old bugs). Since the
site requires an Access login, the owner verifies changes after signing in
with the OTP email.

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
   in `config.js`.)* ✅ Done — deployed with the real-browser User-Agent and
   `news.google.com` allowlisted.

2. **Activate the server-side calendar store (Workers KV).** The calendar
   manager saves to `/api/calendars` on the `home` Worker (see
   `server/worker.js` + root `wrangler.toml`), but the KV namespace needs a
   one-time creation on the owner's machine, from the repo root:
   ```bash
   npx wrangler kv namespace create CALS   # prints an id
   # → uncomment [[kv_namespaces]] in wrangler.toml, paste the id, push
   ```
   Until then `/api/calendars` returns 503 and the page falls back to
   per-browser localStorage (the Today card shows a "·local" hint).
   ⚠️ Root `wrangler.toml` now exists, so pushes to `master` deploy the
   `home` Worker as code+assets. If an auto-build ever fails, check
   Cloudflare dashboard → Workers → home → Settings → Build (deploy command
   should be `npx wrangler deploy`); a local `npx wrangler deploy` from the
   repo root also works.

3. **Connect Google Calendar(s).** Click "manage" on the Today card → "＋ add
   calendar" → paste each Google "Secret address in iCal format" URL. With
   KV active this is saved server-side once, for all browsers.

4. **(Optional) Find the real live pogdesign feed URL.** Confirmed root
   cause: `https://www.pogdesign.co.uk/cat/view/AdamCorvus` is the profile
   *page*, not a feed — pogdesign itself returns HTTP 500 when it's fetched
   like one. Fixed for now by committing a **static snapshot**,
   `tv-shows.ics` (repo root — the owner exported it manually from
   pogdesign.co.uk/cat), seeded into the calendar store as a relative path
   (served same-origin, no proxy, so it can't have this class of failure
   again). ⚠️ This snapshot does **not** auto-update — re-export from
   pogdesign.co.uk/cat and overwrite `tv-shows.ics` whenever tracked shows
   change. If the owner finds pogdesign's actual "Calendar Feed" / iCal
   *export* link (distinct from the profile page — check account/settings on
   pogdesign.co.uk while signed in), swap the TV calendar's URL to it in the
   on-page manager for a live/auto-updating feed.

**Per-device setup the owner does in the browser (secrets never committed):**
- **Calendar:** click "manage" (on the **Today** card) → the **calendar
  manager** modal: one row per calendar with a **colour picker, name, URL,
  show/hide (👁) and remove (✕)**, plus "＋ add calendar". Saved
  **server-side** (Workers KV via same-origin `/api/calendars`, behind the
  Access login — safe for secret Google URLs, follows the owner across
  browsers) with a localStorage cache/fallback when the server store is
  unreachable (Today card shows "·local"). Any number of Google calendars
  plus TV etc.; per-calendar colour tints the event date + source tag.
- **Portfolio:** the owner's real holdings (4008 cash, 40 NVDA, 4 MSFT) are
  **committed in `config.js`** — the owner explicitly chose this for
  convenience despite the public repo. A per-browser override exists via
  "＋ holdings" / "edit" on the card (`localStorage["dash-portfolio"]`, wins
  over config); submit an empty list there to fall back to the committed
  values. If the card ever shows unexpected symbols, a stale localStorage
  override is the first suspect.
- **Weather location:** the browser will prompt for location permission on
  first load; allow it for weather where you actually are. Deny/ignore it and
  the card silently falls back to the `location` preset in `config.js`
  (Budapest). Set `location.autoDetect: false` to always use the preset and
  skip the prompt entirely.

**Most likely next requests:** design tweaks from live feedback (panel
opacity/border strength, scene glow, type scale, layout), add/remove widgets,
add stocks/feeds/teams. Most content changes = edit `config.js` (see "Common
edits"); design = `styles.css` tokens + `sceneFor` in `app.js` (stay inside
the charcoal + dusty-rose family — see Styling).

---

## File map

| File                 | Purpose                                                              |
|----------------------|---------------------------------------------------------------------|
| `index.html`         | Markup + empty widget "shells" filled in by JS                      |
| `styles.css`         | Design tokens (CSS vars), responsive grid, components, dark/light    |
| `app.js`             | All widget logic. One self-contained function per widget            |
| `config.js`          | **User-editable settings only.** No logic — just data               |
| `tv-shows.ics`       | Static snapshot of the pogdesign TV calendar (see Calendar notes)    |
| `server/worker.js`   | The `home` Worker: static assets + `/api/calendars` (KV store)       |
| `wrangler.toml`      | Deploy config for the `home` Worker (site + calendar API)            |
| `.assetsignore`      | Files excluded from the static-asset upload (server/, proxy/, docs)  |
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
- **Styling — the "dusk rice" system.** Flat, near-opaque panels, hairline
  rose borders, mono type. Tokens in `styles.css` `:root`: `--panel` /
  `--panel-2` (surfaces), `--panel-border` / `--panel-hover` (hairlines,
  derived from the accent), `--accent` (dusty rose, the *only* UI accent),
  `--gold` (monkeytype yellow — data highlights like the F1 countdown),
  `--up`/`--down` (muted), `--radius` (12px), `--line`, `--font` (JetBrains
  Mono), `--serif`. **No backdrop blur, no glass tokens** (they're gone).
  New widgets follow `.card` / `.card__head` / `.card__body` and inherit the
  panel surface. Selection/hover idiom: a solid pink block with dark text
  (`.card__sub a:hover`, `.f1-tab.is-on`) — the "fzf highlight bar" look.
  Card `h2` labels are lowercase, small, letter-spaced, rose-tinted.
- **Dynamic scene.** The `.scene` layer (in `index.html`) holds a soft rose
  **glow** (`.scene__sun`), drifting muted-rose **clouds**, and a near-black
  **mountain ridge** SVG, over a charcoal gradient driven by `--scene-1..3`
  + `--accent`. `app.js → applyScene()` sets those from time of day
  (`sceneFor`) and live weather, positions the glow by hour
  (`--sun-x/--sun-y`), and sets `body[data-sky=…]` for cloud/sun visibility.
  ⚠️ `sceneFor`'s palettes are deliberately **all inside the charcoal +
  dusty-rose family** — time of day shifts warmth/brightness only; weather
  desaturates toward grey. Don't reintroduce blues/teals/purples per hour;
  that breaks the identity. Colors are `@property`-registered so changes
  cross-fade.
- **Chrome & layout.** No search bar or links grid. Slim flat **status bars**
  (yasb-style, 40px, mono 12px): top = brand + `adam@home` left; **Weather
  and Markets live in the top bar as `.bar-module` pills** with flat
  `.dropdown` panels (open on hover/focus, click-toggle for touch via
  `.is-open`; clicking outside closes). The weather pill shows
  `icon temp · place`; the markets pill shows **today's portfolio P/L**
  (`▲ +$142 (1.2%)`, colored) — or the watchlist's average day move when no
  holdings. Their dropdown bodies keep the old ids (`weatherBody`,
  `stocksBody`, `weatherCard`, `stocksCard`) so the widget functions are
  unchanged. Below the bar, the page is a vertically-centered "desktop":
  a **hero** (giant mono clock with rose colon `#heroClock`, serif-italic
  greeting, long date) → full-width F1 card → the three calendar cards.
  Bottom bar = brand left, updated-time + refresh right. The bar clock/date
  (`#clock`/`#date`, short format) and hero clock/date both tick from
  `tickClock()`.
- **Theme.** `[data-theme="dark|light"]` on `<html>`, persisted in
  `localStorage["dash-theme"]`; `"auto"` follows the OS. Dark = the dusk
  rice; light = a warm **paper** variant (cream surfaces, same rose
  identity, darker rose accent for contrast).
- **Fonts.** JetBrains Mono (all UI/data) + Instrument Serif (the italic
  greeting) from Google Fonts in `index.html`, mono/serif system fallbacks
  if offline.

## Data sources (and their quirks)

- **Weather — Open-Meteo.** No key, CORS-friendly, called directly. Reliable.
  **Render-first:** `loadWeather()` paints immediately from the best spot it
  already knows — the last detected location cached in
  `localStorage["dash-geo"]`, else the `config.js` preset — and only then asks
  for live geolocation in the background (`getGeoCoords()`), re-rendering +
  updating the cache if the position meaningfully moved. It never blocks the
  first paint on a permission prompt; a previously-denied permission resolves
  instantly via the Permissions API instead of eating the geolocation timeout.
  A render sequence counter makes the newest render win (a slow preset fetch
  can't overwrite a fresher geolocated one), and a failed background
  re-render never clobbers an already-painted card.
  (`location.autoDetect: false` disables detection entirely.) When
  geolocation succeeds, the card's location label comes from a best-effort
  reverse-geocode via **BigDataCloud's client-reverse-geocode** endpoint (no
  key, CORS-enabled, built for client-side use — fails soft to "My
  location"). The **clock/greeting always stay on the `location.timezone`
  preset** regardless of detected weather location — that's your home-base
  time, not wherever the browser happens to be.
- **Formula 1 — Jolpica/Ergast** (`api.jolpi.ca/ergast/f1/...`). No key,
  CORS-enabled, called directly. Shows the next race, a live **countdown to
  qualifying** (1s ticker, `updateQualiCountdown`), and **Drivers/Constructors**
  standings tabs with team-colour icons (`F1_TEAM` map). The card is
  half-width (`.card--f1` span 3) beside the News card, with a two-column
  `.f1-grid`. Grid order: hero → the three calendar cards → F1 + News
  (Weather/Markets are top-bar modules, not cards). (F1 *Fantasy* has no
  free public API — official needs login, the community scrape is stale;
  only paid APIs cover fantasy prices/points.)
- **News — custom topics via Google News search RSS.** Each string in
  `news.topics` (config.js) becomes a keyless Google News *search* feed
  (`news.google.com/rss/search?q=<topic>` — host allowlisted in the proxy);
  anything you'd type into Google News search works, including quoted
  phrases. Feeds merge with any plain RSS in `news.feeds`, sort by recency
  ("breaking" titles float to top with a badge), and cap at
  `news.maxItems` (5) total. The card subtitle lists the active topics.
  *Possible future:* AI-curated digest via the Claude API — must go through
  a Worker holding `ANTHROPIC_API_KEY` as a Cloudflare secret (the repo is
  public; a browser-side key would leak). Not built yet.
- **Calendar (.ics) — three cards.** `loadCalendar()` fetches every connected
  feed once, merges the events, **expands recurring ones** (see below), then
  buckets them by local day boundary into **Today** / **Tomorrow** / **This
  week** (the 5 days after tomorrow) and renders each bucket into its own
  card via the shared `renderEvents()` helper. All three sit together in the
  first grid row under the hero (`.card--cal` span 2 × 3 = 6), so they get
  equal height automatically from the grid's default row-stretch — no
  explicit height CSS needed, just keep them in the same DOM row.
  `calendar.maxItems` caps events *per card*, not globally. The connect/edit
  control only lives on the Today card (one shared URL list feeds all three);
  it reads "＋ connect" until private (localStorage) feeds exist, then "edit".
  The other two cards only show a subtitle (date / date range) and their own
  empty-state message.
  - **Feed failures are surfaced, never swallowed.** Each feed's response is
    validated (`BEGIN:VCALENDAR` must appear — a wrong URL returning an HTML
    page counts as a failure, not zero events). If *all* feeds fail the cards
    show an error naming them; if *some* fail, events still render and the
    Today subtitle gets a "⚠ <feed> failed" note. Failures also
    `console.warn` with the URL for debugging. Before this, any broken feed
    rendered as a silent "No events".
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
  - **The calendar store + manager.** Each calendar is
    `{ id, name, url, color, visible }`. Canonical copy lives **server-side
    in Workers KV** via same-origin `GET/PUT /api/calendars`
    (`server/worker.js` on the `home` Worker — behind Cloudflare Access, so
    owner-only by construction; that's what makes storing secret Google URLs
    there safe, and makes the list follow the owner across devices).
    Client logic: `loadCalStore()` (server → localStorage cache → first-run
    migration from the old URL-list keys + `config.js` seed feeds) and
    `saveCalStore()` (writes both; `calServerOk` tracks reachability — when
    false the Today card shows a "·local" hint). The manager modal
    (`#calModalOverlay`, `initCalManager()`, `openCalManager()`) lists one
    row per calendar: colour `<input type="color">`, name, URL, 👁 show/hide
    (`visible: false` calendars aren't fetched), ✕ remove, ＋ add. Only
    calendars in the store are fetched — committed `config.js` feeds are
    one-time bootstrap seeds, not a live source. Per-calendar `color` tints
    the event date number + source tag via the `--cal-c` CSS var.
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
proxy returns 403 for that host. Current allowlist: Yahoo Finance,
Google News (topic feeds), BBC, Al Jazeera, NPR, The Verge, Hacker News
(hnrss.org), Google Calendar, pogdesign.co.uk (TV calendar).

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
    holdings:[{symbol,shares,cost}] }`. ⚠️ The repo is public, so anything put
    here is visible to anyone browsing GitHub — the owner knowingly committed
    his real holdings anyway (his call, made explicitly). `cash` is added to
    the displayed total but excluded from gain/loss.
  With avg cost it computes total gain/loss; without it, just value + day change.
  Mixed currencies are summed per-currency. Uses the Yahoo quote feed (via proxy).
- **Change news topics:** edit `news.topics` — plain strings, each becomes a
  Google News search feed (quoted phrases and search operators work). No
  proxy change needed (news.google.com is allowlisted). Plain RSS feeds can
  still be added to `news.feeds` as `{ name, url }` — **those** need their
  hostname in `ALLOWED_HOSTS` + a proxy redeploy. `maxItems` caps the total
  shown (5). Titles containing "breaking" float to the top with a badge.
- **Manage calendars:** everything happens **on the page** — "manage" on the
  Today card opens the manager (add/edit/show-hide/remove + colour picker
  per calendar); the list persists server-side (KV) once the namespace is
  set up. `config.js → calendar.feeds` is only a first-run bootstrap seed.
  The TV calendar is the committed `tv-shows.ics` snapshot (same-origin, no
  proxy — see the pogdesign note in "Pick up here"). ⚠️ Cross-origin feeds
  (Google etc.) go through the proxy, so any new *host* still needs adding
  to `ALLOWED_HOSTS` in `proxy/worker.js` + a proxy redeploy
  (calendar.google.com is already allowlisted).
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
toggle works; layout holds at mobile width. Widget fetches share a 12s abort
timeout (`fetchT`), so a dead source shows its fail message rather than a
card stuck on "Loading…". Remember to bump `?v=` in `index.html` before
merging (see Workflow).

## Deployment

The site is served by the Cloudflare Worker `home` at
**https://home.adam-berczi.workers.dev/**, auto-deploying on push to
`master`. Since the calendar store landed, `home` is **worker code + static
assets**: root `wrangler.toml` points at `server/worker.js` (which answers
`/api/calendars` from Workers KV and passes everything else to the assets),
with the repo root as the asset directory (`.assetsignore` excludes
server/proxy/docs files). Still zero build step. **Cloudflare Access** sits
in front of the hostname, restricted to `adam.berczi@gmail.com` — every
visitor gets an email one-time-PIN challenge before anything (pages *and*
API) is reachable; nobody else can pass. GitHub Pages
(`https://adamberczi.github.io/AdamRepo/`) formerly served a public copy
and is being turned off (repo Settings → Pages → Source: None). The CORS
proxy (`personal-dash-proxy`) is a separate Worker, deployed independently
via wrangler from `proxy/`.
