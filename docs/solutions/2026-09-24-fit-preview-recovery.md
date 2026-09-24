# Fit-check outage preview and retry

## Problem and baseline

The form collects apple_silicon as a boolean but local scoring compared it with yes/no strings. During Worker failure, known Mac configurations fell through to the unsupported-device result (20/100). Windows previews could offer payment with a client-generated ID despite no confirmed save. A malformed response with a numeric score could also expose checkout.

Before the patch, `node --test tests/fit-preview.test.mjs` returned 1 pass / 10 failures. The output reproduced wrong Mac scores and unconfirmed Windows checkout links.

## Narrow correction

- Compare the collected boolean when scoring known Apple Silicon/Intel answers.
- Distinguish local preview from saved response. Explain save failure, keep answers and retry button available, and provide the existing email help channel.
- Offer payment only after an HTTP-success response with ok=true, a valid fit-check ID, finite in-range score, boolean eligibility, textual reason and the current eligible home_setup tier.
- Keep prices, backend, API payload, checkout gates and personal-data collection unchanged.

Copy review: direct retry instruction, no urgency or new promises. No automatic email sent. No claim that a browser score proves a server-side save.

## Verification

`node --test tests/*.test.mjs worker/tests/*.test.mjs`: 25 passing test entries, zero failures.

`PLAYWRIGHT_MODULE=/root/.hermes/cache/scratch/checkout-browser-20260922/node_modules/playwright/index.mjs node tests/fit-preview.browser.mjs`: Chromium 153.0.8010.12, 390x844 viewport, all requests intercepted, two fixture POSTs, zero unexpected requests, zero page errors. Mac score 95; outage has no payment link; answers retained; successful retry restores payment with fixture server ID; no horizontal overflow.

`git diff --check`: pass.

Fixtures are not real leads or Worker/Stripe submissions. Browser test does not prove production storage, human follow-up, fulfillment, or conversion lift. Firefox/Safari untested.

## Release and rollback

Publish the four explicit application/test/document files through the existing main-branch GitHub Pages workflow. Read back PR state, build commit and canonical public HTML; require exact byte equality to the tested page. Revert the resulting release commit if regression evidence warrants it, then repeat public verification.

## Separate issues, not silently included

The optional email field is collected locally but omitted from the POST. Do not simply add it to answers: the current summary handler returns the saved record, so contact capture needs an access-control/redaction design and tests first. No new personal data storage in this fix.

The existing Not sure chip answer becomes false (Intel), and unresolved requests have no timeout. Both need distinct regression tests and deliberate behavior changes. This fix handles known chip answers and completed failure responses/network rejections, not all intake defects.
