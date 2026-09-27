# Unknown Mac chip: resolve uncertainty before recommending payment

## Problem and scope

The static fit form converted both `no` and `unsure` to `apple_silicon: false`. The Worker treats false as Intel, so an unknown Mac could receive a false rejection or a package recommendation based on guessed hardware. This change affects the static page only; it does not change or deploy the Worker, pricing, fulfillment, analytics, attribution, email collection or any API contract.

## Reproduced baseline

`PLAYWRIGHT_MODULE=/root/.hermes/cache/scratch/fit-browser-20260926/node_modules/playwright/index.mjs node tests/fit-unknown-chip.browser.mjs` failed against unchanged HTML: `unknown chip must not be saved as Intel`, actual intercepted POST count 1, expected 0.

After adding the unknown-chip guard, the browser test found another existing defect: `.field { display: block }` overrode the `hidden` attribute, so the Apple question remained visible after selecting Windows. The visibility assertion failed (`false !== true`). A scoped `.field[hidden] { display: none }` rule fixes it.

## Implementation

- Preserve unknown Mac chip as null in the local answer object.
- After form validation, intercept unknown Macs before scoring, UUID generation, timers or network calls.
- Replace the result with identification instructions and a mailto help link; no score, fit ID, eligibility judgment or payment link.
- Focus the help heading for keyboard/screen-reader navigation; retain entered answers.
- Users can identify the chip and submit again through the unchanged confirmed-fit flow.
- Label the question M1-or-newer rather than stopping at M4. Avoid the brittle claim that the chip is on a particular line.
- Do not ask for serial numbers or passwords. No automatic email or new personal-data collection.

Copy reviewed using stop-slop guidance. No response-time, privacy or performance guarantee added.

## Verification

Passed Chromium 153.0.8010.12 fixtures at 320, 390 and 1280px:

- Initial chip field hidden, visible for Mac, hidden for Windows.
- Missing chip selection rejected without POST.
- Not sure at 8GB and 16GB: zero POSTs, no false score/rejection/payment, focused help.
- Previously rendered payment result replaced after an unknown-chip submission.
- Yes and No preserve true/false values; Windows retains its existing false value.
- Exactly three known-device fixture submissions per viewport; all intercepted.
- Preserved answers, enabled submit, no page errors, no unexpected requests or horizontal overflow.

Also passed existing fit-preview browser test, all six stalled-header/body timeout/retry cases, `node --test tests/*.test.mjs worker/tests/*.test.mjs` (25 passing entries), and `git diff --check`.

All browser routes intercepted. No production fit record, lead, email or payment created. No Safari/Firefox or fulfillment verification. Local fixtures are not demand or sales evidence.

## Boundaries and rollback

Worker scoring still accepts ambiguous inputs from direct API clients; this frontend guard does not harden that separate endpoint. Existing performance/scoring claims and guessed-RAM hint were not validated in this task. Optional email handling needs a separate privacy/storage review. Do not expand collection as part of this fix.

Rollback: revert the release commit via the existing main/Pages workflow, then compare public HTML to the reverted source. Before any future form refactor, run the unknown-chip, outage and timeout fixtures together; never collapse an unknown hardware answer into a known negative.
