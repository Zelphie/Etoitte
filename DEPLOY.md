# Deploying Etoitte to Cloudflare (free)

This is a Cloudflare Worker with static assets (the current unified Workers product — the older, separate "Pages" product with its `functions/` folder convention doesn't apply here):
- `public/index.html` — the app, using `/api/storage` for shared state and `/api/anthropic` for the AI-assist features.
- `src/worker.js` — handles both API routes and falls through to serving `public/` for everything else.
- `wrangler.jsonc` — declares the Worker entry point, the static assets directory, and the KV binding (`ETOITTE_KV`).

No auth is built in — anyone with the deployed URL can read/write your list and votes, same as the app's original "keep this link private" design. Don't post the URL publicly.

## 1. Accounts (already done)
- Cloudflare account, GitHub account, repo at `Zelphie/Etoitte`, connected as a Cloudflare "Workers & Pages" application named `etoitte`.
- KV namespace `etoitte-kv` created, ID wired into `wrangler.jsonc`.

## 2. Push and redeploy
Any commit pushed to `main` auto-redeploys via the connected Git integration — no CLI tooling needed locally. Deploy command is `npx wrangler deploy`, which Cloudflare runs for you in its own build environment.

## 3. Set the Anthropic API key secret
Only needed if you want the Maps-link autofill / wildcard-suggestion features working (skip this and they just fail gracefully to manual entry):
1. console.anthropic.com → **Settings → API Keys** → create a key (billed separately per call on your own account)
2. Cloudflare dashboard → your `etoitte` Worker → **Settings → Variables and Secrets** → **Add**
3. Name: `ANTHROPIC_API_KEY`, paste the key, tick **Encrypt**, save
4. This only works once the Worker has real code attached (not asset-only) — confirmed once `wrangler.jsonc` + `src/worker.js` are deployed.

## 4. Test
Visit the `*.workers.dev` URL (or custom domain) Cloudflare gives you. Do the setup screen, add a couple of spots, shuffle, and swipe from two browser tabs (or two devices) to confirm shared storage works. Try the Maps-link autofill to confirm the API key secret is wired up correctly.
