# Family-forward paid rescue copy

Date: 2026-08-31
Repo: `/root/repos/offline-helper-site`

## Problem

The paid rescue page already had a direct $99 rescue CTA, Telegram starter note, and Stripe-after-confirmation path. The remaining conversion gap was the likely buyer path: an adult child or caregiver may need to forward a safe, non-hype explanation to a parent/loved one before booking.

## Change shipped

Added a `Helping a parent or loved one? Send this first.` section to `/paid-rescue/` with:

- Copyable family-forward note.
- UTM-tagged share URL: `utm_source=family_forward&utm_medium=share_copy`.
- Safety proof bullets: fixed scope, consent first, private by default.
- Copy helper shared with the Telegram starter-note button.

## Why it matters

This turns a cold paid page into a forwardable offer. It supports the actual first buyer segment from the homepage copy: adult children, caregivers, and family helpers who are trying to get consent and clarity before a screen-share or payment.

## Verification

- HTML parser parsed `paid-rescue/index.html`.
- Internal link target check passed for edited page.
- Inline script extracted and checked with `node --check /tmp/paid-rescue-inline.js`.
- Worker tests passed with `npm test` in `worker/`.
- Commit pushed to GitHub: `22a0d1d feat(marketing): add family-forward rescue copy`.
- GitHub Pages build `33400427592` completed successfully.
- Public page verification passed: `https://offlinehelpers.com/paid-rescue/?utm_source=family_forward&utm_medium=verification` includes the family-forward section.

## Remaining blocker

The live Worker health endpoint reports `paid_rescue` in the catalog, but `/api/stats` still returns HTTP 404. Wrangler dry-run works locally, but `wrangler whoami` says this host is not authenticated for Cloudflare deploys. The worker source already contains `/api/stats`; deployment/auth is the blocker.
