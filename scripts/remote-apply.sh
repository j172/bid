#!/bin/sh
# Applies the prebuilt bundle already uploaded via FTPS (see
# .github/workflows/deploy-ftps.yml) and restarts bid-web under pm2.
#
# This is a line-for-line port of the shell script built by
# $buildApplyCommand in .remote-index.php (the /__ops/apply and
# /__ops/pm2-ensure-running HTTP endpoints). That PHP-triggered path has to
# background itself with `nohup ... &` because PHP-FPM needs to return the
# HTTP response immediately, then poll a log file for completion over
# subsequent requests.
#
# Run over SSH (see deploy-ftps.yml's "Trigger apply and wait for
# completion" step), this script can just run in the foreground and let the
# SSH session itself block until it's done, so no backgrounding/polling is
# needed here. If the deploy logic in .remote-index.php's
# $buildApplyCommand ever changes, mirror the change here too — the two are
# intentionally kept in lockstep so the CI-triggered path and the
# cron-triggered watchdog path behave identically.
#
# Exit code: 0 only if the apply log ends with [DONE]; 1 otherwise (rollback
# performed and [FAIL] logged, or the script errored before writing a log at
# all).

set -u

APP_DIR="/home/tw123457/bid_app"
APP_PORT=3001
NODE_BIN="/home/tw123457/.nvm/versions/node/v24.19.0/bin/node"
# bin/npm's shebang (`#!/usr/bin/env node`) resolves to whatever `node` is
# first on PATH in a non-interactive shell, which may not be the nvm-managed
# version this app needs (see the matching comment in .remote-index.php).
# Invoking npm-cli.js directly via $NODE_BIN sidesteps that.
NPM_CLI_JS="/home/tw123457/.nvm/versions/node/v24.19.0/lib/node_modules/npm/bin/npm-cli.js"
PM2_BIN="/home/tw123457/.nvm/versions/node/v24.19.0/lib/node_modules/pm2/bin/pm2"

cd "$APP_DIR" || exit 1

LOG_FILE="$APP_DIR/.apply.log"
LOCK_FILE="$APP_DIR/.apply.lock"

# Same 30-minute staleness window as the PHP /__ops/apply path, so a lock
# left behind by a crashed previous run doesn't wedge every future deploy
# (CI-triggered or watchdog-triggered) forever.
if [ -f "$LOCK_FILE" ]; then
  LOCK_MTIME="$(date -r "$LOCK_FILE" +%s 2>/dev/null || echo 0)"
  LOCK_AGE=$(($(date +%s) - LOCK_MTIME))
  if [ "$LOCK_AGE" -gt 1800 ]; then
    rm -f "$LOCK_FILE"
  fi
fi

if [ -f "$LOCK_FILE" ]; then
  echo "Apply already running (lock file present); refusing to start a second one." >&2
  if [ -f "$LOG_FILE" ]; then
    echo "---- current .apply.log ----" >&2
    cat "$LOG_FILE" >&2
  fi
  exit 1
fi

date +%s > "$LOCK_FILE"

{
  echo "[START] $(date)" > "$LOG_FILE"
  rm -rf .next_stage >>"$LOG_FILE" 2>&1 \
    && mkdir -p .next_stage >>"$LOG_FILE" 2>&1 \
    && tar --no-same-owner --no-same-permissions -xzf .prebuilt-next.tgz -C .next_stage >>"$LOG_FILE" 2>&1 \
    && test -s .next_stage/.next/BUILD_ID \
    && test -d .next_stage/.next/server \
    && { if [ -s .prebuilt-public.tgz ]; then tar --no-same-owner --no-same-permissions -xzf .prebuilt-public.tgz -C public >>"$LOG_FILE" 2>&1 && rm -f .prebuilt-public.tgz; fi; } \
    && rm -rf .next_previous >>"$LOG_FILE" 2>&1 \
    && { if [ -d .next ]; then mv .next .next_previous; fi; } \
    && mv .next_stage/.next .next >>"$LOG_FILE" 2>&1 \
    && rmdir .next_stage >>"$LOG_FILE" 2>&1 \
    && echo "[BUILD_ID] $(cat .next/BUILD_ID)" >>"$LOG_FILE" \
    && echo "[NPM_INSTALL] start $(date)" >>"$LOG_FILE" \
    && { "$NODE_BIN" "$NPM_CLI_JS" install --omit=dev --ignore-scripts --no-audit --no-fund --no-engine-strict --prefer-offline >>"$LOG_FILE" 2>&1; NPM_INSTALL_EXIT=$?; echo "[NPM_INSTALL] exit=$NPM_INSTALL_EXIT" >>"$LOG_FILE"; test "$NPM_INSTALL_EXIT" -eq 0; } \
    && echo "[NPM_INSTALL] done $(date)" >>"$LOG_FILE" \
    && ("$NODE_BIN" "$PM2_BIN" delete bid-web >>"$LOG_FILE" 2>&1 || true) \
    && setsid "$NODE_BIN" "$PM2_BIN" start ecosystem.config.cjs --only bid-web >>"$LOG_FILE" 2>&1 \
    && { PROBE_OK=0; for ATTEMPT in $(seq 1 30); do if curl -fsS --max-time 5 "http://127.0.0.1:${APP_PORT}/" >/dev/null 2>&1; then PROBE_OK=1; break; fi; sleep 1; done; test "$PROBE_OK" = 1; } \
    && echo "[DONE] $(date)" >>"$LOG_FILE"
} || {
  echo "[ROLLBACK] apply or health probe failed" >>"$LOG_FILE"
  if [ -d .next_previous ]; then
    rm -rf .next_failed
    mv .next .next_failed 2>/dev/null
    mv .next_previous .next
    "$NODE_BIN" "$PM2_BIN" restart bid-web >>"$LOG_FILE" 2>&1 || true
  fi
  echo "[FAIL] $(date)" >>"$LOG_FILE"
}

rm -f "$LOCK_FILE"

echo "---- .apply.log ----"
cat "$LOG_FILE"

if grep -Fq '[DONE]' "$LOG_FILE"; then
  exit 0
fi

exit 1
