# Community talk lead magnet route — 2026-08-14

## Problem

Offline Helper had a strong paid-rescue path and a free checklist, but the partner/community outreach copy pointed only to email or general site links. That made library, church, senior center, school, and caregiver-group asks harder to approve, share, or measure.

## Change

Created `/community-talk/` as a no-pressure public landing page for a free 20-minute talk:

- “Private AI on your own computer — what families should know before they pay.”
- No product pitch in the room.
- Clear audience fit: libraries, churches, senior centers, schools, caregiver groups, nonprofits.
- Copy/paste invite note for email/Telegram.
- Privacy boundaries: no passwords, recovery keys, private documents, medical/legal/financial details, or crisis information.
- Conversion path after education: free checklist, free Skool, free fit check, or $99 rescue when stuck today.

Also linked the page from:

- Homepage nav, hero, community section, final CTA, and footer.
- `/start/` router with a group-specific card.
- `business/funnel-emails.md` partner outreach template.
- `business/funnel-posts-cold-warm.md` partner invite post.

## Why this matters

This turns a vague “happy to send a one-pager” outreach ask into a shippable, trackable, shareable offer that can grow followers/subscribers and warm leads without violating consent or sending external messages automatically.

## Verification

Run the repo HTML/link checker or equivalent after changes. Required checks:

- `/community-talk/index.html` parses as HTML.
- Homepage links to `community-talk/index.html`.
- `/start/` links to `/community-talk/`.
- No forbidden secret-like strings appear in customer-facing files.
- Public URL returns HTTP 200 after GitHub Pages deploy.
