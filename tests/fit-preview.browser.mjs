// Local HTML + intercepted fixtures only. No production submissions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const html = readFileSync(new URL('../chat-with-pete/index.html', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  let fixturePosts = 0;
  let success = false;
  const unexpected = [];
  await context.route('**/*', async route => {
    const request = route.request();
    if (request.url() === 'http://fit-preview.test/chat-with-pete/') {
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    if (request.url().endsWith('/api/fit-check/complete')) {
      fixturePosts++;
      const body = request.postDataJSON();
      assert.equal(body.answers.apple_silicon, true);
      return route.fulfill({ status: success ? 200 : 503, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(success ? { ok: true, fit_check_id: 'fc_browser_fixture', score: 95,
          eligible: true, tier: 'home_setup', reason: 'Local fixture response' } : { error: 'Local outage fixture' }) });
    }
    if (!/\.(png|jpg)$/.test(request.url())) unexpected.push(request.url());
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://fit-preview.test/chat-with-pete/');
  await page.check('input[name=device_kind][value=mac]');
  await page.check('input[name=apple_silicon][value=yes]');
  await page.fill('#os_version', 'macOS fixture');
  await page.fill('#ram_gb', '16');
  await page.fill('#primary_goal', 'Test fixture only');
  await page.selectOption('#comfort_level', 'some');
  await page.click('#submit-btn');
  await page.waitForFunction(() => document.querySelector('#result-slot').textContent.includes('could not save'));
  assert.match(await page.locator('#result-slot').innerText(), /Score: 95\/100/);
  assert.equal(await page.locator('#result-slot a[href*="confirmed-fit-payment"]').count(), 0);
  assert.equal(await page.inputValue('#primary_goal'), 'Test fixture only');
  assert.equal(await page.locator('#submit-btn').isEnabled(), true);
  success = true;
  await page.click('#submit-btn');
  const payment = page.locator('#result-slot a[href*="confirmed-fit-payment"]');
  await payment.waitFor();
  assert.match(await payment.getAttribute('href'), /fc_browser_fixture/);
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  assert.equal(fixturePosts, 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log(JSON.stringify({ browser: browser.version(), viewport: '390x844', fixturePosts,
    allRequestsIntercepted: true, pageErrors: errors.length, unexpectedRequests: unexpected.length,
    macScore: 95, outageNoPayment: true, retainedAnswers: true, retryPaymentRestored: true, horizontalOverflow: false }));
} finally { await browser.close(); }
