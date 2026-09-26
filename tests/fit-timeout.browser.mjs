// Synthetic browser fixtures only; all network requests intercepted.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const html = readFileSync(new URL('../chat-with-pete/index.html', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [320, 390, 1280]) {
    for (const failure of ['headers', 'body']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const unexpected = [], errors = [];
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.href === 'http://localhost/chat-with-pete/') return route.fulfill({ contentType: 'text/html', body: html });
        if (!url.pathname.endsWith('.png')) unexpected.push(url.href);
        return route.abort();
      });
      await context.addInitScript(({ failure }) => {
        window.fixture = { calls: 0, aborts: 0, timers: [], mode: failure };
        const originalTimer = window.setTimeout.bind(window);
        window.setTimeout = (fn, ms, ...args) => {
          if (ms === 15000) { window.fixture.timers.push(ms); return originalTimer(fn, 100, ...args); }
          return originalTimer(fn, ms, ...args);
        };
        window.fetch = async (url, options) => {
          if (!url.endsWith('/api/fit-check/complete')) throw new Error('Unexpected fetch');
          window.fixture.calls++;
          const pending = () => new Promise((resolve, reject) => {
            options.signal?.addEventListener('abort', () => {
              window.fixture.aborts++;
              reject(new DOMException('Fixture abort', 'AbortError'));
            }, { once: true });
          });
          if (window.fixture.mode === 'headers') return pending();
          if (window.fixture.mode === 'body') return { ok: true, json: pending };
          options.signal?.addEventListener('abort', () => { window.fixture.aborts++; }, { once: true });
          return { ok: true, json: async () => ({ ok: true, fit_check_id: 'fc_timeout_fixture', score: 95,
            eligible: true, tier: 'home_setup', reason: 'Synthetic success fixture' }) };
        };
      }, { failure });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://localhost/chat-with-pete/');
      await page.check('input[name=device_kind][value=mac]');
      await page.check('input[name=apple_silicon][value=yes]');
      await page.fill('#os_version', 'macOS fixture');
      await page.fill('#ram_gb', '16');
      await page.fill('#primary_goal', 'Synthetic fixture only');
      await page.selectOption('#comfort_level', 'some');
      await page.click('#submit-btn');
      await page.waitForFunction(() => document.querySelector('#result-slot').textContent.includes('preview'), { }, { timeout: 2000 });
      assert.equal(await page.locator('#submit-btn').isEnabled(), true);
      assert.equal(await page.locator('#result-slot a[href*="confirmed-fit-payment"]').count(), 0);
      assert.equal(await page.inputValue('#primary_goal'), 'Synthetic fixture only');
      assert.match(await page.locator('#result-slot').innerText(), /could not confirm/);
      assert.equal(await page.locator('#result-slot a[href^="mailto:"]').count(), 1);
      await page.evaluate(() => { window.fixture.mode = 'success'; });
      await page.click('#submit-btn');
      await page.locator('#result-slot a[href*="fc_timeout_fixture"]').first().waitFor();
      await page.waitForTimeout(150); // Detect a success timer that was not cleared.
      const fixture = await page.evaluate(() => window.fixture);
      assert.deepEqual(fixture, { calls: 2, aborts: 1, timers: [15000, 15000], mode: 'success' });
      assert.equal(await page.locator('#submit-btn').isEnabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      console.log(JSON.stringify({ width, failure, timeoutRecovery: true, retrySuccess: true, fixtureCalls: fixture.calls, networkSubmissions: 0 }));
      await context.close();
    }
  }
  console.log('PASS: six timeout/retry cases; no production submissions.');
} finally { await browser.close(); }
