#!/usr/bin/env bash
# Step 1: Apply migrations + deploy session-lookup to the linked Supabase project.
# Prereqs: https://supabase.com/docs/guides/cli
#   brew install supabase/tap/supabase   # macOS
#   supabase login
#   cd repo root && supabase link --project-ref cdcdlqbjyptamtleitdp

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Install the Supabase CLI first, e.g.: brew install supabase/tap/supabase"
  exit 1
fi

echo "=== 1a. Push database migrations (live_sessions, etc.) ==="
supabase db push

echo ""
echo "=== 1b. Deploy Edge Function: session-lookup (JWT verified per config.toml) ==="
supabase functions deploy session-lookup

echo ""
echo "=== Done. How to test ==="
echo "1) Run:  bash scripts/wstudio-verify-session-lookup.sh \"<YOUR_ACCESS_TOKEN>\" <SESSION_CODE>"
echo "2) Or join a session in the web app, then use the plugin SYNC with the same code + token."
echo "   Get token: DevTools → Application → Local Storage → supabase auth token (access_token),"
echo "   or add a temporary 'copy token' in the app."
