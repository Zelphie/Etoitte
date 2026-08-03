# Deploying Etoitte to Cloudflare (free)

This is a Cloudflare Worker with static assets (the current unified Workers product — the older, separate "Pages" product with its `functions/` folder convention doesn't apply here):
- `public/index.html` — the app, using `/api/storage` for shared state, `/api/anthropic` for the AI-assist features, and `/api/notify` for Telegram round-request/ready/results pings.
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

## 4. Set the Telegram bot token secret and chat ids

Only needed for the "start a round" / "results are in" notifications (skip this and the round-request/ready flow still works fully in-app, it just won't ping Telegram — `/api/notify` no-ops quietly with no bot token configured):

1. Message [@BotFather](https://t.me/BotFather) on Telegram to create a bot; it gives you a bot token (`123456:ABC-...`).
2. Cloudflare dashboard → your `etoitte` Worker → **Settings → Variables and Secrets** → **Add** → Name: `TELEGRAM_BOT_TOKEN`, paste the token, tick **Encrypt**, save.
3. Have each person message the bot directly (any text) so it has a pending update for their chat.
4. Fetch `https://api.telegram.org/bot<TOKEN>/getUpdates` to read each person's `chat_id` back out of those messages.
5. Store the mapping via the app's existing generic storage endpoint — `POST /api/storage` with `{"key":"telegram_chat_a","value":"\"<chat id for person a>\""}` (and the same for `telegram_chat_b`). The value has to be a JSON-encoded string (quotes included), matching how the client already writes everything through this endpoint.

## 5. Test
Visit the `*.workers.dev` URL (or custom domain) Cloudflare gives you. Do the setup screen, add a couple of spots, and from two browser tabs (or two devices) walk through "Start a round" → both people hit "I'm ready" → swipe → confirm shared storage and (if the token/chat ids are set up) the Telegram pings all work. Try the Maps-link autofill to confirm the Anthropic API key secret is wired up correctly.
