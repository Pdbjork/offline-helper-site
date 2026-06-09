// Offline Helper payments Worker
// Creates Stripe Checkout Sessions, handles webhooks, and stores a
// redacted fulfillment queue in Cloudflare KV.
//
// Secrets (set with `wrangler secret put`):
//   STRIPE_SECRET_KEY       restricted Stripe key (Checkout Sessions: write + read)
//   STRIPE_WEBHOOK_SECRET   signing secret from the Stripe webhook endpoint
//
// KV namespace (create with `wrangler kv namespace create OFFLINE_HELPER_QUEUE`):
//   bound as QUEUE in wrangler.toml
//
// Live-mode flag is STRIPE_LIVE_APPROVED set in wrangler.toml [vars].
// Test mode = "0", live mode = "1". Refuses to run if mismatch with key prefix.

const CATALOG = {
  starter_setup: {
    name: "Offline Helper Starter Setup",
    price: "price_1TgEQ35r5QARoiZNRyN1UW6E",
    mode: "payment",
    amount_cents: 14900,
  },
  family_setup: {
    name: "Offline Helper Family Setup",
    price: "price_1TgEQ35r5QARoiZN2y4KTwxI",
    mode: "payment",
    amount_cents: 24900,
  },
  family_support: {
    name: "Offline Helper Family Support",
    price: "price_1TgEQ45r5QARoiZN9lhxRNtT",
    mode: "subscription",
    amount_cents: 2900,
  },
};

const SUCCESS_URL = "https://offlinehelpers.com/payment-success/?session_id={CHECKOUT_SESSION_ID}";
const CANCEL_URL = "https://offlinehelpers.com/payment-canceled/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://offlinehelpers.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function flattenForStripe(payload, prefix = "") {
  const items = [];
  for (const [key, value] of Object.entries(payload)) {
    const composite = prefix ? `${prefix}[${key}]` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      items.push(...flattenForStripe(value, composite));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        items.push(...flattenForStripe({ [i]: item }, composite));
      });
    } else {
      items.push([composite, value === null || value === undefined ? "" : String(value)]);
    }
  }
  return items;
}

async function callStripe(method, path, key, payload) {
  const headers = {
    Authorization: `Bearer ${key}`,
    "Stripe-Version": "2024-06-20",
    "User-Agent": "offline-helper-worker/1.0",
  };
  let body;
  if (payload !== undefined) {
    body = new URLSearchParams(flattenForStripe(payload)).toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  const res = await fetch(`https://api.stripe.com${path}`, { method, headers, body });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function verifyStripeSignature(request, secret) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) return { ok: false, error: "missing stripe-signature header" };
  const body = await request.text();
  const params = new URLSearchParams(sig);
  const t = params.get("t");
  const v1 = params.get("v1");
  if (!t || !v1) return { ok: false, error: "missing t or v1 in signature" };
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedPayload = `${t}.${body}`;
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected !== v1) return { ok: false, error: "signature mismatch" };
  try { return { ok: true, event: JSON.parse(body) }; }
  catch { return { ok: false, error: "invalid JSON body" }; }
}

function keyMatchesLiveFlag(key, liveApproved) {
  const isLive = key.startsWith("rk_live_") || key.startsWith("sk_live_");
  if (liveApproved === "1" && !isLive) {
    return "STRIPE_LIVE_APPROVED=1 but STRIPE_SECRET_KEY looks like a test key";
  }
  if (liveApproved !== "1" && isLive) {
    return "STRIPE_SECRET_KEY looks live but STRIPE_LIVE_APPROVED is not set to 1";
  }
  return null;
}

async function handleCheckout(request, env) {
  const contentType = request.headers.get("Content-Type") || "";
  let body;
  if (contentType.includes("application/json")) {
    try { body = await request.json(); }
    catch { return jsonResponse({ error: "invalid JSON body" }, 400); }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    body = Object.fromEntries(form.entries());
  } else {
    return jsonResponse({ error: "unsupported Content-Type; use application/json or application/x-www-form-urlencoded" }, 415);
  }

  const pkg = body && body.package;
  const product = CATALOG[pkg];
  if (!product) return jsonResponse({ error: `unknown package ${pkg}` }, 400);

  const mismatch = keyMatchesLiveFlag(env.STRIPE_SECRET_KEY || "", env.STRIPE_LIVE_APPROVED || "0");
  if (mismatch) return jsonResponse({ error: mismatch }, 412);

  const metadata = { package: pkg };
  if (body.fit_check_id) metadata.fit_check_id = String(body.fit_check_id).slice(0, 80);
  if (body.setup_window) metadata.setup_window = String(body.setup_window).slice(0, 80);

  const sessionPayload = {
    mode: product.mode,
    line_items: [{ price: product.price, quantity: 1 }],
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    metadata,
  };
  if (body.customer_email) sessionPayload.customer_email = body.customer_email;

  const session = await callStripe("POST", "/v1/checkout/sessions", env.STRIPE_SECRET_KEY, sessionPayload);

  // Browser form submission: redirect (303) so the user lands on Stripe.
  // API/JSON callers: return the URL in the body.
  const wantsHtml = contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data") ||
    (request.headers.get("Accept") || "").includes("text/html");
  if (wantsHtml && session.url) {
    return Response.redirect(session.url, 303);
  }
  return jsonResponse({ url: session.url, session_id: session.id });
}

async function handleWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ error: "webhook secret not configured" }, 500);
  }
  const verified = await verifyStripeSignature(request, env.STRIPE_WEBHOOK_SECRET);
  if (!verified.ok) return jsonResponse({ error: verified.error }, 400);
  const event = verified.event;

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data && event.data.object;
    if (session && env.QUEUE) {
      const record = {
        event_id: event.id,
        event_type: event.type,
        received_at: new Date().toISOString(),
        stripe_session_id: session.id,
        package: (session.metadata && session.metadata.package) || "",
        fit_check_id: (session.metadata && session.metadata.fit_check_id) || "",
        setup_window: (session.metadata && session.metadata.setup_window) || "",
        amount_total: session.amount_total,
        currency: session.currency,
        mode: session.mode,
        customer_email: session.customer_email || "",
        payment_status: session.payment_status,
      };
      await env.QUEUE.put(`session:${session.id}`, JSON.stringify(record));
    }
  }
  return jsonResponse({ received: true });
}

async function handleQueue(env) {
  if (!env.QUEUE) return jsonResponse({ items: [] });
  const list = await env.QUEUE.list({ prefix: "session:" });
  const items = [];
  for (const key of list.keys) {
    const value = await env.QUEUE.get(key.name);
    if (value) { try { items.push(JSON.parse(value)); } catch { /* skip */ } }
  }
  return jsonResponse({ items });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/checkout" && request.method === "POST") {
        return await handleCheckout(request, env);
      }
      if (url.pathname === "/api/webhook" && request.method === "POST") {
        return await handleWebhook(request, env);
      }
      if (url.pathname === "/api/queue" && request.method === "GET") {
        return await handleQueue(env);
      }
      if (url.pathname === "/api/health") {
        return jsonResponse({
          ok: true,
          live_approved: env.STRIPE_LIVE_APPROVED === "1",
          catalog: Object.keys(CATALOG),
        });
      }
      return jsonResponse({ error: "not found" }, 404);
    } catch (err) {
      return jsonResponse({ error: String(err && err.message || err) }, 500);
    }
  },
};
