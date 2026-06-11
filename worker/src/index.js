// Offline Helper payments Worker
// Creates Stripe Checkout Sessions, handles webhooks, and stores a
// redacted fulfillment queue in Cloudflare KV.
// Also serves the AI fit-check chat (gpt-4o-mini) that qualifies
// buyers before they reach the checkout.

import {
  SYSTEM_PROMPT as FIT_CHECK_SYSTEM_PROMPT,
  MAX_TURNS as FIT_CHECK_MAX_TURNS,
  scoreDevice as scoreFitCheck,
  callOpenAI as callOpenAIChat,
  isReadyToScore as fitcheckIsReady,
  stripReadyToScore as fitcheckStripReady,
  initialAssistantMessage as fitcheckGreeting,
} from "./fit-check.js";
// Secrets (set with `wrangler secret put`):
//   STRIPE_SECRET_KEY       restricted Stripe key (Checkout Sessions: write + read)
//   STRIPE_WEBHOOK_SECRET   signing secret from the Stripe webhook endpoint
//   OPENAI_API_KEY          OpenAI API key for the fit-check chat (gpt-4o-mini)
//
// KV namespace (create with `wrangler kv namespace create OFFLINE_HELPER_QUEUE`):
//   bound as QUEUE in wrangler.toml
//
// Live-mode flag is STRIPE_LIVE_APPROVED set in wrangler.toml [vars].
// Test mode = "0", live mode = "1". Refuses to run if mismatch with key prefix.

