# Offline Helper support-intake CTA route

Date: 2026-08-05

## Problem

The Revenue Command Center asked for one Offline Helper checkout/support CTA improvement. The public URL `/support-intake/` returned 404, while support copy needed a lower-friction path between general Care Plan details, Telegram, paid rescue, and checkout.

## Change

- Added `/support-intake/` as a static support router.
- Added a privacy-safe copy/paste starter note for Telegram or email.
- Routed the Care Plan card, support page hero CTA, pricing band, bottom CTA, and footer toward support intake.
- Kept payment behind fit/timing/scope confirmation.

## Validation checklist

- HTML parser accepts `index.html`, `support/index.html`, and `support-intake/index.html`.
- Internal link checker, excluding `node_modules`, reports 0 missing links.
- New support-intake page has 0 em dashes.
- Support-intake copy includes the privacy boundary: no passwords, recovery keys, private documents, medical/legal/financial details, crisis information, or sensitive screenshots.
- Worker health catalog still exposes `paid_rescue`, `care_plan`, and setup package keys before pointing users toward checkout.

## Pattern to reuse

When a static revenue site has a high-intent route returning 404, ship a short router page instead of sending visitors straight to checkout. The page should answer:

1. Which path fits me?
2. What do I send first?
3. What should I never send?
4. When does payment happen?

That creates a measurable landing page and a safer handoff without adding backend risk.
