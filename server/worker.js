/* =============================================================================
 * server/worker.js — the "home" Worker: static site + owner-only APIs
 * -----------------------------------------------------------------------------
 * Serves the dashboard's static assets (repo root) and a tiny same-origin API:
 *
 *   GET /api/calendars → the saved calendar list (JSON array), or null if
 *                        nothing saved yet
 *   PUT /api/calendars → replace the list (JSON array in the body)
 *   GET /api/gmail     → unread count + latest messages from Gmail's Atom
 *                        inbox feed (fetched server-side with an app password)
 *
 * Storage is Workers KV (binding CALS — see wrangler.toml). Gmail needs the
 * GMAIL_USER var (wrangler.toml) + GMAIL_APP_PASSWORD secret
 * (`npx wrangler secret put GMAIL_APP_PASSWORD`). The whole hostname sits
 * behind Cloudflare Access restricted to the owner, so the API is owner-only
 * by construction: unauthenticated visitors never reach this code. That's
 * what makes it safe to store secret iCal URLs and serve mailbox data here.
 *
 * Fail-soft: anything not configured yet (KV binding, Gmail credentials)
 * returns 503 and the page hides/falls back — the site keeps working.
 * ===========================================================================*/

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

// Minimal XML entity decode for Atom text nodes (client re-escapes on render).
const unxml = (s) => String(s || "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// Gmail's Atom inbox feed → { count, messages: [{ subject, from, email, date, link }] }
async function gmailFeed(env) {
  const auth = "Basic " + btoa(`${env.GMAIL_USER}:${env.GMAIL_APP_PASSWORD}`);
  const r = await fetch("https://mail.google.com/mail/feed/atom", {
    headers: { Authorization: auth, "User-Agent": "personal-dash (Cloudflare Worker)" },
  });
  if (!r.ok) throw new Error("gmail upstream HTTP " + r.status);
  const xml = await r.text();
  const count = +(xml.match(/<fullcount>(\d+)<\/fullcount>/)?.[1] ?? 0);
  const messages = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 8).map((m) => {
    const e = m[1];
    const pick = (re) => unxml(e.match(re)?.[1] ?? "");
    return {
      subject: pick(/<title>([\s\S]*?)<\/title>/),
      from: pick(/<name>([\s\S]*?)<\/name>/),
      email: pick(/<email>([\s\S]*?)<\/email>/),
      date: pick(/<(?:issued|modified)>([\s\S]*?)<\/(?:issued|modified)>/),
      link: e.match(/<link[^>]*href="([^"]*)"/)?.[1] ?? "",
    };
  });
  return { count, messages };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/calendars") {
      if (!env.CALS) {
        return new Response('{"error":"KV storage not configured — see wrangler.toml"}',
          { status: 503, headers: JSON_HEADERS });
      }
      if (request.method === "GET") {
        const v = await env.CALS.get("calendars");
        return new Response(v || "null", { headers: JSON_HEADERS });
      }
      if (request.method === "PUT") {
        const body = await request.text();
        if (body.length > 100_000) {
          return new Response('{"error":"too large"}', { status: 413, headers: JSON_HEADERS });
        }
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = undefined; }
        if (!Array.isArray(parsed)) {
          return new Response('{"error":"body must be a JSON array"}', { status: 400, headers: JSON_HEADERS });
        }
        await env.CALS.put("calendars", body);
        return new Response('{"ok":true}', { headers: JSON_HEADERS });
      }
      return new Response('{"error":"method not allowed"}', { status: 405, headers: JSON_HEADERS });
    }

    if (url.pathname === "/api/gmail") {
      if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
        return new Response('{"error":"gmail not configured — see wrangler.toml"}',
          { status: 503, headers: JSON_HEADERS });
      }
      try {
        const data = await gmailFeed(env);
        return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message || e) }),
          { status: 502, headers: JSON_HEADERS });
      }
    }

    // everything else: the static dashboard
    return env.ASSETS.fetch(request);
  },
};
