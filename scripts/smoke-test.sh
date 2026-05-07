#!/usr/bin/env bash
#
# Smoke test for AICreative — pings all public + auth-gated routes
# and verifies expected status codes. No browser, no Playwright. Run
# against local dev (default) or prod by setting BASE_URL.
#
# Usage:
#   ./scripts/smoke-test.sh                  # tests http://localhost:3001
#   BASE_URL=https://aicreative.kz ./scripts/smoke-test.sh
#
# Expectations (no auth cookie):
#   /                  → 200  (landing)
#   /sites             → 200  (marketing)
#   /presentations     → 200  (marketing)
#   /products          → 200  (marketing)
#   /editor            → 307  (Clerk redirect — auth required)
#   /sites/new         → 307  (Clerk redirect)
#   /presentations/new → 307
#   /products/new      → 307
#   /admin             → 307
#   /curator           → 307
#   /api/generate-site → 401  (no auth)
#   /api/generate-presentation → 401
#   /api/generate-products → 401
#   /api/refine-html   → 401
#   /api/publish-site  → 401
#   /api/publish-presentation → 401
#   /s/notexist        → 404  (public, slug not found)
#   /p/notexist        → 404
#
# Exits 0 if all checks pass, 1 if any fail.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
FAIL=0

check() {
  local path="$1"
  local expected="$2"
  local method="${3:-GET}"
  local got
  got=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$path")
  if [ "$got" = "$expected" ]; then
    printf "  \033[32m✓\033[0m %-32s %s %s\n" "$path" "$method" "$got"
  else
    printf "  \033[31m✗\033[0m %-32s %s %s (expected %s)\n" "$path" "$method" "$got" "$expected"
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke test → $BASE_URL"
echo

echo "Public marketing:"
check /                    200
check /sites               200
check /presentations       200
check /products            200
echo

echo "Auth-gated pages (redirect to Clerk):"
check /editor              307
check /sites/new           307
check /presentations/new   307
check /products/new        307
check /published           307
check /admin               307
check /curator             307
echo

echo "API endpoints (401 without auth):"
check /api/generate                401 POST
check /api/generate-site           401 POST
check /api/generate-presentation   401 POST
check /api/generate-products       401 POST
check /api/refine-html             401 POST
check /api/publish-site            401 POST
check /api/publish-presentation    401 POST
echo

echo "Public published-page routes (404 for missing slug):"
check /s/notexist          404
check /p/notexist          404
echo

if [ "$FAIL" -eq 0 ]; then
  echo "All checks passed."
  exit 0
else
  echo "$FAIL check(s) failed."
  exit 1
fi
