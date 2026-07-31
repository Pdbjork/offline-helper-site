# Checkout and support intent pages

Date: 2026-07-31

## Context

The Revenue Command Center named an Offline Helper checkout/support CTA pass as a priority while the public site returned GitHub Pages 404s for `/checkout/` and `/support/`. The homepage had fit-check, rescue, Skool, and checklist paths, but a buyer typing or following a generic checkout/support URL hit a dead page.

## Change

Created two static intent pages:

- `/checkout/` routes visitors to the right payment lane:
  - free fit check first for new setup, Care Plan, or hardware
  - `$99` paid rescue for urgent stuck setups
  - confirmed-fit Stripe payment only after Pete confirms fit, timing, and package
- `/support/` explains the `$79/month` Care Plan as post-install support and routes to fit check, checkout, or Skool.

Updated homepage CTAs so Care Plan and checkout intent are visible from pricing, final CTA, and footer.

## Revenue reason

This removes two high-intent 404s and gives warm prospects a safer path to paid setup, rescue, or subscription support without breaking the consent-first rule that setup payment follows fit confirmation.

## Safety and privacy guardrails

Both pages repeat the no-secrets rule: no passwords, recovery keys, private documents, medical, legal, financial, or crisis details in checkout, email, Telegram, screenshots, or research forms.

## Verification checklist

- Parse all changed HTML with Python `HTMLParser`.
- Validate JSON-LD in `/support/` with `json.loads` from the script tag.
- Confirm required phrases and links exist in the changed files.
- Run `git diff --check`.
- After GitHub Pages deploy, probe:
  - `https://offlinehelpers.com/checkout/` returns `200` and contains `Use the right checkout path`.
  - `https://offlinehelpers.com/support/` returns `200` and contains `Support after install day`.