// CATALOG keeps each product's Stripe Price ID and mode. Prices below are
// LIVE-mode IDs (created in the Stripe Dashboard in 2026-06). Updating a price
// here requires creating a new live price in Dashboard and pasting the ID —
// Stripe IDs are immutable, you cannot edit an existing one.
const CATALOG = {
  starter_setup: {
    name: "Offline Helper Starter Setup",
    price: "price_1TgDrJ5r5QARoiZNrIxxs5wx", // $149 one-time, live
    mode: "payment",
    amount_cents: 14900,
  },
  family_setup: {
    name: "Offline Helper Family Setup",
    price: "price_1TgDrN5r5QARoiZN1XpEhnDO", // $249 one-time, live
    mode: "payment",
    amount_cents: 24900,
  },
  family_support: {
    name: "Offline Helper Family Support",
    price: "price_1TgDrJ5r5QARoiZNFzGaLIm6", // $29 / month, live
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
    "Stripe-Version": "2026-04-22.dahlia",
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

// Returns null on OK, or a string describing the mismatch.
//
// Strictness model:
//   live_approved=1 + test key    -> REJECT  (impossible combo, configuration bug)
//   live_approved=0 + live key    -> WARN (allow)  useful for testing live catalog
//                                                            in dev, with a console.warn
//   live_approved=1 + live key    -> OK (production)
//   live_approved=0 + test key    -> OK (legitimate test mode)
function keyMatchesLiveFlag(key, liveApproved) {
  const isLive = key.startsWith("rk_live_") || key.startsWith("sk_live_");
  if (liveApproved === "1" && !isLive) {
    return "STRIPE_LIVE_APPROVED=1 but STRIPE_SECRET_KEY looks like a test key";
  }
  if (liveApproved !== "1" && isLive) {
    // Not a rejection - just a loud warning. Lets us test against the live
    // catalog (real price IDs) without flipping the production flag.
    console.warn("[stripe] live key with STRIPE_LIVE_APPROVED=0 - proceeding for testing");
    return null;
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

  // Do NOT pass automatic_payment_methods or payment_method_types to
  // Checkout Sessions - Stripe picks eligible methods dynamically from
  // Dashboard settings for Checkout. (automatic_payment_methods is for
  // PaymentIntents / SetupIntents only; hardcoding payment_method_types
  // is the deprecated path.)
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
    // Build a 303 manually (not Response.redirect) so CORS headers are
    // attached. The browser will follow the Location to Stripe; the
    // ACAO header is needed for fetch() callers reading the redirect.
    return new Response(null, { status: 303, headers: { ...corsHeaders, Location: session.url } });
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

// --- AI fit-check chat --------------------------------------------------
//
// POST /api/fit-check/chat    body: { messages: [{role, content}, ...] }
//                              returns: { reply, ready, turn_count }
//
// POST /api/fit-check/complete body: { fit_check_id, transcript, answers }
//                              returns: { ok, score, eligible, tier, reason, checkout_url }
//
// GET  /api/fit-check/summary?id=fc_...
//                              returns: { fit_check_id, score, eligible, tier, reason, answers, created }

async function handleFitCheckChat(request, env) {
  if (!env.OPENAI_API_KEY) {
    return jsonResponse({
      error: "AI chat temporarily unavailable. Please use the static fit check form at https://offlinehelpers.com/chat-with-pete/ - it produces the same fit_check_id and routes through the same checkout.",
      fallback_url: "https://offlinehelpers.com/chat-with-pete/",
    }, 503);
  }
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "invalid JSON body" }, 400); }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  // Hard cap: server-side enforcement, not just UI. Refuse if too long.
  if (incoming.length > FIT_CHECK_MAX_TURNS * 2) {
    return jsonResponse({
      error: `Conversation is at the ${FIT_CHECK_MAX_TURNS}-turn limit. Please book the free fit check at offlinehelpers.com/fit-check/ to continue.`,
      at_limit: true,
    }, 400);
  }

  // Build the messages array with our system prompt at the head.
  const messages = [
    { role: "system", content: FIT_CHECK_SYSTEM_PROMPT },
    ...incoming,
  ];

  let data;
  try {
    data = await callOpenAIChat(messages, env.OPENAI_API_KEY);
  } catch (err) {
    // Translate OpenAI auth/quota failures into the same friendly fallback
    // the static form uses, so the page can route buyers correctly.
    const msg = err && err.message ? err.message : "";
    if (/429|quota|401|api[_-]?key|insufficient/i.test(msg)) {
      return jsonResponse({
        error: "AI chat temporarily unavailable. Please use the static fit check form at https://offlinehelpers.com/chat-with-pete/ - it produces the same fit_check_id and routes through the same checkout.",
        fallback_url: "https://offlinehelpers.com/chat-with-pete/",
      }, 503);
    }
    return jsonResponse({ error: `OpenAI error: ${msg}` }, 502);
  }

  const reply = data?.choices?.[0]?.message?.content || "";
  const ready = fitcheckIsReady(reply);
  const cleanReply = ready ? fitcheckStripReady(reply) : reply;

  return jsonResponse({
    reply: cleanReply,
    ready,
    turn_count: incoming.filter(m => m.role === "user").length + 1,
  });
}

async function handleFitCheckComplete(request, env) {
  if (!env.QUEUE) return jsonResponse({ error: "KV not bound" }, 500);
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "invalid JSON body" }, 400); }

  const fit_check_id = body.fit_check_id || `fc_${crypto.randomUUID().slice(0, 8)}`;
  const answers = body.answers || {};
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];

  // Attribution data is collected by the static form (UTMs from the URL +
  // an optional "how did you hear" dropdown) and by future Telegram-bot
  // payloads. Everything is optional and length-bounded on the way in.
  const rawAttribution = (body.attribution && typeof body.attribution === "object")
    ? body.attribution : {};
  function clipStr(v, max) {
    return typeof v === "string" ? v.trim().slice(0, max) : "";
  }
  const attribution = {
    how_did_you_hear: clipStr(rawAttribution.how_did_you_hear, 32),
    utm_source: clipStr(rawAttribution.utm_source, 64),
    utm_medium: clipStr(rawAttribution.utm_medium, 64),
    utm_campaign: clipStr(rawAttribution.utm_campaign, 96),
    utm_content: clipStr(rawAttribution.utm_content, 96),
    referrer: clipStr(rawAttribution.referrer, 256),
    landing_path: clipStr(rawAttribution.landing_path, 256),
    captured_at: new Date().toISOString(),
  };
  // Drop the timestamp if every meaningful field is empty so the record
  // doesn't carry a misleading "attribution captured at" with no data.
  const hasAttribution = !!(attribution.how_did_you_hear
    || attribution.utm_source || attribution.utm_medium
    || attribution.utm_campaign || attribution.utm_content
    || attribution.referrer || attribution.landing_path);

  const result = scoreFitCheck(answers);

  const record = {
    fit_check_id,
    type: "fit_check",
    created_at: new Date().toISOString(),
    answers,
    score: result.score,
    eligible: result.eligible,
    tier: result.tier || null,
    reason: result.reason,
    transcript_length: transcript.length,
  };
  if (hasAttribution) record.attribution = attribution;
  await env.QUEUE.put(`fitcheck:${fit_check_id}`, JSON.stringify(record));

  // Build a checkout URL with metadata that the Stripe webhook will
  // round-trip into the fulfillment record.
  const checkoutUrl = result.eligible && result.tier
    ? `https://offlinehelpers.com/confirmed-fit-payment/?tier=${encodeURIComponent(result.tier)}&fit_check_id=${encodeURIComponent(fit_check_id)}`
    : null;

  return jsonResponse({
    ok: true,
    fit_check_id,
    score: result.score,
    eligible: result.eligible,
    tier: result.tier || null,
    reason: result.reason,
    checkout_url: checkoutUrl,
  });
}

async function handleFitCheckSummary(request, env) {
  if (!env.QUEUE) return jsonResponse({ error: "KV not bound" }, 500);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonResponse({ error: "missing id" }, 400);
  if (!/^fc_[a-zA-Z0-9_-]{1,32}$/.test(id)) return jsonResponse({ error: "invalid id format" }, 400);

  const value = await env.QUEUE.get(`fitcheck:${id}`);
  if (!value) return jsonResponse({ error: "not found" }, 404);
  try { return jsonResponse(JSON.parse(value)); }
  catch { return jsonResponse({ error: "corrupt record" }, 500); }
}

export function fitCheckGreetingPublic() {
  return fitcheckGreeting();
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
      if (url.pathname === "/api/fit-check/chat" && request.method === "POST") {
        return await handleFitCheckChat(request, env);
      }
      if (url.pathname === "/api/fit-check/complete" && request.method === "POST") {
        return await handleFitCheckComplete(request, env);
      }
      if (url.pathname === "/api/fit-check/summary" && request.method === "GET") {
        return await handleFitCheckSummary(request, env);
      }
      if (url.pathname === "/api/fit-check/greeting" && request.method === "GET") {
        return jsonResponse({ greeting: fitCheckGreetingPublic() });
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
