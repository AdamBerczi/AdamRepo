/* =============================================================================
 * worker.js — CORS proxy for the personal start page
 * -----------------------------------------------------------------------------
 * Reads ?url=<encoded target>, fetches it server-side, and returns the response
 * with an Access-Control-Allow-Origin header so the browser can read it.
 *
 * Safety: only targets whose hostname matches ALLOWED_HOSTS are proxied, so this
 * cannot be used as a general-purpose open proxy. Add a host here whenever you
 * add a feed/calendar/stock source in config.js.
 *
 * Deploy:  cd proxy && npx wrangler deploy
 * ===========================================================================*/

const ALLOWED_HOSTS = [
  "query1.finance.yahoo.com", // stocks
  "query2.finance.yahoo.com",
  "feeds.bbci.co.uk",         // news (BBC top stories)
  "aljazeera.com",            // news (Al Jazeera)
  "npr.org",                  // news (NPR top stories)
  "www.theverge.com",         // optional tech feeds
  "hnrss.org",
  "calendar.google.com",      // calendar (.ics)
  "pogdesign.co.uk",          // pogdesign TV calendar (.ics)
];

const allowed = (host) =>
  ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));

export default {
  async fetch(req) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    const target = new URL(req.url).searchParams.get("url");
    if (!target) return new Response("missing ?url=", { status: 400, headers: cors });

    let t;
    try { t = new URL(target); } catch { return new Response("bad url", { status: 400, headers: cors }); }
    if (t.protocol !== "https:") return new Response("https only", { status: 400, headers: cors });
    if (!allowed(t.hostname)) return new Response("host not allowed", { status: 403, headers: cors });

    try {
      const upstream = await fetch(t.toString(), {
        // A real-browser UA: some feed hosts (e.g. pogdesign) reject requests
        // with obvious bot/agent strings, returning an error page instead of ICS.
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept": "*/*",
        },
        cf: { cacheTtl: 120, cacheEverything: true },
      });
      const h = new Headers(cors);
      const ct = upstream.headers.get("content-type");
      if (ct) h.set("Content-Type", ct);
      h.set("Cache-Control", "public, max-age=120");
      return new Response(upstream.body, { status: upstream.status, headers: h });
    } catch (e) {
      return new Response("upstream error: " + e.message, { status: 502, headers: cors });
    }
  },
};
