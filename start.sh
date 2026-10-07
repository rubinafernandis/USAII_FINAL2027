#!/usr/bin/env bash
# macOS / Linux launcher
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js 20+ from https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install --no-audit --no-fund
OPEN_BROWSER=1 npm run dev
