/* =============================================================================
 * server/worker.js — the "home" Worker: static site + owner-only APIs
 * -----------------------------------------------------------------------------
 * Serves the dashboard's static assets (repo root) and a tiny same-origin API:
 *
 *   GET  /api/calendars   → the saved calendar list (JSON array), or null if
 *                           nothing saved yet
 *   PUT  /api/calendars   → replace the list (JSON array in the body)
 *   GET  /api/gmail       → unread count + latest messages from Gmail's Atom
 *                           inbox feed (fetched server-side with an app password)
 *   GET/POST /api/todos,
 *   PATCH/DELETE /api/todos/:id
 *                         → Microsoft To Do tasks via Microsoft Graph
 *                           (OAuth device-code flow, token stored in KV)
 *
 * Storage is Workers KV (binding CALS — see wrangler.toml). Gmail needs the
 * GMAIL_USER var (wrangler.toml) + GMAIL_APP_PASSWORD secret
 * (`npx wrangler secret put GMAIL_APP_PASSWORD`). Microsoft To Do needs the
 * MSTODO_CLIENT_ID var (wrangler.toml) + a refresh token bootstrapped into KV
 * under "msTodoRefreshToken" (see CLAUDE.md — unlike Gmail this can't be a
 * Worker secret because Microsoft rotates the refresh token on every use and
 * the Worker must be able to rewrite it). The whole hostname sits behind
 * Cloudflare Access restricted to the owner, so the API is owner-only by
 * construction: unauthenticated visitors never reach this code. That's what
 * makes it safe to store secret iCal URLs and OAuth tokens here.
 *
 * Fail-soft: anything not configured yet (KV binding, Gmail credentials,
 * Microsoft connection) returns 503 and the page hides/falls back — the site
 * keeps working.
 * ===========================================================================*/

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json400 = (msg) => new Response(JSON.stringify({ error: msg }), { status: 400, headers: JSON_HEADERS });
const json413 = () => new Response('{"error":"too large"}', { status: 413, headers: JSON_HEADERS });
const json502 = (msg) => new Response(JSON.stringify({ error: msg }), { status: 502, headers: JSON_HEADERS });
const json503 = (msg) => new Response(JSON.stringify({ error: msg }), { status: 503, headers: JSON_HEADERS });

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

/* -----------------------------------------------------------------------
 * Microsoft To Do (Microsoft Graph). Auth is an OAuth device-code flow
 * bootstrapped once (see CLAUDE.md); Microsoft rotates the refresh token on
 * every use, so it lives in KV (key "msTodoRefreshToken") rather than a
 * Worker secret, which the Worker can read but never rewrite at runtime.
 * A short-lived access-token cache (key "msTodoAccessToken") keeps most
 * requests from touching the token endpoint at all — refreshing on every
 * request would mean every request also rotates the refresh token, and two
 * near-simultaneous refreshes can each invalidate the other's result.
 * --------------------------------------------------------------------- */
const MSTODO_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MSTODO_SCOPE = "Tasks.ReadWrite offline_access";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function getMsTodoAccessToken(env) {
  if (!env.CALS) throw new Error("KV storage not configured");
  if (!env.MSTODO_CLIENT_ID) throw new Error("MSTODO_CLIENT_ID not configured");
  const refreshToken = await env.CALS.get("msTodoRefreshToken");
  if (!refreshToken) throw new Error("not connected — no refresh token in KV (see CLAUDE.md bootstrap)");

  const cachedRaw = await env.CALS.get("msTodoAccessToken");
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw);
    if (cached.expires_at > Date.now() + 60_000) return cached.access_token;
  }

  const body = new URLSearchParams({
    client_id: env.MSTODO_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: MSTODO_SCOPE,
  });
  const r = await fetch(MSTODO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await r.json();
  if (!r.ok) throw new Error("token refresh failed: " + (data.error || r.status));

  await env.CALS.put("msTodoRefreshToken", data.refresh_token || refreshToken);
  await env.CALS.put("msTodoAccessToken", JSON.stringify({
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }));
  return data.access_token;
}

