# Personal Start Page — Plan & Mockup

A minimalist, single-page browser home page with live widgets: weather, markets,
news, sports, calendar, quick links, clock + search. Built as a **zero-build
static site** (plain HTML/CSS/JS) so it loads instantly and deploys to GitHub
Pages with no toolchain.

## Goals

- **Minimalist & stylish** — one accent colour, generous whitespace, tabular
  numerals, dark-first with an auto light theme. No clutter, no frameworks.
- **Fast & robust** — each widget loads independently and fails soft: if one
  data source is down, the rest of the page is unaffected.
- **Personal & editable** — all your settings live in a single `config.js`.
  No code changes needed to add a ticker, feed, team, or link.
- **No accounts, minimal keys** — weather and sports need no API key; news and
  calendar use public feeds routed through a CORS proxy.

## Layout (mockup)

The live page in this repo **is** the mockup — open `index.html`. Wireframe:

```
┌───────────────────────────────────────────────────────────────┐
│  14:32                                       Wednesday, 24 June │
│  Good afternoon, Adam.                                      ◐   │
├───────────────────────────────────────────────────────────────┤
│  🔎  Search the web…  (try !g, !yt, !gh, !w)                    │
├──────────────────────┬──────────────────────┬─────────────────┤
│  WEATHER   Budapest  │  MARKETS      14:32   │  NEWS           │
│  ☀️ 24°C             │  AAPL   213.5  ▲0.8%  │  • BBC headline │
│  Clear · feels 25°   │  MSFT   430.1  ▼0.3%  │  • Verge story  │
│  💧40% 🌬️9km/h       │  NVDA   126.0  ▲2.1%  │  • HN link …    │
│  Today Thu Fri Sat … │  OTP.BU …             │  (tall column)  │
├──────────────────────┼──────────────────────┤                 │
│  SPORTS              │  CALENDAR             │                 │
│  Premier League      │  24 Jun  Standup 9:30 │                 │
│  Arsenal @ Chelsea   │  25 Jun  Dentist …    │                 │
│  NBA  Lakers …       │  …                    │                 │
├──────────────────────┴──────────────────────┴─────────────────┤
│  LINKS   ● Gmail  ● Calendar  ● GitHub  ● Drive  ● YouTube …    │
├───────────────────────────────────────────────────────────────┤
│  Updated 14:32                                       ↻ refresh  │
└───────────────────────────────────────────────────────────────┘
```

Responsive: 6-column grid → 2 columns on tablets → single column on phones.

## Widgets & data sources

| Widget   | Source                              | Key? | Notes                                   |
|----------|-------------------------------------|------|-----------------------------------------|
| Weather  | Open-Meteo                          | No   | Current + 5-day; metric/imperial        |
| Markets  | Yahoo Finance quote endpoint        | No*  | Via CORS proxy; any exchange suffix     |
| News     | Your RSS/Atom feeds                 | No   | Via CORS proxy; merged & time-sorted    |
| Sports   | ESPN public scoreboard API          | No   | Live/recent/upcoming; highlights team   |
| Calendar | Google/any public `.ics` feed       | No   | Via CORS proxy; secret iCal URL         |
| Links    | Static list in config               | —    | Quick bookmarks                         |
| Search   | DuckDuckGo + `!bang` shortcuts      | —    | `!g` `!yt` `!gh` `!w` `!maps`           |

\*No account, but the public proxy can be rate-limited — see CLAUDE.md for a
self-hosted Cloudflare Worker proxy if markets/news flake out.

## Files

```
index.html   structure + widget shells
styles.css   theme tokens, grid, components (dark + light)
app.js        widget logic (vanilla JS, no deps)
config.js    ← the only file you edit to personalize
CLAUDE.md    project guide for future edits
```

## Setup

1. Edit `config.js` (location is preset to Budapest; add your stocks, feeds,
   teams, calendar URL, links).
2. **Local use:** open `index.html`, set it as your browser's home/new-tab page.
3. **GitHub Pages:** Settings → Pages → deploy from `master` (root). Your page
   goes live at `https://adamberczi.github.io/adamrepo/`.

## Possible next steps

- Drag-to-reorder widgets with layout saved to `localStorage`.
- Per-widget show/hide toggles in a small settings panel.
- Self-hosted CORS proxy (Cloudflare Worker) for rock-solid news/markets.
- Add a "to-do" / scratchpad widget persisted locally.
