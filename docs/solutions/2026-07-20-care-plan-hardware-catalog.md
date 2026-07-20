# Solution: Care Plan + hardware offline tiers (2026-07-20)

## Problem
Offline Helper had pilot pricing ($149 / $249 / $29) and $0 Stripe revenue. Strategy required a retention product (Care Plan) plus curated hardware that maps offline depth → open-source model class.

## Decision
| Layer | Offer | Price |
|-------|-------|-------|
| L0 | Fit Check | Free |
| L1 | Home / Family Care / Micro-Org Setup | $497 / $997 / $1,500 |
| L2 | Care Plan (primary sub) | $79/mo |
| H1–H3 | Edge / Home Node / Open Model Lab | $349 / $1,499 / $3,997 |

Legacy pilot SKUs remain in the worker for open links.

## Checkout implementation
New SKUs use Stripe Checkout `price_data` when no Price ID is set, so catalog ships without a Dashboard round-trip. Optional script: `worker/scripts/create-stripe-catalog.mjs`.

## Deploy notes
- Static site: GitHub Pages `main` → offlinehelpers.com  
- Worker: Cloudflare `offline-helper-payments` (needs valid `CLOUDFLARE_API_TOKEN` on deploy host; VPS token was expired 2026-07-20)  
- Worker URL: `https://offline-helper-payments.offline-helper-payments.workers.dev`

## Funnel assets
- `business/funnel-emails.md`
- `business/funnel-posts-cold-warm.md`
- `business/offer-catalog.md`

## Residual risk
- Worker redeploy required before new package keys work live.
- Hardware fulfillment (shipping, tax, exact BOM) still human-confirmed after fit check.
- Cloudflare token rotation needed for deploy automation.
