# Restore checkout buttons after browser Back

## Evidence and scope

Public GETs of `/checkout/` and `/confirmed-fit-payment/` returned HTTP 200 on 2026-09-21. The confirmed-payment source disables package form buttons on submit but does not restore them on `pageshow`. Browsers that preserve the page in back/forward cache can therefore return a customer to a disabled “Opening Stripe…” button.

This change handles package form buttons only. It does not change the separate hero CTA, server authorization, prices, Stripe session creation, fit validation, or payment status. Returning to the page is not proof a payment failed; the existing checkout router instructs uncertain buyers to ask Pete before retrying.

## Implementation

Keep original labels in a page-local Map only for buttons this submit handler disables. On `pageshow`, restore those buttons and clear the Map. A missing-catalog response removes its button from the Map before disabling it, so a late safety response wins over recovery. Already-disabled buttons are not recorded.

## Verification

- Before the change, `node --test tests/checkout-back-navigation.test.mjs`: 2 failures, 2 passes. Recovery and repeated-submit tests failed as expected.
- After the change, `node --test tests/*.test.mjs worker/tests/*.test.mjs`: 14 passing test entries, zero failures.
- `git diff --check`: pass.
- Real browser DOM, isolated about:blank page: evaluated the exact page script with a mocked health response, prevented submit default, dispatched `pageshow` with `persisted: true`. Submission prevented, busy state observed, button enabled afterward, original label restored: all true.
- The initial browser fixture had a syntax error in the injected fetch mock; its false busy-state result was rejected. Corrected the fixture and reran successfully. This was not an application-code failure.

No live checkout POST, payment, lead submission, email, or message was made. Browser verification simulated the restoration event; it did not demonstrate native back/forward cache eligibility or a completed Stripe round trip.

## Release checklist

1. Review this small patch and run the regression command above.
2. Before release, test native browser Back on a staging/local payment handoff with all checkout POSTs intercepted; never create a live payment to test this.
3. Publish through the existing GitHub Pages release process, then read back `/confirmed-fit-payment/` and verify the exact shipped script. No release occurred in this run.
4. Record real confirmed-fit conversations, checkout completions and revenue separately. Passing tests are not conversions.

## Native browser verification — 2026-09-22

Added `tests/checkout-native-back.browser.mjs`. This serves the actual payment HTML on an ephemeral loopback port, replaces only the Worker origin with the fixture origin, and adds a native pageshow observer. A local POST redirects to a clearly labeled local handoff; no Stripe session is created. A restrictive CSP limits connections and form submissions to the fixture origin. The test also asserts zero external page requests and zero browser script errors. The server and browser close in finally blocks.

Executed with Playwright 1.63.0 and full Chromium 153.0.8010.12:

- Historical HTML from `7e0650f^`: native BFCache restoration reproduced disabled=true and `Opening Stripe…` (expected-broken assertion passed).
- Current HTML: two consecutive submit/Back cycles restored enabled buttons and original labels. Native `pageshow.persisted=true` and the same document UUID establish actual BFCache restoration, not a synthetic event or reload.
- Historical run: one local fixture POST; fixed run: two. Both runs: zero external page requests, zero page errors.
- Existing Node suite: 14 passes, zero failures. `git diff --check`: passed.
- Public GET returned 200 but did not contain `pendingButtons`; the fix remains unshipped at the time of this check.

Reproduce (install development dependencies outside the site, not in its public tree):

    npm install --prefix /root/.hermes/cache/scratch/checkout-browser-20260922 --no-audit --no-fund --ignore-scripts playwright@1.63.0
    /root/.hermes/cache/scratch/checkout-browser-20260922/node_modules/.bin/playwright install chromium
    PLAYWRIGHT_MODULE=/root/.hermes/cache/scratch/checkout-browser-20260922/node_modules/playwright/index.mjs node tests/checkout-native-back.browser.mjs

For regression sensitivity, extract `git show 7e0650f^:confirmed-fit-payment/index.html` into a scratch file, then supply its absolute path as `CHECKOUT_HTML` and set `EXPECT_BROKEN=1` with the same command. No customer data or real fit ID is needed.

Harness troubleshooting encountered during this run: the first launch lacked its matching browser build; installed it. The headless-shell run did not produce a persisted event, so switched to full Chromium via channel=chromium. Waiting for a new load event after Back then timed out; changed the harness to native history.back(), URL commit observation, and pageshow assertions, since cache restoration does not require a new load. Failed attempts were not counted as verification.

Limits: this verifies local Chromium restoration for the paid-rescue package control, not Safari/Firefox, the separate hero CTA, live Stripe redirects, fulfillment, or payment success. Existing unit tests separately cover catalog-disable precedence. Release checklist item 2 above is now satisfied for this local Chromium handoff; production deployment/readback remains outstanding. Do not interpret test success as revenue or conversion lift.

## Rollback

Revert the dedicated commit that adds this change. No schema, backend, or data rollback is needed. Do not reset unrelated work.

## Reusable checklist

Any checkout control disabled for navigation needs a Back/forward restoration test. Track transient submission state separately from catalog/safety state, and test the late-response ordering explicitly.
