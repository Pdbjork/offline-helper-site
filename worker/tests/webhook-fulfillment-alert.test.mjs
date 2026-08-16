import assert from 'node:assert/strict';
import worker from '../src/index.js';

function makeQueue() {
  const store = new Map();
  return {
    store,
    async put(key, value) { store.set(key, value); },
    async get(key) { return store.get(key) || null; },
    async list({ prefix = '' } = {}) {
      return { keys: [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })) };
    },
  };
}

async function hmacHex(secret, text) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signedWebhookRequest(event, secret) {
  const body = JSON.stringify(event);
  const t = '1800000000';
  const v1 = await hmacHex(secret, `${t}.${body}`);
  return new Request('https://offline-helper-payments.offline-helper-payments.workers.dev/api/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${t}&v1=${v1}` },
    body,
  });
}

function checkoutCompletedEvent(overrides = {}) {
  return {
    id: 'evt_test_paid_rescue',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_paid_rescue_12345',
        metadata: {
          package: 'paid_rescue',
          fit_check_id: 'fc_abcd1234',
          setup_window: 'Tuesday afternoon CT',
        },
        amount_total: 9900,
        currency: 'usd',
        mode: 'payment',
        customer_email: 'customer@example.test',
        payment_status: 'paid',
        ...overrides,
      },
    },
  };
}

async function testStoresFulfillmentTaskAndTelegramAlert() {
  const secret = 'whsec_test_secret';
  const queue = makeQueue();
  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }), { status: 200 });
  };
  try {
    const response = await worker.fetch(await signedWebhookRequest(checkoutCompletedEvent(), secret), {
      STRIPE_WEBHOOK_SECRET: secret,
      TELEGRAM_BOT_TOKEN: '123456:redacted-test-token',
      TELEGRAM_CHAT_ID: '987654321',
      QUEUE: queue,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true });

    const stored = JSON.parse(await queue.get('session:cs_test_paid_rescue_12345'));
    assert.equal(stored.task_type, 'checkout_fulfillment');
    assert.equal(stored.status, 'needs_human_scheduling');
    assert.equal(stored.package, 'paid_rescue');
    assert.equal(stored.customer_email, 'customer@example.test');
    assert.deepEqual(stored.fulfillment_alert, { ok: true });
    assert.ok(stored.fulfillment_alert_checked_at);

    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].url.startsWith('https://api.telegram.org/bot'));
    const payload = JSON.parse(fetchCalls[0].init.body);
    assert.equal(payload.chat_id, '987654321');
    assert.match(payload.text, /Offline Helper paid checkout completed/);
    assert.match(payload.text, /Package: paid_rescue/);
    assert.match(payload.text, /Amount: USD 99\.00/);
    assert.match(payload.text, /Fit check attached: yes/);
    assert.doesNotMatch(payload.text, /customer@example\.test/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testWebhookStillSucceedsWhenAlertSecretsMissing() {
  const secret = 'whsec_test_secret';
  const queue = makeQueue();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; throw new Error('should not call fetch'); };
  try {
    const response = await worker.fetch(await signedWebhookRequest(checkoutCompletedEvent({ id: 'cs_test_no_alert' }), secret), {
      STRIPE_WEBHOOK_SECRET: secret,
      QUEUE: queue,
    });
    assert.equal(response.status, 200);
    const stored = JSON.parse(await queue.get('session:cs_test_no_alert'));
    assert.equal(stored.fulfillment_alert.skipped, true);
    assert.match(stored.fulfillment_alert.reason, /not configured/);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testBadSignatureRejectedWithoutQueueWrite() {
  const queue = makeQueue();
  const response = await worker.fetch(new Request('https://offline-helper-payments.offline-helper-payments.workers.dev/api/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1800000000&v1=bad' },
    body: JSON.stringify(checkoutCompletedEvent()),
  }), {
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    QUEUE: queue,
  });
  assert.equal(response.status, 400);
  assert.equal(queue.store.size, 0);
}

await testStoresFulfillmentTaskAndTelegramAlert();
await testWebhookStillSucceedsWhenAlertSecretsMissing();
await testBadSignatureRejectedWithoutQueueWrite();
console.log('PASS webhook fulfillment alert tests');
