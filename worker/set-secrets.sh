#!/usr/bin/env bash
# Push Worker secrets to Cloudflare.
#
# Reads two values from prompt (hidden) and pushes them as
# `wrangler secret put` for the offline-helper-payments Worker:
#   1. STRIPE_SECRET_KEY       (rk_test_… for test mode, rk_live_… for live)
#   2. STRIPE_WEBHOOK_SECRET   (whsec_…)
#
# The values are typed at prompts and never echoed to the terminal.
# They live in Cloudflare's encrypted secret store, NOT in any file.
#
# Requires CLOUDFLARE_API_TOKEN in env (or run via deploy.sh first to
# load it from ~/.cloudflare_token).

set -euo pipefail

# Load token if not present
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if [ -f "$HOME/.cloudflare_token" ]; then
    export CLOUDFLARE_API_TOKEN="$(cat "$HOME/.cloudflare_token")"
  else
    echo "✘ No CLOUDFLARE_API_TOKEN. Run deploy.sh first to set it up."
    exit 1
  fi
fi

cd "$(dirname "$0")"

echo "── pushing STRIPE_SECRET_KEY ──"
read -rs -p "Paste your restricted Stripe key (rk_test_… or rk_live_…): " RAK
echo ""
if [ -z "$RAK" ]; then
  echo "✘ Empty key, aborting."
  exit 1
fi
printf '%s' "$RAK" | npx wrangler secret put STRIPE_SECRET_KEY
unset RAK
echo "  ✓ STRIPE_SECRET_KEY set"

echo ""
echo "── pushing STRIPE_WEBHOOK_SECRET ──"
read -rs -p "Paste your webhook signing secret (whsec_…): " WH
echo ""
if [ -z "$WH" ]; then
  echo "✘ Empty secret, aborting."
  exit 1
fi
printf '%s' "$WH" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
unset WH
echo "  ✓ STRIPE_WEBHOOK_SECRET set"

echo ""
echo "✓ All secrets pushed. Verify with: npx wrangler secret list"
