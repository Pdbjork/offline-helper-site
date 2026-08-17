# Redacted intake stats endpoint pattern — 2026-08-17

## Context

Revenue is still $0 and the command-center report asked Offline Helper to log one intake metric for the next review: bot intakes, Skool joins, or paid rescue requests.

The existing Worker already stores checkout fulfillment tasks and fit-check records in KV. The fastest privacy-safe metric was to expose aggregate counts from that queue without returning customer email or private support details.

## Decision

Add a public `GET /api/stats` endpoint that returns only aggregate counts:

- total checkout fulfillment tasks
- total fit checks
- eligible fit checks
- counts by package
- counts by task status

Also make `GET /api/queue` redacted by default by removing `customer_email` from returned session records and replacing it with `customer_email_present: true|false`.

## Privacy boundary

Never return customer email, notes, transcripts, screenshots, passwords, recovery keys, or private support details from public metric endpoints. For public diagnostics, aggregate first and return booleans instead of identifiers.

## Verification

Worker test coverage added in `worker/tests/webhook-fulfillment-alert.test.mjs`:

- `/api/queue` does not include `customer@example.test` and marks `redacted: true`.
- `/api/stats` returns aggregate counts and does not include `customer@example.test`.
- Existing webhook fulfillment alert tests still pass.

Command run:

```bash
cd /root/repos/offline-helper-site/worker
npm test
```

Result:

```text
PASS webhook fulfillment alert tests
```

## Deployment note

`npm run deploy` was attempted from the Worker directory but blocked because the non-interactive environment has no `CLOUDFLARE_API_TOKEN` set. The code is committed/pushed-ready, but the live Worker does not expose `/api/stats` until a Cloudflare deploy is run with an approved token/session.
