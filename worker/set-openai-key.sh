#!/usr/bin/env bash
# Push the OPENAI_API_KEY Worker secret.
set -euo pipefail

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  TOKEN_FILE="$HOME/.cloudflare_token"
  if [ ! -f "$TOKEN_FILE" ]; then
    echo "✘ No CLOUDFLARE_API_TOKEN set, and $TOKEN_FILE not found."
    echo "  Create it with:"
    echo "    read -rs CLOUDFLARE_API_TOKEN"
    echo "    echo \"\$CLOUDFLARE_API_TOKEN\" > \$TOKEN_FILE"
    echo "    chmod 600 \$TOKEN_FILE"
    exit 1
  fi
  # Read token from file using bash < redirection, no command substitution
  read -r CLOUDFLARE_API_TOKEN < "$TOKEN_FILE"
  export CLOUDFLARE_API_TOKEN
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
