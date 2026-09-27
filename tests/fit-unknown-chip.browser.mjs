// Synthetic browser fixtures only; all requests intercepted, no live writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const html = readFileSync(new URL('../chat-with-pete/index.html', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const posts = [], errors = [], unexpected = [];
    await context.route('**/*', async route => {
      const request = route.request();
      if (request.url() === 'http://fit-chip.test/chat-with-pete/') {
        return route.fulfill({ contentType: 'text/html', body: html });
      }
      if (request.url().endsWith('/api/fit-check/complete')) {
        posts.push(request.postDataJSON());
        return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ ok: true, fit_check_id: 'fc_chip_fixture', score: 55,
            eligible: true, tier: 'home_setup', reason: 'Synthetic eligible response' }) });
      }
      if (!/\.(png|jpg)$/.test(request.url())) unexpected.push(request.url());
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://fit-chip.test/chat-with-pete/');
    assert.equal(await page.locator('#apple-silicon-field').isHidden(), true);
    await page.check('input[name=device_kind][value=mac]');
    assert.equal(await page.locator('#apple-silicon-field').isVisible(), true);
    await page.fill('#os_version', 'macOS fixture');
    await page.fill('#ram_gb', '16');
    await page.fill('#primary_goal', 'Synthetic fixture only');
    await page.selectOption('#comfort_level', 'some');
    await page.click('#submit-btn');
    assert.match(await page.locator('#error-slot').innerText(), /Tell us/);
    assert.equal(posts.length, 0, 'unanswered chip must not submit');
    await page.check('input[name=apple_silicon][value=unsure]');
    await page.click('#submit-btn');
    await page.locator('#result-slot h2').waitFor();
    assert.equal(posts.length, 0, 'unknown chip must not be saved as Intel');
    for (const ram of ['8', '16']) {
      await page.fill('#ram_gb', ram);
      await page.click('#submit-btn');
      const text = await page.locator('#result-slot').innerText();
      assert.match(text, /Check your Mac chip before choosing a package/);
      assert.match(text, /About This Mac/);
      assert.doesNotMatch(text, /Score:|Fit check ID:|Probably not a fit|Looks like a fit/);
      assert.equal(await page.locator('#result-slot a[href*="confirmed-fit-payment"]').count(), 0);
      assert.match(await page.locator('#result-slot a').getAttribute('href'), /^mailto:/);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'chip-help-heading');
      assert.equal(posts.length, 0);
    }
    assert.equal(await page.inputValue('#primary_goal'), 'Synthetic fixture only');
    assert.equal(await page.locator('#submit-btn').isEnabled(), true);
    for (const [choice, expected] of [['yes', true], ['no', false]]) {
      await page.check(`input[name=apple_silicon][value=${choice}]`);
      await page.click('#submit-btn');
      await page.locator('#result-slot a[href*="confirmed-fit-payment"]').waitFor();
      assert.equal(posts.at(-1).answers.apple_silicon, expected);
      await page.check('input[name=apple_silicon][value=unsure]');
      await page.click('#submit-btn');
      assert.equal(await page.locator('#result-slot a[href*="confirmed-fit-payment"]').count(), 0,
        'new unknown result replaces any earlier payment result');
    }
    assert.equal(posts.length, 2);
    await page.check('input[name=device_kind][value=windows]');
    assert.equal(await page.locator('#apple-silicon-field').isHidden(), true);
    await page.click('#submit-btn');
    await page.locator('#result-slot a[href*="confirmed-fit-payment"]').waitFor();
    assert.equal(posts.length, 3);
    assert.equal(posts.at(-1).answers.device_kind, 'windows');
    assert.equal(posts.at(-1).answers.apple_silicon, false);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(JSON.stringify({ width, unknownChipPosts: 0, knownDeviceFixturePosts: posts.length,
      preservedAnswers: true, focusedHelp: true, stalePaymentReplaced: true, pageErrors: 0, horizontalOverflow: false }));
    await context.close();
  }
} finally { await browser.close(); }
