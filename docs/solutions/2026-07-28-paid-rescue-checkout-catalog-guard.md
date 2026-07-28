# Paid rescue checkout catalog guard

Date: 2026-07-28
Project: Offline Helper

## Problem

The $99 paid rescue offer had a public request page, but no matching `paid_rescue` package in the Cloudflare Worker Stripe catalog. Adding the static checkout form before the Worker deploy completes can create a broken payment button.

## Pattern

When a static page depends on a Worker catalog key:

1. Add the package key to `worker/src/index.js`.
2. Add the visible checkout form to the static page, but keep it hidden or disabled by default.
3. On page load, fetch the Worker health endpoint.
4. Reveal or enable only when `data.catalog` includes the required key.
5. Show a plain fallback message when the Worker catalog is not live yet.
6. Guard any top-page primary CTA too, not just the form button.

## Applied here

- New catalog key: `paid_rescue`, $99 one-time payment.
- `/paid-rescue/` hides the Stripe form unless `/api/health` lists `paid_rescue`.
- `/confirmed-fit-payment/?tier=paid_rescue` disables both the package button and the hero CTA while the catalog key is missing.
- Customer fallback remains Telegram confirmation first.

## Verification

- `node --check worker/src/index.js`
- HTML parser check for `paid-rescue/index.html` and `confirmed-fit-payment/index.html`
- `git diff --check`
- Browser check confirmed the public paid rescue page hides the form while the Worker catalog lacks `paid_rescue`.
- Browser check confirmed the confirmed-fit payment page disables the paid-rescue CTA while the Worker catalog lacks `paid_rescue`.

## Blocker noted

`wrangler deploy` was blocked by Cloudflare API rate/auth errors after a successful dry-run. Static pages are safe because the catalog guard keeps the new checkout path disabled until the Worker deploy succeeds.
