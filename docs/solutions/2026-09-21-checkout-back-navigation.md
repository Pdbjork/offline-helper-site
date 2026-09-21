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

## Rollback

Revert the dedicated commit that adds this change. No schema, backend, or data rollback is needed. Do not reset unrelated work.

## Reusable checklist

Any checkout control disabled for navigation needs a Back/forward restoration test. Track transient submission state separately from catalog/safety state, and test the late-response ordering explicitly.
