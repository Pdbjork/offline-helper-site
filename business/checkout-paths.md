# Checkout paths (2026-07-20)

## Live static site
- https://offlinehelpers.com/ — pricing + `#hardware`
- https://offlinehelpers.com/fit-check/ → redirects to chat-with-pete
- https://offlinehelpers.com/chat-with-pete/
- https://offlinehelpers.com/confirmed-fit-payment/?tier=home_setup&fit_check_id=fc_…
- https://offlinehelpers.com/paid-rescue/

## Worker (Stripe sessions)
Base: `https://offline-helper-payments.offline-helper-payments.workers.dev`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | `{ ok, live_approved, catalog }` |
| POST | `/api/checkout` | body: `package`, optional `fit_check_id`, `customer_email` |
| POST | `/api/webhook` | Stripe signed |

## Package keys (after worker redeploy)

`home_setup` · `family_care_setup` · `org_setup` · `care_plan` · `paid_rescue` · `hw_edge` · `hw_home` · `hw_lab` · legacy `starter_setup` · `family_setup` · `family_support`

After Cloudflare redeploy, health should list the full catalog above; a missing key means live checkout for that package still returns 400.

## Redeploy worker (Pete)

```bash
ssh -i ~/.ssh/hostinger_ed25519_gmail root@2.24.127.166
# Rotate Cloudflare token into ~/.cloudflare_token (chmod 600)
cd /root/repos/offline-helper-site/worker
# Ensure src matches main (or rsync from Mac feature tree)
./deploy.sh --live
curl -sS https://offline-helper-payments.offline-helper-payments.workers.dev/api/health
```

## Optional: create Dashboard Price IDs

```bash
export STRIPE_SECRET_KEY='rk_live_…'   # never commit
node worker/scripts/create-stripe-catalog.mjs
# paste price_… into CATALOG and redeploy
```

Checkout already works without Dashboard prices via `price_data` once worker is redeployed.
