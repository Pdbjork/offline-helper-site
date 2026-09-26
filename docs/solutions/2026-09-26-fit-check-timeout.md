# Fit-check request timeout

## Business problem
A request that never completes leaves the fit-check button disabled on Checking, preventing the visitor from seeing the preview or contacting Pete from the result. This blocks an existing pre-purchase route; conversion uplift is not yet measured.

## Change
Abort the fetch after 15 seconds, including response body reading. Clear the timer in finally, including successful early returns. Preserve the existing local preview, retained answers, retry and email help; do not offer payment without a validated saved-fit response. Say saving could not be confirmed: a timeout does not prove the server failed to write.

## Regression evidence
New Chromium test fails on the original page with a 2-second fixture wait timeout. The fixture accelerates only the production 15000ms timer to 100ms and simulates a fetch stalled before headers or during JSON body reading. Test each at 320, 390 and 1280px, then retry with a successful synthetic response. Verify one abort, two requests, preserved answers, no payment on fallback, successful payment route on confirmed retry, no page errors and no horizontal overflow. No real customer records or payments are created. Synthetic outcomes are not sales or production endpoint verification.

Run:

    PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/fit-timeout.browser.mjs
    PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/fit-preview.browser.mjs
    node --test tests/*.test.mjs worker/tests/*.test.mjs
    git diff --check

The VM-based preview test must supply browser AbortController and timers in its sandbox. The original browser preview test must assert the revised uncertainty wording.

## Scope and limitations
No scoring, Worker, collection fields, price, subscription or analytics changes. Existing unknown-chip scoring and optional email handling concerns require separate fixes. Timeout abort cannot roll back a server write; retries may create another fit record under the existing ID scheme. No automatic retries. Browser timers may be delayed in background tabs. No Safari or Firefox execution in this change.

## Rollback
Revert this release commit through the existing main/GitHub Pages workflow and verify public page bytes against the rollback revision. Do not alter payment or Worker settings.
