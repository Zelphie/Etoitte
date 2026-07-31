// Single Worker entry point: serves the static app from ASSETS and handles
// the two API routes itself. Replaces the old functions/api/*.js Pages
// Functions, which only apply to the classic (now-legacy) Pages product —
// this account's dashboard deploys through the unified Workers product,
// which needs one real Worker script instead of file-based routing.

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_CAP = 1200;
const RATE_LIMIT_PER_HOUR = 20;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleStorage(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "key required" }, 400);
    const value = await env.ETOITTE_KV.get("data:" + key);
    return json(value === null ? null : { value });
  }
  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "invalid json" }, 400);
    }
    if (!body.key || typeof body.value !== "string") {
      return json({ error: "key and value required" }, 400);
    }
    await env.ETOITTE_KV.put("data:" + body.key, body.value);
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "key required" }, 400);
    await env.ETOITTE_KV.delete("data:" + key);
    return json({ ok: true });
  }
  return json({ error: "method not allowed" }, 405);
}

// Area config (labels/centroids/walkable radius) lives under its own KV key so it can be
// edited directly in KV (e.g. `wrangler kv key put`) without a redeploy. GET returns null
// when unset — the frontend seeds it with its built-in defaults on first load.
async function handleAreas(request, env) {
  if (request.method === "GET") {
    const raw = await env.ETOITTE_KV.get("config:areas");
    if (!raw) return json(null);
    try {
      return json(JSON.parse(raw));
    } catch (e) {
      return json(null);
    }
  }
  if (request.method === "PUT" || request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "invalid json" }, 400);
    }
    if (!body.labels || typeof body.labels !== "object" || !body.centroids || typeof body.centroids !== "object" ||
        !body.regions || typeof body.regions !== "object") {
      return json({ error: "labels, centroids, and regions objects required" }, 400);
    }
    await env.ETOITTE_KV.put("config:areas", JSON.stringify(body));
    return json({ ok: true });
  }
  return json({ error: "method not allowed" }, 405);
}

async function handleAnthropic(request, env) {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Off by default. The app has an in-UI toggle that writes "true"/"false"
  // to this same KV store under data:ai_assist_enabled; anything else
  // (including unset) short-circuits here with zero calls to Anthropic.
  const flag = await env.ETOITTE_KV.get("data:ai_assist_enabled");
  if (flag !== "true") {
    return json({ content: [] });
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const hourBucket = new Date().toISOString().slice(0, 13); // e.g. 2026-07-31T14
  const rateKey = `ratelimit:${ip}:${hourBucket}`;
  const countRaw = await env.ETOITTE_KV.get(rateKey);
  const count = countRaw ? parseInt(countRaw, 10) : 0;
  if (count >= RATE_LIMIT_PER_HOUR) {
    return json({ error: "Rate limit exceeded, try again in a bit." }, 429);
  }
  await env.ETOITTE_KV.put(rateKey, String(count + 1), { expirationTtl: 3600 });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "invalid json" }, 400);
  }
  if (!Array.isArray(body.messages)) {
    return json({ error: "messages required" }, 400);
  }

  const payload = {
    model: MODEL,
    max_tokens: Math.min(body.max_tokens || 1000, MAX_TOKENS_CAP),
    messages: body.messages,
    tools: body.tools,
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/storage") return handleStorage(request, env);
    if (url.pathname === "/api/areas") return handleAreas(request, env);
    if (url.pathname === "/api/anthropic") return handleAnthropic(request, env);
    return env.ASSETS.fetch(request);
  },
};
