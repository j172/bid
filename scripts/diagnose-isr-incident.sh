#!/bin/sh
# One-off diagnostic script for the 2026-09-23/24 ISR incident (issue: homepage
# and 5 other pages served an empty build-time placeholder for 45+ minutes
# after PR #353 converted them from force-dynamic to `revalidate`-based ISR).
# Run over SSH; not part of the deploy pipeline. Read-only — makes no changes
# to the running app, PM2, or any deployed files.
set -u

NODE_VERSION="v24.19.0"
NVM_NODE_DIR="$HOME/.nvm/versions/node/$NODE_VERSION"
APP_DIR="$HOME/bid_app"
NODE_BIN="$NVM_NODE_DIR/bin/node"
PM2_BIN="$NVM_NODE_DIR/lib/node_modules/pm2/bin/pm2"

cd "$APP_DIR" || exit 1

echo "==================== 1. PM2 process status ===================="
"$NODE_BIN" "$PM2_BIN" jlist 2>&1 | "$NODE_BIN" -e '
  let data = "";
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => {
    try {
      const procs = JSON.parse(data);
      for (const p of procs) {
        console.log(JSON.stringify({
          name: p.name,
          pid: p.pid,
          restarts: p.pm2_env.restart_time,
          unstable_restarts: p.pm2_env.unstable_restarts,
          status: p.pm2_env.status,
          created_at: new Date(p.pm2_env.created_at).toISOString(),
          pm_uptime: new Date(p.pm2_env.pm_uptime).toISOString(),
          exec_mode: p.pm2_env.exec_mode,
        }, null, 2));
      }
    } catch (e) {
      console.log("failed to parse pm2 jlist:", e.message);
      console.log(data.slice(0, 2000));
    }
  });
'

echo ""
echo "==================== 2. .apply.log (most recent deploys) ===================="
if [ -f "$APP_DIR/.apply.log" ]; then
  cat "$APP_DIR/.apply.log"
else
  echo "no .apply.log found"
fi

echo ""
echo "==================== 3. .next_previous BUILD_ID (the broken #353 build, preserved by the revert deploy's swap) ===================="
if [ -d "$APP_DIR/.next_previous" ]; then
  cat "$APP_DIR/.next_previous/BUILD_ID" 2>&1
  echo ""
  echo "---- .next_previous directory mtime ----"
  date -r "$APP_DIR/.next_previous" 2>&1
else
  echo "no .next_previous directory found"
fi

echo ""
echo "==================== 4. Prerendered output files for the broken pages under .next_previous, with mtimes ===================="
if [ -d "$APP_DIR/.next_previous/server/app" ]; then
  find "$APP_DIR/.next_previous/server/app/[locale]" -maxdepth 3 \( -iname "*with-loading*" -o -iname "*news*" -o -iname "*pigeon-groups*" -o -iname "*pigeon-shops*" -o -iname "*pigeon-showcase*" -o -iname "*products*" \) -exec ls -la --time-style=full-iso {} \; 2>&1 | head -100
else
  echo "no .next_previous/server/app directory found"
fi

echo ""
echo "==================== 5. Current .next BUILD_ID and dir mtime (the reverted, working build) ===================="
cat "$APP_DIR/.next/BUILD_ID" 2>&1
echo ""
date -r "$APP_DIR/.next" 2>&1

echo ""
echo "==================== 6. Runtime env seen by the app (NEXT_* only) ===================="
"$NODE_BIN" "$PM2_BIN" env 0 2>&1 | grep -i "NEXT" || echo "(no NEXT_* vars, or pm2 env unsupported)"

echo ""
echo "==================== 7. Next.js version installed on server ===================="
grep '"version"' "$APP_DIR/node_modules/next/package.json" 2>&1 | head -1

echo ""
echo "==================== 8. PM2 error log — last 400 lines ===================="
ERROR_LOG="$HOME/.pm2/logs/bid-web-error.log"
if [ -f "$ERROR_LOG" ]; then
  tail -n 400 "$ERROR_LOG" 2>&1
else
  echo "no error log at $ERROR_LOG"
  ls -la "$HOME/.pm2/logs/" 2>&1
fi

echo ""
echo "==================== 9. PM2 out log — last 200 lines ===================="
OUT_LOG="$HOME/.pm2/logs/bid-web-out.log"
if [ -f "$OUT_LOG" ]; then
  tail -n 200 "$OUT_LOG" 2>&1
else
  echo "no out log at $OUT_LOG"
fi

echo ""
echo "==================== 10. Direct localhost probe (bypasses Cloudflare/LiteSpeed proxy) ===================="
curl -sD - --max-time 10 "http://127.0.0.1:3001/" -o /tmp/diag-homepage.html 2>&1
echo "---- main tag length ----"
grep -o '<main[^>]*>.*</main>' /tmp/diag-homepage.html 2>/dev/null | wc -c || echo "(grep failed or no main tag)"
rm -f /tmp/diag-homepage.html
