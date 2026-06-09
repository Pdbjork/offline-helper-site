# Offline Helper Payments Worker

Cloudflare Worker that creates Stripe Checkout Sessions and handles webhooks
for `offlinehelpers.com`. Holds the Stripe key in Cloudflare's secret store
so the key never lives in the static site or in chat.

## One-time setup

1. Install wrangler and log in:

   ```bash
   cd worker
   npm install
   npx wrangler login
   ```

2. Create a KV namespace and copy the id into `wrangler.toml`:

   ```bash
   npx wrangler kv namespace create OFFLINE_HELPER_QUEUE
   ```

3. Set the secrets (paste each value from your own secret manager):

   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

4. While in test mode, leave `STRIPE_LIVE_APPROVED = "0"` in `wrangler.toml`.

5. Deploy:

   ```bash
   npx wrangler deploy
   ```

   Wrangler prints a URL like
   `https://offline-helper-payments.<your-subdomain>.workers.dev`.

6. In the Stripe Dashboard, create a webhook endpoint pointing at:

   ```
   https://offline-helper-payments.<your-subdomain>.workers.dev/api/webhook
   ```

   Subscribe to `checkout.session.completed` and copy the signing secret
   into `STRIPE_WEBHOOK_SECRET` (Step 3).

7. Update the static site to call this Worker for the "Pay" buttons.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/checkout` | Create a Checkout Session. Body: `{ package, fit_check_id?, customer_email?, setup_window? }`. Returns `{ url, session_id }`. |
| POST | `/api/webhook` | Stripe-signed. Verifies signature, stores one redacted row in KV on `checkout.session.completed`. |
| GET  | `/api/queue`   | Staff debug view of the redacted fulfillment queue. |
| GET  | `/api/health`  | Returns `{ ok, live_approved, catalog }`. |

## Going live

When the bank account is connected in the Stripe Dashboard and you have
created the three live-mode products, do the following from your own shell:

```bash
# Rotate the test key in the Stripe Dashboard, then:
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# Flip the live flag in wrangler.toml:
#   STRIPE_LIVE_APPROVED = "1"
npx wrangler deploy
```

The Worker refuses to run if the key prefix does not match the live flag.
The Stripe key itself lives only in Cloudflare's secret store.
