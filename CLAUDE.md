# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What this is

A personal browser **start page**: a minimalist, single-page dashboard with live
widgets (weather, markets, news, sports, calendar, quick links, clock, search).
It is a **zero-build static site** — plain HTML, CSS, and vanilla JS with no
dependencies, no bundler, no framework. Open `index.html` and it runs.

Deployed via **GitHub Pages** at `https://adamberczi.github.io/adamrepo/`.

## File map

| File         | Purpose                                                                 |
|--------------|-------------------------------------------------------------------------|
| `index.html` | Markup + empty widget "shells" filled in by JS                          |
| `styles.css` | Design tokens (CSS vars), responsive grid, component styles, dark/light |
| `app.js`     | All widget logic. One self-contained module/function per widget         |
| `config.js`  | **User-editable settings only.** No logic — just data                   |
| `PLAN.md`    | Design rationale, layout mockup, data-source table                      |

## Architecture & conventions

- **No build step.** Do not introduce npm, bundlers, TypeScript, or frameworks
  unless explicitly asked. The value here is that it's instant and dependency-free.
- **Fail-soft widgets.** Every widget catches its own errors and renders a short
  message via `fail(el, msg)`. One broken data source must never blank the page.
  Preserve this when adding widgets — wrap fetches in try/catch.
- **Config-driven.** Anything a user might want to change (symbols, feeds, teams,
  coords, links, theme) belongs in `config.js`, read via `window.DASH_CONFIG`.
  Never hardcode personal data in `app.js`.
- **Escape untrusted strings.** Feed/API text is injected with `innerHTML`, so
  pass it through `esc()` first (already done throughout). Keep doing this.
- **Styling.** Use the existing CSS custom properties (`--accent`, `--text-dim`,
  `--up`/`--down`, `--radius`, etc.). One accent colour; keep it minimal. New
  widgets follow the `.card` / `.card__head` / `.card__body` pattern.
- **Theme.** `[data-theme="dark|light"]` on `<html>`; persisted in
  `localStorage["dash-theme"]`. `"auto"` follows the OS.

## Data sources (and their quirks)

- **Weather — Open-Meteo.** No key, CORS-friendly, called directly. Reliable.
- **Sports — ESPN public API** (`site.api.espn.com/.../scoreboard`). No key,
  CORS-enabled, called directly.
- **News (RSS) & Calendar (.ics) & Markets (Yahoo)** do **not** send CORS
  headers, so they go through `CFG.corsProxy`. Default proxy is the public
  `api.allorigins.win`. It works but can be slow or rate-limited.

### Self-hosted proxy (recommended for reliability)

If news/markets flake out, deploy a tiny Cloudflare Worker and point
`config.js → corsProxy` at it (`"https://your-worker.workers.dev/?url={url}"`):

```js
export default {
  async fetch(req) {
    const target = new URL(req.url).searchParams.get("url");
    if (!target) return new Response("missing url", { status: 400 });
    const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
    const h = new Headers(r.headers);
    h.set("Access-Control-Allow-Origin", "*");
    return new Response(r.body, { status: r.status, headers: h });
  },
};
```

## Common edits

- **Add a stock:** push a Yahoo symbol to `config.js → stocks.symbols`
  (suffixes: `.BU` Budapest, `.L` London, `.DE` Frankfurt; crypto like `BTC-USD`).
- **Add a news feed:** add `{ name, url }` to `config.js → news.feeds`.
- **Add a sports league:** add `{ name, path, team }` to `config.js → sports.leagues`.
  `path` is the ESPN slug, e.g. `soccer/eng.1` (Premier League),
  `soccer/uefa.champions`, `soccer/hun.1` (NB I.), `basketball/nba`,
  `football/nfl`, `hockey/nhl`, `baseball/mlb`. `team` is a substring match used
  to highlight your club.
- **Connect a calendar:** Google Calendar → settings → "Integrate calendar" →
  "Secret address in iCal format" → paste into `config.js → calendar.url`.
- **Change location:** edit `config.js → location` (lat/lon from latlong.net,
  IANA `timezone`, and `units: "metric" | "imperial"`).

## Testing changes

No test suite — verify in a browser. Because `fetch` + CORS behave differently
on `file://`, prefer a quick local server:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Check: no console errors, every widget loads or shows its fail message, the
theme toggle works, and the layout holds at mobile width.

## Deployment

GitHub Pages serves the repo root on `master`. Merge to `master` to publish.
Development happens on feature branches.
