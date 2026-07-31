// Proxies the app's two AI-assist calls (Maps link autofill, wildcard
// suggestions) to the real Anthropic API, holding the API key server-side.
// Rate-limited per IP via KV since the deployed URL has no login — this
// caps abuse if the link leaks or gets crawled/guessed.

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_CAP = 1200;
const RATE_LIMIT_PER_HOUR = 20;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

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
