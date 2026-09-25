# Care Plan inquiry and customer-support routing

## Problem and decision

The support landing page presented four adjacent buttons to buyers and current customers. Its Care Plan fit link led to a device suitability questionnaire rather than a plan-specific question. Give prospective subscribers one primary, price-explicit inquiry action using the existing published email channel. Keep current-customer support beside it, with a distinct label. Offer existing Telegram intake as an email-app fallback. Keep new-device checks, community access, and confirmed payment separate.

No new discount, response-time promise, entitlement, tracking, data collection, payment API or subscription behavior. Existing $79/month price and plan terms unchanged. Copy reviewed against stop-slop guidance: concrete actions, no invented urgency or outcomes. Conversion improvement is a hypothesis, not a measured result.

## Validation

Run from repository root:

    PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/care-plan-cta.browser.mjs
    node --test tests/*.test.mjs worker/tests/*.test.mjs
    git diff --check

Actual local result: Chromium 153.0.8010.12 passed at widths 320, 390, 1280; correct email recipient/subject, existing customer support navigation, Telegram fallback, confirmation/payment caution, no auto-subscription form, visible keyboard focus, no horizontal overflow, existing local link targets. All browser requests fulfilled from local files. No outbound message, form, payment or subscription submission. Existing suite: 25 passing, zero failing test entries.

## Release and rollback

Publish only this page, browser regression test and solution note through the existing GitHub Pages main workflow. Verify exact public HTML bytes against tested source after release. Roll back the release commit through the same workflow if a regression appears; verify public bytes again. Keep application and Worker changes out of this release.

## Measurement and limits

Count genuine Care Plan inquiries separately from existing customer requests, and paid subscriptions separately from questions. No test lead counts toward growth. Mail app and Telegram destination attributes were verified; delivery, bot fulfillment and real purchase behavior were not tested. No conversion uplift claimed. No new analytics added. Run Firefox/Safari coverage separately if required.
