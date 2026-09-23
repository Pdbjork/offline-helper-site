import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../confirmed-fit-payment/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function harness({ disabled = false, catalog = null } = {}) {
  const button = { disabled, textContent: disabled ? 'Unavailable' : 'Pay $99 — Paid Rescue Session' };
  const events = {};
  const windowEvents = {};
  const form = {
    addEventListener: (name, fn) => { events[name] = fn; },
    querySelectorAll: () => [button],
  };
  const primary = { style: {} };
  const status = { textContent: '' };
  const window = {
    location: { search: '' },
    addEventListener: (name, fn) => { windowEvents[name] = fn; },
    fetch: catalog ? true : undefined,
  };
  let resolveCatalog;
  const response = new Promise(resolve => { resolveCatalog = resolve; });
  const document = {
    getElementById: id => {
      if (id === 'primary-cta') return primary;
      if (id === 'paid-rescue-package') return catalog ? form : null;
      if (id === 'paid-rescue-status') return status;
      return {};
    },
    querySelectorAll: () => [form],
  };
  vm.runInNewContext(script, { window, document, URLSearchParams, fetch: () => response });
  return {
    button,
    submit: () => events.submit(),
    back: () => windowEvents.pageshow?.({ persisted: true }),
    catalogMissing: async () => {
      resolveCatalog({ json: async () => ({ catalog: [] }) });
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

test('Back restores the payment label and enabled state after submission', () => {
  const h = harness();
  h.submit();
  assert.equal(h.button.disabled, true);
  assert.equal(h.button.textContent, 'Opening Stripe…');
  h.back();
  assert.equal(h.button.disabled, false);
  assert.equal(h.button.textContent, 'Pay $99 — Paid Rescue Session');
});

test('repeated submit events do not overwrite the original label', () => {
  const h = harness();
  h.submit();
  h.submit();
  h.back();
  h.back();
  assert.equal(h.button.disabled, false);
  assert.equal(h.button.textContent, 'Pay $99 — Paid Rescue Session');
});

test('Back leaves a button disabled by an existing safety gate', () => {
  const h = harness({ disabled: true });
  h.back();
  assert.equal(h.button.disabled, true);
  assert.equal(h.button.textContent, 'Unavailable');
});

test('a late catalog failure takes priority over pending submission recovery', async () => {
  const h = harness({ catalog: true });
  h.submit();
  await h.catalogMissing();
  h.back();
  assert.equal(h.button.disabled, true);
  assert.equal(h.button.textContent, 'Pending Stripe catalog deploy');
});
