/* =============================================================================
 * server/worker.js — the "home" Worker: static site + calendar store API
 * -----------------------------------------------------------------------------
 * Serves the dashboard's static assets (repo root) and a tiny same-origin API:
 *
 *   GET /api/calendars → the saved calendar list (JSON array), or null if
 *                        nothing saved yet
 *   PUT /api/calendars → replace the list (JSON array in the body)
 *
 * Storage is Workers KV (binding CALS — see wrangler.toml). The whole
 * hostname sits behind Cloudflare Access restricted to the owner, so the API
 * is owner-only by construction: unauthenticated visitors never reach this
 * code. That's what makes it safe to store secret Google iCal URLs here.
 *
 * Fail-soft: if the KV binding isn't configured yet (namespace not created /
 * id not filled in), the API returns 503 and the page falls back to
 * localStorage — the site itself keeps working either way.
 * ===========================================================================*/

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

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

    // everything else: the static dashboard
    return env.ASSETS.fetch(request);
  },
};
