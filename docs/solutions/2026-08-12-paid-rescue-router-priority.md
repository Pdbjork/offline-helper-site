# 2026-08-12 — Paid rescue router priority

## Context

The revenue command-center report for 2026-08-12 said to pick one revenue-page improvement: Offline Helper checkout/support CTA or Hermosskills operator CTA. Hermosskills got the low-friction weekly teardown CTA on 2026-08-11. Offline Helper already had a live $99 paid rescue checkout, but the homepage and start router still made visitors choose among many paths before seeing the fastest paid option.

## Change

Surface the $99 rescue path earlier without breaking the safety-first funnel:

- Homepage nav adds a tracked `$99 rescue` link.
- Homepage top-right nav button now points to the paid rescue page with UTM tracking.
- Homepage trust row names `$99 rescue when stuck today`.
- `/start/` adds a prominent paid rescue strip above the option grid.
- Copy keeps fit, timing, and privacy confirmation before payment.

## Why it matters

When revenue is $0, the lowest-priced live checkout is the fastest first-dollar path. The page should still protect families from pressure, but a stuck visitor needs the paid path visible before they scroll through the full service menu.

## Verification

- HTML parser smoke checked: `index.html`, `start/index.html`, `paid-rescue/index.html`, `family-ai-safety-checklist/index.html`, `fit-check/index.html`, `checkout/index.html`, `support-intake/index.html`.
- Static content checks passed for the new UTM links and paid rescue strip copy.
- `git diff --check` passed.
- Worker health returned 200 and catalog includes `paid_rescue`.

## Reuse pattern

When a live checkout exists and revenue is still zero, make the cheapest paid path visible in the first decision screen, then keep the consent/payment guardrails beside it. Do not bury the paid path behind a general router once the checkout is live.
