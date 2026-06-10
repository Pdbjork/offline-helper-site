#!/usr/bin/env bash
# Offline Helper Worker deploy helper.
#
# What it does:
#   1. Reads CLOUDFLARE_API_TOKEN from ~/.cloudflare_token (or $CLOUDFLARE_API_TOKEN)
#   2. Sets it in the current shell so wrangler can use it
#   3. Runs `npx wrangler deploy` and prints the resulting URL
#
# Usage (from the worker/ directory):
#   ./deploy.sh            # deploy with --dry-run first to confirm config
#   ./deploy.sh --live     # actually push (dry-run by default to be safe)
#
# The token is read from ~/.cloudflare_token on first run. Create it with:
#   read -rs CLOUDFLARE_API_TOKEN
#   echo "$CLOUDFLARE_API_TOKEN" > ~/.cloudflare_token
#   chmod 600 ~/.cloudflare_token
#   unset CLOUDFLARE_API_TOKEN

set -euo pipefail

TOKEN_FILE="$HOME/.cloudflare_token"

# 1) load token
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if [ -f "$TOKEN_FILE" ]; then
    export CLOUDFLARE_API_TOKEN="$(cat "$TOKEN_FILE")"
  else
    echo "✘ No CLOUDFLARE_API_TOKEN set, and $TOKEN_FILE not found."
    echo "  Create it with:"
    echo "    read -rs CLOUDFLARE_API_TOKEN"
    echo "    echo \"\$CLOUDFLARE_API_TOKEN\" > $TOKEN_FILE"
    echo "    chmod 600 $TOKEN_FILE"
    exit 1
  fi
fi

# 2) sanity: show account, never show the token
echo "✓ CLOUDFLARE_API_TOKEN loaded (length: ${#CLOUDFLARE_API_TOKEN})"
npx wrangler whoami 2>&1 | grep -E "Account Name|Account ID" || true

# 3) decide dry-run vs deploy
ARGS=("$@")
DRY_RUN=true
for a in "${ARGS[@]}"; do
  if [ "$a" = "--live" ]; then
    DRY_RUN=false
  fi
done

cd "$(dirname "$0")"

if $DRY_RUN; then
  echo ""
  echo "── dry-run (use --live to actually push) ──"
  npx wrangler deploy --dry-run --outdir=/tmp/wrangler-dryrun
  echo ""
  echo "Config valid. Re-run with --live to deploy."
else
  echo ""
  echo "── deploying ──"
  npx wrangler deploy
fi
