import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'support/index.html'), 'utf8');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
let blocked = 0;
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin === 'https://offlinehelpers.com' && route.request().method() === 'GET') {
    const path = resolve(root, '.' + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : ''));
    if (path.startsWith(root + '/') && existsSync(path)) {
      await route.fulfill({ status: 200, contentType: path.endsWith('.html') ? 'text/html' : 'application/octet-stream', body: readFileSync(path) });
      return;
    }
  }
  blocked++;
  await route.abort();
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://offlinehelpers.com/support/');
    assert.equal(await page.locator('.actions .button').count(), 2);
    const primary = page.locator('.actions .primary');
    assert.equal(await primary.textContent(), 'Ask Pete about the $79/month plan');
    const mail = new URL(await primary.getAttribute('href'));
    assert.equal(mail.protocol, 'mailto:');
    assert.equal(mail.pathname, 'pdbjork@gmail.com');
    assert.equal(mail.searchParams.get('subject'), 'Offline Helper Care Plan question');
    assert.equal(await page.getByRole('link', { name: 'Current customer? Request support' }).getAttribute('href'), '/support-intake/');
    assert.equal(await page.getByRole('link', { name: 'Start a Telegram intake' }).getAttribute('href'), 'https://t.me/OfflineHelperPeteBot');
    assert.equal(await page.getByRole('link', { name: 'Open confirmed-fit payment' }).getAttribute('href'), '/confirmed-fit-payment/');
    assert.match(html, /Asking does not start a subscription/);
    assert.match(html, /ask Pete before trying again/);
    assert.equal(await page.locator('form').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await primary.evaluate(el => document.activeElement === el), true);
    assert.equal(await primary.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    for (const href of await page.locator('a[href^="/"]').evaluateAll(links => links.map(a => a.getAttribute('href')))) {
      assert.equal(existsSync(resolve(root, '.' + href + 'index.html')), true, href);
    }
    await page.getByRole('link', { name: 'Current customer? Request support' }).click();
    await page.waitForURL('https://offlinehelpers.com/support-intake/');
    console.log(`PASS width=${width}: CTA, privacy/payment guardrails, keyboard focus, no overflow, local support navigation`);
  }
  assert.deepEqual(errors, []);
  assert.equal(blocked, 0);
  console.log(`PASS Chromium ${browser.version()}; all requests fulfilled locally; no messages, leads or payments submitted`);
} finally { await browser.close(); }
