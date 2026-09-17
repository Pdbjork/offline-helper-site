# Checkout recovery without payment-status assumptions

## Problem

The Stripe worker sends canceled checkouts to `/payment-canceled/`. That static page offered only a homepage link and asserted payment had not completed, even though it does not look up a session. A returning buyer had no direct recovery or help route.

## Change

Both `/payment-canceled/` and the legacy `/payment-canceled.html` now link to the existing `/checkout/` router and the existing Pete email address. Fit, timing and price still need confirmation. Users who saw confirmation or are unsure must check with Pete before retrying. Neither the metadata nor body claims to verify payment status.

No payment endpoint, price, session creation, tracking, or message sending changed. Static aliases remain identical; no shared runtime dependency was introduced.

## Verification

- New recovery tests: two failures before implementation, four passing afterward.
- Full available Node tests including worker fulfillment: 8 passed, 0 failed.
- Browser preview at 320, 390 and 1280 CSS pixels: no horizontal overflow; actions at least 48px high.
- Keyboard Tab reaches the recovery link with a solid focus outline. Clicking it reaches `/checkout/` and its expected heading.
- Mobile screenshot visually checked. No purchase or email sent.
- Read-only code review found no regression; metadata neutrality caveat addressed with matching test.
- Reuse, quality and efficiency review found no worthwhile simplification. No configured HTML lint/typecheck; `git diff --check` passed.

## Post-Deploy Monitoring & Validation

Owner: Hayden, at deployment and next revenue loop. GET both aliases and compare deployed content with source. Check the recovery destination returns HTTP 200 and exposes fit/rescue/confirmed choices. Failure signals: missing links, non-200 response, mobile overflow, differing aliases. Revert this change via GitHub PR if needed; leave payment worker untouched.

Compare subsequent aggregate checkout completions and qualified questions with prior reports, without claiming attribution. No new tracking was installed, so CTA click-through and conversion lift are not measured.

## Reusable rule

Static payment-return pages cannot establish transaction state. Offer a guarded recovery route, human help and a duplicate-payment caution; keep compatibility routes aligned and test both.