async function getMsTodoListId(accessToken, listName) {
  const r = await fetch(`${GRAPH_BASE}/me/todo/lists`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error("graph lists HTTP " + r.status);
  const { value: lists } = await r.json();
  const name = (listName || "").trim().toLowerCase();
  if (name) {
    const match = lists.find((l) => (l.displayName || "").toLowerCase() === name);
    if (match) return match.id;
  }
  const def = lists.find((l) => l.wellknownListName === "defaultList");
  return (def || lists[0])?.id;
}

function mapGraphTask(t) {
  return {
    id: t.id,
    title: t.title,
    done: t.status === "completed",
    due: t.dueDateTime?.dateTime ? t.dueDateTime.dateTime.slice(0, 10) : null,
  };
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

    const todoTaskMatch = url.pathname.match(/^\/api\/todos\/([^/]+)$/);
    if (url.pathname === "/api/todos" || todoTaskMatch) {
      if (!env.CALS) return json503("KV storage not configured — see wrangler.toml");
      if (!env.MSTODO_CLIENT_ID) return json503("Microsoft To Do not configured — see wrangler.toml / CLAUDE.md");

      let accessToken;
      try { accessToken = await getMsTodoAccessToken(env); }
      catch (e) { return json503("Microsoft To Do not connected — " + String(e.message || e)); }

      const listName = url.searchParams.get("list") || "";
      let listId;
      try { listId = await getMsTodoListId(accessToken, listName); }
      catch (e) { return json502("could not resolve task list — " + String(e.message || e)); }
      if (!listId) return json502("no task list found");

      const taskId = todoTaskMatch?.[1];
      const graphHeaders = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

      try {
        if (request.method === "GET" && !taskId) {
          const r = await fetch(
            `${GRAPH_BASE}/me/todo/lists/${listId}/tasks?$filter=${encodeURIComponent("status ne 'completed'")}&$orderby=createdDateTime desc&$top=50`,
            { headers: graphHeaders }
          );
          if (!r.ok) throw new Error("graph HTTP " + r.status);
          const { value } = await r.json();
          return new Response(JSON.stringify({ todos: value.map(mapGraphTask) }), { headers: JSON_HEADERS });
        }

        if (request.method === "POST" && !taskId) {
          const body = await request.text();
          if (body.length > 10_000) return json413();
          let parsed; try { parsed = JSON.parse(body); } catch { parsed = undefined; }
          const title = parsed?.title?.trim();
          if (!title) return json400("body must be { title: string }");
          const r = await fetch(`${GRAPH_BASE}/me/todo/lists/${listId}/tasks`, {
            method: "POST", headers: graphHeaders, body: JSON.stringify({ title }),
          });
          if (!r.ok) throw new Error("graph HTTP " + r.status);
          const created = await r.json();
          return new Response(JSON.stringify(mapGraphTask(created)), { headers: JSON_HEADERS });
        }

        if (request.method === "PATCH" && taskId) {
          const body = await request.text();
          let parsed; try { parsed = JSON.parse(body); } catch { parsed = undefined; }
          if (typeof parsed?.done !== "boolean") return json400("body must be { done: boolean }");
          const r = await fetch(`${GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}`, {
            method: "PATCH", headers: graphHeaders,
            body: JSON.stringify({ status: parsed.done ? "completed" : "notStarted" }),
          });
          if (!r.ok) throw new Error("graph HTTP " + r.status);
          const updated = await r.json();
          return new Response(JSON.stringify(mapGraphTask(updated)), { headers: JSON_HEADERS });
        }

        if (request.method === "DELETE" && taskId) {
          const r = await fetch(`${GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}`,
            { method: "DELETE", headers: graphHeaders });
          if (!r.ok && r.status !== 404) throw new Error("graph HTTP " + r.status);
          return new Response('{"ok":true}', { headers: JSON_HEADERS });
        }

        return new Response('{"error":"method not allowed"}', { status: 405, headers: JSON_HEADERS });
      } catch (e) {
        return json502(String(e.message || e));
      }
    }

    // everything else: the static dashboard
    return env.ASSETS.fetch(request);
  },
};
