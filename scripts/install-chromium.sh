#!/usr/bin/env bash
# Installs Playwright's Chromium for the CI browser jobs, touching apt only when the runner lacks a library it needs.
#
# `playwright install --with-deps` always runs apt-get against the runner's Ubuntu mirror, so one mirror or DNS
# outage failed every browser job of a run (azure.archive.ubuntu.com unresolvable, 2026-11-11; #505, #507).
# The ubuntu-24.04 runner image already carries Chromium's libraries, so the browser download is normally all
# that's needed. The check below is the same `ldd` test Playwright runs before it launches a browser: if any
# shared library is missing, the system dependencies are installed as before.
#
# Usage (workflows): bash scripts/install-chromium.sh
set -euo pipefail

npx playwright install chromium

browsers="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
# The browsers and the libraries shipped beside them (SwiftShader, ANGLE), which Playwright's check covers too.
mapfile -t bins < <(find "$browsers" -type f \( -name chrome -o -name chrome-headless-shell -o -name '*.so' \))
if ! printf '%s\n' "${bins[@]}" | grep -qE '/(chrome|chrome-headless-shell)$'; then
  echo "install-chromium: no Chromium binary under $browsers after the install" >&2
  exit 1
fi

missing="$(for b in "${bins[@]}"; do ldd "$b" 2>/dev/null || true; done | grep 'not found' | sort -u || true)"
if [ -n "$missing" ]; then
  echo "install-chromium: missing libraries, installing system dependencies:"
  echo "$missing"
  npx playwright install-deps chromium
else
  echo "install-chromium: every shared library of ${#bins[@]} browser files present; apt not needed"
fi
