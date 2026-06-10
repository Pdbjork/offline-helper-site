#!/usr/bin/env bash
# Push the OPENAI_API_KEY Worker secret.
#
# Reads a hidden value and pushes it as a wrangler secret for the
# offline-helper-payments Worker. The value is typed at the prompt
# and never echoed to the terminal; it goes directly to Cloudflare's
# encrypted secret store.

set -euo pipefail

# Load token if not present
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if [ -f "$HOME/.cloudflare_token" ]; then
    export CLOUDFLARE_API_TOKEN=*** "$HOME/.cloudflare_token")"
  else
    echo "✘ No CLOUDFLARE_API_TOKEN. Run deploy.sh first to set it up."
    exit 1
  fi
fi

cd "$(dirname "$0")"

echo "── pushing OPENAI_API_KEY ──"
read -rs -p "Paste your OpenAI API key (sk-…): " KEY
echo ""
if [ -z "$KEY" ]; then
  echo "✘ Empty key, aborting."
  exit 1
fi
printf '%s' "$KEY" | npx wrangler secret put OPENAI_API_KEY
unset KEY
echo "  ✓ OPENAI_API_KEY set"
echo ""
echo "Verify with: npx wrangler secret list"
