import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../checkout/index.html', import.meta.url), 'utf8');

test('checkout questions have email and Telegram intake paths', () => {
  assert.match(html, /aria-labelledby="checkout-help"/);
  assert.match(html, /id="checkout-help"/);
  assert.match(html, /href="mailto:pdbjork@gmail.com\?subject=Offline%20Helper%20checkout%20question">Ask Pete about checkout/);
  assert.match(html, /href="https:\/\/t.me\/OfflineHelperPeteBot">Start a Telegram intake/);
  assert.match(html, /reply there so Pete has the context/);
  assert.match(html, /a:focus-visible/);
});

test('help preserves fit gates and warns against uncertain repeat payments', () => {
  for (const route of ['/fit-check/', '/paid-rescue/', '/confirmed-fit-payment/']) {
    assert.ok(html.includes(`href="${route}"`));
  }
  assert.match(html, /check with Pete before trying again/);
  assert.match(html, /This page does not verify payment status/);
  assert.match(html, /not private documents or payment details/);
  assert.doesNotMatch(html, /<form|<script|buy\.stripe\.com/);
});
