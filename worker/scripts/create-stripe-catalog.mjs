#!/usr/bin/env node
/**
 * Create Offline Helper products + prices in Stripe (live or test).
 *
 * Usage:
 *   export STRIPE_SECRET_KEY=rk_live_...   # or sk_live_ / rk_test_
 *   node worker/scripts/create-stripe-catalog.mjs
 *
 * Prints Product IDs and Price IDs. Paste Price IDs into worker/src/index.js
 * CATALOG (optional — checkout already works via price_data without IDs).
 *
 * Does not print the secret key. Does not archive old pilot products.
 */

const KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
if (!KEY) {
  console.error("Set STRIPE_SECRET_KEY (restricted key with Products + Prices write).");
  process.exit(1);
}

const PRODUCTS = [
  { key: "home_setup", name: "Offline Helper Home Setup", amount: 49700, mode: "payment",
    description: "Done-for-you local-first AI setup on one Mac or Windows PC." },
  { key: "family_care_setup", name: "Offline Helper Family Care Setup", amount: 99700, mode: "payment",
    description: "Home Setup plus caregiver orientation and follow-up." },
  { key: "org_setup", name: "Offline Helper Micro-Org Setup", amount: 150000, mode: "payment",
    description: "1–3 seats for a small office or partner site." },
  { key: "care_plan", name: "Offline Helper Care Plan", amount: 7900, mode: "subscription",
    description: "Monthly updates, health check, skill of the month, support call." },
  { key: "hw_edge", name: "Edge Privacy Kit", amount: 34900, mode: "payment",
    description: "Network + device hygiene; soft offline on existing hardware." },
  { key: "hw_home", name: "Home AI Node", amount: 149900, mode: "payment",
    description: "Curated mini PC + LAN; mostly offline; ~7B–14B open models." },
  { key: "hw_lab", name: "Open Model Lab", amount: 399700, mode: "payment",
    description: "GPU stack; deep offline; ~32B–70B quantized open models." },
];

async function stripe(path, body) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2026-04-22.dahlia",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

const out = {};
for (const p of PRODUCTS) {
  const product = await stripe("/v1/products", {
    name: p.name,
    description: p.description,
    "metadata[sku]": p.key,
  });
  const priceBody = {
    product: product.id,
    currency: "usd",
    unit_amount: String(p.amount),
    "metadata[sku]": p.key,
  };
  if (p.mode === "subscription") {
    priceBody["recurring[interval]"] = "month";
  }
  const price = await stripe("/v1/prices", priceBody);
  out[p.key] = { product: product.id, price: price.id, amount_cents: p.amount, mode: p.mode };
  console.log(`${p.key}\t${price.id}\t${product.id}`);
}

console.log("\n// Paste into CATALOG as price: \"price_…\" when ready\n");
console.log(JSON.stringify(out, null, 2));
