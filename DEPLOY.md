# Deploying Etoitte to Cloudflare (free)

This folder is set up for Cloudflare Pages:
- `public/index.html` — the app, using `/api/storage` for shared state and `/api/anthropic` for the AI-assist features.
- `functions/api/storage.js` — KV-backed shared storage.
- `functions/api/anthropic.js` — proxies AI calls, holds your API key server-side, rate-limited to 20 requests/hour per IP.

No auth is built in — anyone with the deployed URL can read/write your list and votes, same as the app's original "keep this link private" design. Don't post the URL publicly.

## 1. Create accounts (free, no card required for Cloudflare)
- Cloudflare: https://dash.cloudflare.com/sign-up
- GitHub (if you don't have one): https://github.com/join
- Anthropic API key (only needed if you want the AI-assist features working): https://console.anthropic.com/settings/keys — note this is billed separately per API call on your account, outside Cloudflare's free tier.

## 2. Push this folder to a new GitHub repo
Ask me to do this part with you — I'll stage and commit, but you should create the empty repo on GitHub first and confirm before I push anything.

## 3. Create the KV namespace
In the Cloudflare dashboard: **Workers & Pages → KV → Create a namespace**, name it `etoitte-kv`.

## 4. Create the Pages project
**Workers & Pages → Create → Pages → Connect to Git**, pick the repo you pushed. Build settings:
- Build command: *(leave blank)*
- Build output directory: `public`

Deploy. Cloudflare will auto-detect `functions/` and wire up the API routes.

## 5. Bind KV and set the API key
On the new Pages project: **Settings → Functions → KV namespace bindings** → add binding, variable name `ETOITTE_KV`, pick the `etoitte-kv` namespace.

Then **Settings → Environment variables** → add a **secret** named `ANTHROPIC_API_KEY` with your key from step 1. (Skip this if you chose not to wire up the AI-assist features — those calls will just fail gracefully and fall back to manual entry.)

Redeploy once (Deployments tab → Retry deployment) so the new bindings take effect.

## 6. Test
Visit the `*.pages.dev` URL Cloudflare gives you. Do the setup screen, add a couple of spots, shuffle, and swipe from two browser tabs (or two devices) to confirm shared storage works.

## Ongoing updates
Any future edit to files in this folder + `git push` auto-redeploys — no CLI tooling needed locally.
