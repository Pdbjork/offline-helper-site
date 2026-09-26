import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../chat-with-pete/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

async function submit({ device = 'mac', silicon = 'yes', ram = 16, response = null, throws = false } = {}) {
  const values = { device_kind: device, apple_silicon: silicon, ram_gb: ram,
    os_version: 'test OS', primary_goal: 'test goal', comfort_level: 'some' };
  const nodes = Object.fromEntries(['submit-btn', 'error-slot', 'result-slot', 'apple-silicon-field'].map(id =>
    [id, { innerHTML: '', scrollIntoView() {} }]));
  let handler;
  const form = {
    querySelectorAll: () => [],
    querySelector: () => ({ value: silicon }),
    addEventListener: (name, fn) => { if (name === 'submit') handler = fn; },
  };
  const requests = [];
  vm.runInNewContext(script, {
    document: { getElementById: id => id === 'fit-form' ? form : nodes[id], referrer: '' },
    window: { location: { search: '' } }, URLSearchParams, AbortController, setTimeout, clearTimeout,
    FormData: class { get(name) { return values[name] ?? ''; } },
    crypto: { randomUUID: () => 'test1234-fixture' },
    fetch: async (url, opts) => {
      requests.push(JSON.parse(opts.body));
      if (throws) throw new Error('simulated offline');
      return { ok: response !== null, json: async () => response };
    },
  });
  await handler({ preventDefault() {} });
  assert.equal(nodes['submit-btn'].disabled, false);
  assert.equal(requests.length, 1);
  return nodes['result-slot'].innerHTML;
}

for (const [device, silicon, ram, score] of [
  ['mac', 'yes', 16, 95], ['mac', 'yes', 8, 80], ['mac', 'yes', 4, 50],
  ['mac', 'no', 16, 55], ['mac', 'no', 8, 25],
  ['windows', 'no', 16, 85], ['windows', 'no', 8, 70], ['windows', 'no', 4, 35],
]) {
  test(`local preview: ${device}/${silicon}/${ram} scores ${score} without payment`, async () => {
    const result = await submit({ device, silicon, ram });
    assert.match(result, new RegExp(`Score: ${score}/100`));
    assert.match(result, /could not confirm that your fit check was saved/i);
    assert.doesNotMatch(result, /confirmed-fit-payment|Continue to payment/);
    assert.match(result, /mailto:/);
  });
}

test('network failure offers retry and human help, not unconfirmed checkout', async () => {
  const result = await submit({ throws: true });
  assert.match(result, /try again/i);
  assert.doesNotMatch(result, /confirmed-fit-payment/);
});

test('successful persisted fit still offers the existing payment route', async () => {
  const result = await submit({ response: { ok: true, fit_check_id: 'fc_saved', score: 95,
    eligible: true, tier: 'home_setup', reason: 'Test response' } });
  assert.match(result, /confirmed-fit-payment\/\?tier=home_setup&fit_check_id=fc_saved/);
  assert.doesNotMatch(result, /could not confirm/);
});

test('malformed success payload cannot authorize payment', async () => {
  const result = await submit({ response: { score: 95, eligible: true, tier: 'home_setup' } });
  assert.doesNotMatch(result, /confirmed-fit-payment/);
  assert.match(result, /could not confirm/);
});
