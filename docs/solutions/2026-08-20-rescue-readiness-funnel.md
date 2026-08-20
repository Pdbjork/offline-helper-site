# 2026-08-20 — Rescue readiness funnel

## Problem

Offline Helper had a clear $99 paid rescue offer, but urgent visitors had only two choices: request a Telegram slot immediately or fall back to broader fit-check/setup pages. That can lose buyers who are interested but unsure whether their stuck local-AI setup qualifies.

## Change

Added a pre-payment rescue-readiness page:

- URL: `/rescue-readiness/`
- Buyer intent: "I am stuck today, but I am not sure whether paid rescue is the right lane."
- Core conversion asset: copy/paste Telegram starter note with device, failed step, desired outcome, timezone, and safety boundary.
- Revenue path: page links to `/paid-rescue/` with UTM source `rescue_readiness`.
- Safety path: page routes uncertain visitors to `/fit-check/` instead of pushing payment.
- AI visibility: page includes FAQPage JSON-LD for urgent rescue/fit-check questions.

Linked the page from:

- Homepage nav
- Homepage hero actions
- Homepage $99 rescue strip
- Start router urgent strip
- Paid rescue page uncertainty CTA

## Pattern to reuse

When a paid service has a trust/fit gate, add a small "readiness" page between education and purchase. It should:

1. Name the exact paid-lane fit criteria.
2. Include a safe copy/paste inquiry note.
3. Preserve an ethical non-buy path.
4. Use UTM-tagged links so future logs can distinguish readiness traffic from direct purchase traffic.
5. Add visible Q&A plus JSON-LD so AI/search can quote the decision boundary.

## Verification

Run:

```bash
python3 - <<'PY'
import json, re, pathlib
for path in ['index.html','start/index.html','paid-rescue/index.html','rescue-readiness/index.html']:
    html = pathlib.Path(path).read_text()
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        json.loads(block)
    print('OK', path)
PY

git diff --check
python3 -m http.server 8080
curl -I http://127.0.0.1:8080/rescue-readiness/
```

After deploy, verify live:

```bash
curl -fsSL https://offlinehelpers.com/rescue-readiness/ | grep -E 'Rescue readiness checklist|application/ld\\+json'
curl -fsSL https://offlinehelpers.com/ | grep -F 'Check rescue readiness'
curl -fsSL https://offlinehelpers.com/start/ | grep -F 'Check readiness'
curl -fsSL https://offlinehelpers.com/paid-rescue/ | grep -F 'Not sure? Check readiness'
```
