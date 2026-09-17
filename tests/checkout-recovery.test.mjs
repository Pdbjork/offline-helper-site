import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pages = ['payment-canceled/index.html', 'payment-canceled.html'];
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

for (const path of pages) {
  test(`${path}: recovery offers a guarded route and human help`, () => {
    const html = read(path);
    assert.match(html, /href="\/checkout\/">Review checkout options<\/a>/);
    assert.match(html, /href="mailto:pdbjork@gmail.com\?subject=Offline%20Helper%20checkout%20question">Ask Pete about checkout<\/a>/);
    assert.match(html, /Pay only after Pete confirms fit, timing, and price\./);
    assert.match(html, /check with Pete before trying again/);
    assert.match(html, /passwords, recovery keys, private documents, or financial details/);
    assert.doesNotMatch(html, /You have not completed payment|<form|<script|api\/checkout|buy\.stripe\.com/);
    assert.match(html, /a:focus-visible/);
    assert.match(html, /<title>Checkout next steps \| Offline Helper<\/title>/);
  });
}

test('legacy and canonical cancellation pages stay identical', () => {
  assert.equal(read(pages[0]), read(pages[1]));
});

test('checkout router retains fit and confirmation choices', () => {
  const html = read('checkout/index.html');
  for (const route of ['/fit-check/', '/paid-rescue/', '/confirmed-fit-payment/']) {
    assert.ok(html.includes(`href="${route}"`));
  }
});
