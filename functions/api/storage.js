// Shared key/value storage for the Etoitte app, backed by a Cloudflare KV
// namespace bound as ETOITTE_KV. There is no auth here — anyone with the
// deployed URL can read/write, matching the app's own "keep this link
// private" model. Do not reuse this namespace across multiple couples.

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return json({ error: "key required" }, 400);
  const value = await env.ETOITTE_KV.get("data:" + key);
  return json(value === null ? null : { value });
}

export async function onRequestPost(context) {
  const { request, env } = context;
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

export async function onRequestDelete(context) {
  const { request, env } = context;
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return json({ error: "key required" }, 400);
  await env.ETOITTE_KV.delete("data:" + key);
  return json({ ok: true });
}
