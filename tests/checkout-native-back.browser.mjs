// Run with PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/checkout-native-back.browser.mjs
// Optional CHECKOUT_HTML selects a historical fixture; EXPECT_BROKEN=1 proves regression sensitivity.
// Local-only handoff: no Stripe requests, customer data, or live fit-check IDs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync(process.env.CHECKOUT_HTML || new URL('../confirmed-fit-payment/index.html', import.meta.url), 'utf8');
const worker = 'https://offline-helper-payments.offline-helper-payments.workers.dev';
assert(source.includes(worker), 'Expected payment origin not found; review fixture transformation');
let posts = 0;
let origin;
const server = createServer((req, res) => {
  // A second guard prevents accidental external connections/submissions even if the source changes.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'");
  if (req.url === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ catalog: ['paid_rescue'] }));
  } else if (req.url === '/api/checkout' && req.method === 'POST') {
    posts++;
    req.resume();
    res.writeHead(303, { Location: '/handoff' });
    res.end();
  } else if (req.url === '/handoff') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>LOCAL test handoff</title><h1>LOCAL test handoff — no payment created</h1>');
  } else if (req.url === '/confirmed-fit-payment/') {
    res.setHeader('Content-Type', 'text/html');
    const instrumentation = `<script>window.testDocumentId = crypto.randomUUID(); window.testPageShows = []; addEventListener('pageshow', e => window.testPageShows.push(e.persisted));</script>`;
    res.end(source.replaceAll(worker, origin).replace('</head>', instrumentation + '</head>'));
  } else {
    res.writeHead(404);
    res.end('Fixture asset not provided');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'], args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const externalRequests = [];
  const errors = [];
  page.on('request', req => { if (!req.url().startsWith(origin + '/')) externalRequests.push(req.url()); });
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(origin + '/confirmed-fit-payment/');
  await page.waitForFunction(() => document.querySelector('#paid-rescue-status').textContent === 'Live in Stripe catalog.');
  const button = page.locator('form[data-tier="paid_rescue"] button');
  const originalLabel = await button.textContent();
  const documentId = await page.evaluate(() => window.testDocumentId);
  const cycles = [];
  for (let cycle = 1; cycle <= (process.env.EXPECT_BROKEN ? 1 : 2); cycle++) {
    await Promise.all([page.waitForURL(origin + '/handoff'), button.click()]);
    // BFCache restores without a new load event; observe URL and native pageshow instead.
    await page.evaluate(() => history.back());
    await page.waitForURL(origin + '/confirmed-fit-payment/', { waitUntil: 'commit' });
    await page.waitForFunction(() => window.testPageShows?.includes(true));
    const result = await page.evaluate(() => ({
      sameDocument: window.testDocumentId,
      pageShows: window.testPageShows,
      disabled: document.querySelector('form[data-tier="paid_rescue"] button').disabled,
      label: document.querySelector('form[data-tier="paid_rescue"] button').textContent,
    }));
    assert.equal(result.sameDocument, documentId, 'Must restore cached document, not reload');
    assert.equal(result.pageShows.at(-1), true, 'Native pageshow must report persisted=true');
    assert.equal(result.disabled, Boolean(process.env.EXPECT_BROKEN));
    assert.equal(result.label, process.env.EXPECT_BROKEN ? 'Opening Stripe…' : originalLabel);
    cycles.push({ cycle, nativeBFCache: true, disabled: result.disabled, label: result.label });
  }
  assert.equal(posts, cycles.length, 'Exactly one local fixture POST per click');
  assert.deepEqual(externalRequests, [], 'No external requests permitted');
  assert.deepEqual(errors, [], 'No browser script errors permitted');
  console.log(JSON.stringify({ result: 'PASS', mode: process.env.EXPECT_BROKEN ? 'historical-bug-reproduced' : 'fixed-recovery', browser: browser.version(), cycles, localFixturePosts: posts, externalRequests: externalRequests.length, pageErrors: errors }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
