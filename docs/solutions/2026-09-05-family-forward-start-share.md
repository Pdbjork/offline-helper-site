# Family-forward start share path

Date: 2026-09-05
Repo: `/root/repos/offline-helper-site`

## Problem

Offline Helper's start page already routed buyers to free checklist, fit check, paid rescue, support, and checkout. The adult-child/caregiver buyer still had friction: they needed copy they could send to a parent or loved one before booking or paying.

## Change shipped

Added a family-forward share card near the top of `/start/` with:

- a consent-first explanation for adult children and caregivers,
- a copyable family text-thread note,
- tracked links to `$99 rescue` and the free safety checklist,
- clipboard fallback behavior for browsers that block `navigator.clipboard`.

## Safety boundaries kept

The copy tells families not to send passwords, recovery keys, private files, medical/legal/financial details, or crisis details in chat. It points to reading the start page together and choosing the free path first unless the setup is stuck today.

## Verification

Commands run:

```bash
node tests/start-family-forward.test.mjs
node worker/tests/webhook-fulfillment-alert.test.mjs
python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path
import json, re
for page in ['index.html','start/index.html','paid-rescue/index.html']:
    html=Path(page).read_text()
    HTMLParser().feed(html)
    for block in re.findall(r'<script type="application/ld\\+json">(.*?)</script>', html, re.S):
        json.loads(block)
    print('PASS parse/jsonld', page, len(html))
PY
```

Live check after GitHub Pages deploy:

- `https://offlinehelpers.com/start/` returned HTTP 200.
- Live body contained `id="family-forward-title"`.
- Live body contained `utm_source=family_forward&utm_medium=share_copy`.

## Reuse pattern

For family-buyer pages, add a copyable note before the paid CTA. The note should mention the concrete service, the free/no-pressure route, the privacy boundary, and a tracked public URL. Test it with a static Node assertion so future edits do not remove the tracked path.
