# Family AI Safety Checklist Funnel — 2026-07-23

## Context

Revenue baseline was still $0 with no recent Stripe checkout sessions or charges in the latest Revenue Command Center report. The report asked for one revenue-page improvement today. Offline Helper already had fit-check, paid-rescue, setup, Care Plan, and community CTAs, but the research-list/subscriber path was mostly a `mailto:` CTA with a high-friction blank-page problem.

## Change shipped

- Added `/family-ai-safety-checklist/` as a free, no-email-wall lead magnet.
- Replaced several homepage research-list CTAs with a clearer checklist CTA.
- Added a copyable follow-up note that asks permission to follow up while warning users not to send passwords, recovery keys, private documents, medical/legal/financial details, or crisis information.
- Kept the ladder explicit: free checklist → free fit check / free community → $99 rescue if stuck today → $497+ paid setup only after confirmed fit.

## Why this supports revenue/subscribers

- Gives warm prospects a concrete asset to share before booking.
- Creates a softer subscriber/follow-up signal without collecting private data or requiring a backend form.
- Improves conversion path for adult children/caregivers who are not ready to pay but can forward a checklist.
- Keeps Offline Helper's trust posture strong: consent first, no secret collection, no pressure before fit.

## Verification run

Commands:

```bash
python3 <site-validator>  # checked site HTML excluding node_modules
python3 -m http.server smoke test via Python subprocess
curl -sS -L https://offlinehelpers.com/
curl -sS -L https://offlinehelpers.com/family-ai-safety-checklist/
```

Results before push:

- Validator: `VALIDATION_OK: checked 16 site html files excluding node_modules`
- Local smoke: `/`, `/family-ai-safety-checklist/`, `/fit-check/`, `/paid-rescue/`, and `/assets/brand/offline-helpers-mark.png` returned 200.
- Git push: `084bb5f feat: add family AI safety checklist funnel` pushed to `origin/main`.

Live GitHub Pages note:

- Immediately after push, `https://offlinehelpers.com/` still served the pre-deploy cached homepage and `https://offlinehelpers.com/family-ai-safety-checklist/` still returned 404. That is consistent with GitHub Pages deploy/cache lag, not local build failure. Re-probe before claiming public live success.

## Follow-up ideas

1. Add a lightweight backend capture endpoint or approved email draft workflow so copy-note follow-ups become queued human-review leads instead of manual mailto only.
2. Add a share image/social card for the checklist.
3. After the page is live, post/share only with Uncle Pete approval using the same consent-first copy.
