import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../support-intake/index.html', import.meta.url), 'utf8');

test('Care Plan CTA prepares a request before opening a channel', () => {
  const card = html.match(/<article class="card">[\s\S]*?<\/article>/)?.[0];
  assert.match(card, /href="#prepare-request">Prepare my support request<\/a>/);
  assert.doesNotMatch(card, /href="https:\/\/t\.me/);
  assert.match(html, /<section class="starter" id="prepare-request" tabindex="-1" aria-labelledby="starter-note-title">/);
  assert.equal((html.match(/id="prepare-request"/g) || []).length, 1);
});

test('manual sending, email fallback and safety boundaries remain clear', () => {
  assert.match(html, /Nothing on this page sends a request or books a slot\./);
  assert.match(html, /tap Start before sending your note/);
  assert.match(html, /href="https:\/\/t\.me\/OfflineHelperPeteBot"[^>]*>Open Telegram<\/a>/);
  assert.match(html, /href="mailto:pdbjork@gmail.com\?subject=Offline%20Helper%20support%20request"/);
  assert.match(html, /I understand I should not send passwords, recovery keys, private documents/);
  assert.match(html, /Stripe payment opens only after fit, timing, and scope are confirmed\./);
});
