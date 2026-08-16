# Checkout fulfillment alert — 2026-08-16

## Problem

Offline Helper has live Stripe checkout for paid rescue, but a completed checkout is only useful if it becomes a human scheduling task quickly. The existing webhook stored a redacted Stripe session in KV, but it did not explicitly label the item as a fulfillment task or attempt a real-time alert.

## Change

Updated the Cloudflare Worker webhook path so `checkout.session.completed` and `checkout.session.async_payment_succeeded` now:

- write a `checkout_fulfillment` task record to KV,
- mark it `needs_human_scheduling`,
- preserve the existing redacted checkout/session fields,
- try an optional Telegram alert when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are configured in Worker secrets,
- exclude customer email and fit-check answers from the alert text,
- keep the Stripe webhook successful even if alert secrets are missing or Telegram fails,
- record `fulfillment_alert` status in KV so operations can see whether notification was delivered/skipped/failed.

## Why this matters

For a $0-revenue baseline, the highest-risk first-dollar failure is missing or delaying the first paid customer after Stripe succeeds. This turns payment completion into an operational queue item plus optional immediate notification without exposing secrets or private customer details.

## Verification

Required checks:

- `npm test` from `worker/` passes.
- `node --check src/index.js` passes.
- `node --check tests/webhook-fulfillment-alert.test.mjs` passes.
- `git diff --check` passes from repo root.
- `./deploy.sh` dry-run succeeds before any live deploy attempt.
- Public Worker `/api/health` remains HTTP 200 after deployment.

## Deployment note

The 2026-08-16 live deploy attempt was blocked by Cloudflare API rate limiting (`code: 10429`). The code is committed and ready to deploy when the rate limit clears. If Telegram secrets are not configured, production checkout webhooks still create the KV task and mark the alert skipped instead of failing payment fulfillment.
