# Offline Helper — AI visibility (schema.org) build

This directory contains the three pieces of work that close the four
"AI visibility" gaps Stripe's audit flagged: vague brand entity, no
authoritative citations, no answer-ready content, weak reputation
signals.

## What is in here

| File | What it does | Where it goes |
|---|---|---|
| `head-injection.html` | One `<script type="application/ld+json">` block: `Organization` + `LocalBusiness` + 3× `Service` with `Offer` blocks + `WebSite`. Tells AI models who you are, what you sell, and what it costs. | Paste into `index.html` directly before the closing `</head>` tag (after line 478, the `</style>`). |
| `../faq/index.html` | New `/faq/` page with `FAQPage` JSON-LD that directly answers the 7 buyer prompts Stripe surfaced + 2 "I wish I'd known this" additions. Single biggest AI-citation win. | Already written and saved. |
| `README.md` | This file. | — |

## What is NOT in here (and why)

- **No code changes to the Worker.** The Stripe integration
  walk-through is its own thread; AI visibility and Stripe live
  rollout are independent workstreams. Do not conflate.
- **No real Stripe price IDs in the JSON-LD.** The `Offer` blocks
  hardcode `$149.00`, `$249.00`, `$29.00` matching the catalog in
  the Worker. If Stripe pricing changes, update both at once.
- **No testimonials, review schemas, or aggregate rating.** We
  intentionally did not fabricate review counts. Add
  `AggregateRating` to `head-injection.html` only after you have
  real third-party reviews (Google Business, Trustpilot, etc.).

## How to ship (3 steps, ~10 minutes)

### Step 1 — Validate the FAQ page (no deploy yet)

Open the FAQ in a browser locally, or use Google's Rich Results Test:

- URL: https://search.google.com/test/rich-results
- Input: file path to `/offline-helper-site/faq/index.html`
- Expected: "FAQ" detected, 9 questions, 0 errors, 0 warnings.

Also validate the homepage block before pasting it:

- URL: https://validator.schema.org/
- Paste the contents of the `<script type="application/ld+json">`
  block from `head-injection.html`.

### Step 2 — Paste the head injection into `index.html`

Open `/offline-helper-site/index.html`, jump to line 478 (the
`</style>` line), and paste the entire `<script>` block from
`head-injection.html` immediately after it, before the `</head>`
tag on line 479.

Sanity check: the homepage should look identical visually. Schema
markup does not affect rendering.

### Step 3 — Deploy

From `/root/repos/offline-helper-site/`:

```bash
git add index.html faq/index.html seo/head-injection.html seo/README.md
git commit -m "Add FAQPage + Organization/Service JSON-LD for AI visibility"
git push origin main
```

GitHub Pages will deploy in ~60 seconds. Then re-validate:

```bash
curl -s https://offlinehelpers.com/ | grep -c 'application/ld+json'   # expect 2 (1 home + 1 from FAQ)
curl -s https://offlinehelpers.com/faq/ | grep -c 'FAQPage'             # expect 1
```

## How to know it worked

- **Google Search Console → Enhancements → FAQ**: should show 9
  detected questions within 3–7 days.
- **ChatGPT / Perplexity / Claude**: ask each of the 7 buyer
  prompts in 30 days. Expect at least 2–3 of them to cite
  offlinehelpers.com as a source. (These models crawl and update
  on a lag, not in real time.)
- **Stripe's re-audit**: the four gaps should be closed:
  "Answer-ready content for buyer prompts" — DONE
  "Clear, structured brand entity" — DONE
  "Authoritative third-party citations" — PARTIAL (Skool listed
  as `sameAs`; add podcast/Reddit mentions as you get them)
  "Reputation & review signals" — TODO (real reviews only)

## Maintenance

- **Pricing change**: edit `Offer.price` in `head-injection.html`
  AND the matching entry in `worker/src/index.js` `CATALOG`.
- **New product**: add a new `Service` block in
  `head-injection.html` AND a new entry in the Worker's
  `CATALOG`.
- **New FAQ question**: add a `<details>` block in
  `faq/index.html` AND a new `Question` / `acceptedAnswer` pair
  in the JSON-LD inside `<head>`. Keep them in the same order.

## What is "good enough" for a v1

This is a solid v1. It will not put you in the top result for
"best local AI setup service" on day one — that is the citations
and reviews work, which is months not hours. But it WILL get you
cited as <em>a</em> source for the prompts we targeted, and that
is the difference between Stripe's vague-hesitant-forgettable
current state and a real answer.
