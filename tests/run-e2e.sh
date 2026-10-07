#!/usr/bin/env bash
# Browser E2E: fresh data folder, mock AI on 4791, LMS on 4698, Chromium via Playwright.
# Usage: tests/run-e2e.sh <screenshot_dir>   (needs: npm run build, python3 + playwright, ffmpeg, reportlab)
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; SHOTS="${1:-/tmp/shots}"; mkdir -p "$SHOTS"
W="$(mktemp -d)"; for f in server shared src public index.html vite.config.ts tsconfig.json package.json node_modules dist; do ln -s "$ROOT/$f" "$W/$f"; done
node "$ROOT/tests/mock-ai.mjs" > /tmp/mock.log 2>&1 & MOCK=$!
( cd "$W" && PORT=4698 NODE_ENV=production SEED_INSTRUCTOR_PASSWORD='VJ%NTj+R%zgvTp3wmc' SEED_LEARNER_PASSWORD='7rcV%5qXmNTFttj_Dw' \
  ANTHROPIC_API_KEY=x ANTHROPIC_BASE_URL=http://127.0.0.1:4791 exec node "$ROOT/node_modules/tsx/dist/cli.mjs" server/index.ts > /tmp/e2e-server.log 2>&1 ) & SRV=$!
for i in $(seq 240); do curl -sf 127.0.0.1:4698/api/health >/dev/null && break; sleep 0.5; done
timeout 230 python3 -u "$ROOT/tests/e2e_browser.py" http://127.0.0.1:4698 "$SHOTS"
kill $SRV $MOCK 2>/dev/null; pkill -f "[s]erver/index" 2>/dev/null; rm -rf "$W"
