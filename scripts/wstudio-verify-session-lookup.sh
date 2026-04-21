#!/usr/bin/env bash
# Smoke-test the deployed session-lookup function (no plugin required).
#
# Usage:
#   bash scripts/wstudio-verify-session-lookup.sh "<SUPABASE_ACCESS_TOKEN>" AB12CD
#
# Optional: export SUPABASE_ANON_KEY from the dashboard if requests fail without it.
#
# Token must be a valid JWT for a user who is the booking's artist OR the studio engineer.
# SESSION_CODE is the 6-character studio_bookings.session_code (case-insensitive).

set -euo pipefail

TOKEN="${1:-}"
CODE="${2:-}"
PROJECT_URL="${SUPABASE_FUNCTIONS_URL:-https://cdcdlqbjyptamtleitdp.supabase.co}"

if [[ -z "$TOKEN" || -z "$CODE" ]]; then
  echo "Usage: $0 \"<SUPABASE_ACCESS_TOKEN>\" <SESSION_CODE>"
  exit 1
fi

CODE_UPPER=$(printf %s "$CODE" | tr '[:lower:]' '[:upper:]')
URL="${PROJECT_URL}/functions/v1/session-lookup?code=${CODE_UPPER}"

echo "GET ${URL}"
echo ""

ARGS=(-sS -o /tmp/wstudio-sl-body.json -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}")
if [[ -n "${SUPABASE_ANON_KEY:-}" ]]; then
  ARGS+=(-H "apikey: ${SUPABASE_ANON_KEY}")
fi
ARGS+=("$URL")

HTTP_CODE=$(curl "${ARGS[@]}")

echo "HTTP status: ${HTTP_CODE}"
if command -v jq >/dev/null 2>&1; then
  jq . /tmp/wstudio-sl-body.json
else
  cat /tmp/wstudio-sl-body.json
fi
echo ""

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "OK: Response should include \"session\" and \"participants\" arrays."
else
  echo "If 401: token expired or invalid — sign in again and copy a fresh access_token."
  echo "If 403: this user is not the artist or engineer on that booking."
  echo "If 404: no studio_bookings row with that session_code."
  exit 1
fi
