# Checkout questions before payment

## Problem
The checkout router offered fit-check, rescue, and confirmed-payment routes but no direct question channel. Visitors unsure about price or a previous payment had to leave the page to find help.

## Change
Added a labeled help section with the existing public email address, the existing Telegram intake bot as an alternative, and instructions to continue an existing fit-check conversation. Added a warning to ask before repeating an uncertain payment. No payment backend, pricing, fit gate, tracking, or automated sending changed.

## Validation
- `node --test tests/*.test.mjs worker/tests/*.test.mjs`: 10 passing entries.
- `git diff --check`: passed.
- Browser DOM checks at widths 320, 390, 1280: no horizontal overflow; email action height 55.734375px.
- Email URI contains only the existing public recipient and encoded subject; no personal details or automatic send.
- Public Telegram target returned HTTP 200 with expected bot username. This does not verify bot responses or human availability.
- Check the public checkout HTML against source after Pages deployment before reporting live success.

## Reusable rule
Keep a human-question route on the checkout router, not only on payment-return pages. Reuse existing public channels, name bot intake accurately, preserve fit gating, and never infer payment state from static navigation. Do not test this change by creating live payments or synthetic leads.
