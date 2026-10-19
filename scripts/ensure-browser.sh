#!/usr/bin/env bash
# Prints a path to a headless-capable Chromium for e2e/smoke.mjs.
#
# GitHub Actions: Playwright's own browser is installed by the workflow, so this
# script isn't needed there.
# Claude cloud sessions: the Playwright CDN is blocked by the network allowlist,
# but the npm registry is not, so we pull @sparticuz/chromium (a Chromium build
# shipped inside an npm package) into a cache dir outside the repo.
#
# Usage:  export SC_CHROME="$(scripts/ensure-browser.sh)"
set -euo pipefail

# 1. Playwright-managed browser already present?
if ls "${HOME}/.cache/ms-playwright"/chromium*/chrome-linux*/chrome >/dev/null 2>&1; then
  ls "${HOME}/.cache/ms-playwright"/chromium*/chrome-linux*/chrome | head -1
  exit 0
fi

# 2. Try the normal Playwright install (works on unrestricted networks).
if npx --yes playwright install chromium >/dev/null 2>&1; then
  ls "${HOME}/.cache/ms-playwright"/chromium*/chrome-linux*/chrome | head -1
  exit 0
fi

# 3. Fallback: Chromium from the npm registry.
CACHE="${SC_BROWSER_CACHE:-${HOME}/.cache/sc-chromium}"
mkdir -p "$CACHE"
if [ ! -d "$CACHE/node_modules/@sparticuz/chromium" ]; then
  (cd "$CACHE" && [ -f package.json ] || npm init -y >/dev/null; cd "$CACHE" && npm i @sparticuz/chromium --no-audit --no-fund >/dev/null 2>&1)
fi
(cd "$CACHE" && node -e "import('@sparticuz/chromium').then(async m => console.log(await m.default.executablePath()))")
