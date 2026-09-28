#!/bin/sh
# One-off diagnostic script for verifying that the 2026-09-28 502 incident
# fixes (issue #364 / PR #365's proxy-layer self-heal, PR #366's deploy
# write-permission fix) are actually holding on production, and for
# idempotently backfilling the external cron hit against
# /__ops/pm2-ensure-running that docs/agents/502-origin-recovery-runbook.md's
# "預防建議" section recommends as a second line of defense. See issue #367.
#
# Run over SSH via .github/workflows/diagnose-502-recovery.yml; not part of
# the deploy pipeline. Almost entirely read-only: the ONLY step that writes
# anything is section 8 below, and it only touches crontab when a
# pm2-ensure-running entry is not already present (checked, and re-checked
# immediately before writing, via grep).
#
# Deliberately `set -u` (catch variable-name typos) but NOT `set -e`: each
# diagnostic section below is independent, and one section being unavailable
# (e.g. no .pm2-watchdog.log yet) must not prevent the rest of the report
# from printing. Every risky command is guarded with `|| echo ...` so a
# failure is reported inline and the script moves on to the next section.
set -u

NODE_VERSION="v24.19.0"
NVM_NODE_DIR="$HOME/.nvm/versions/node/$NODE_VERSION"
APP_DIR="$HOME/bid_app"
NODE_BIN="$NVM_NODE_DIR/bin/node"
PM2_BIN="$NVM_NODE_DIR/lib/node_modules/pm2/bin/pm2"

cd "$APP_DIR" 2>&1 || echo "WARNING: could not cd into $APP_DIR, continuing with absolute paths"

echo "Host date (local): $(date 2>&1)"
echo "Host date (UTC):   $(date -u 2>&1)"
echo "Host UTC offset:   $(date +%z 2>&1)"

echo ""
echo "==================== 1. PM2 process status ===================="
JLIST_RAW="$("$NODE_BIN" "$PM2_BIN" jlist 2>&1)" || JLIST_RAW=""
printf '%s' "$JLIST_RAW" | "$NODE_BIN" -e '
  let data = "";
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => {
    try {
      const procs = JSON.parse(data);
      const bidWeb = procs.filter((p) => p.name === "bid-web");
      if (bidWeb.length === 0) {
        console.log("No process named bid-web found in pm2 jlist output.");
      }
      for (const p of bidWeb) {
        console.log(JSON.stringify({
          name: p.name,
          pid: p.pid,
          restart_time: p.pm2_env.restart_time,
          unstable_restarts: p.pm2_env.unstable_restarts,
          status: p.pm2_env.status,
          created_at: new Date(p.pm2_env.created_at).toISOString(),
          pm_uptime: new Date(p.pm2_env.pm_uptime).toISOString(),
        }, null, 2));
      }
    } catch (e) {
      console.log("failed to parse pm2 jlist:", e.message);
      console.log(data.slice(0, 2000));
    }
  });
' 2>&1 || echo "pm2 jlist parsing failed"

BID_WEB_STATUS="$(printf '%s' "$JLIST_RAW" | "$NODE_BIN" -e '
  let data = "";
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => {
    try {
      const procs = JSON.parse(data);
      const p = procs.find((x) => x.name === "bid-web");
      console.log(p ? p.pm2_env.status : "not-found");
    } catch (e) {
      console.log("unknown");
    }
  });
' 2>/dev/null)"
[ -z "$BID_WEB_STATUS" ] && BID_WEB_STATUS="unknown"

echo ""
echo "==================== 2. .apply.log (full contents) ===================="
if [ -f "$APP_DIR/.apply.log" ]; then
  cat "$APP_DIR/.apply.log" 2>&1 || echo "failed to read .apply.log"
else
  echo "no .apply.log found"
fi

echo ""
echo "==================== 3. .pm2-watchdog.log (full contents) ===================="
if [ -f "$APP_DIR/.pm2-watchdog.log" ]; then
  cat "$APP_DIR/.pm2-watchdog.log" 2>&1 || echo "failed to read .pm2-watchdog.log"
else
  echo "no .pm2-watchdog.log found"
fi

echo ""
echo "==================== 4. .fast_restart.lock / .apply.lock status ===================="
if [ -f "$APP_DIR/.fast_restart.lock" ]; then
  echo ".fast_restart.lock exists, mtime: $(date -r "$APP_DIR/.fast_restart.lock" 2>&1 || echo "(date -r failed)")"
else
  echo ".fast_restart.lock not present"
fi
if [ -f "$APP_DIR/.apply.lock" ]; then
  echo ".apply.lock exists, mtime: $(date -r "$APP_DIR/.apply.lock" 2>&1 || echo "(date -r failed)")"
else
  echo ".apply.lock not present"
fi

echo ""
echo "==================== 5. PM2 error/out log tails (last 200 lines each) ===================="
ERROR_LOG="$HOME/.pm2/logs/bid-web-error.log"
if [ -f "$ERROR_LOG" ]; then
  echo "---- $ERROR_LOG ----"
  tail -n 200 "$ERROR_LOG" 2>&1 || echo "failed to tail $ERROR_LOG"
else
  echo "no error log at $ERROR_LOG"
fi
OUT_LOG="$HOME/.pm2/logs/bid-web-out.log"
if [ -f "$OUT_LOG" ]; then
  echo "---- $OUT_LOG ----"
  tail -n 200 "$OUT_LOG" 2>&1 || echo "failed to tail $OUT_LOG"
else
  echo "no out log at $OUT_LOG"
fi

echo ""
echo "==================== 6. Local direct health probe (bypasses Cloudflare) ===================="
echo "---- GET http://127.0.0.1:3001/api/health ----"
curl -sD - --max-time 10 "http://127.0.0.1:3001/api/health" 2>&1 || echo "curl to /api/health failed"
echo ""
echo "---- GET http://127.0.0.1:3001/ (headers only; body discarded to keep this log readable) ----"
curl -sD - --max-time 10 -o /tmp/diag-502-homepage.html "http://127.0.0.1:3001/" 2>&1 || echo "curl to / failed"
if [ -f /tmp/diag-502-homepage.html ]; then
  echo "response body size: $(wc -c < /tmp/diag-502-homepage.html 2>&1) bytes"
  rm -f /tmp/diag-502-homepage.html
fi

echo ""
echo "==================== 7. Memory and process resources ===================="
free -m 2>&1 || echo "free command not available or failed"
echo ""
ps aux 2>&1 | grep -i node | grep -v grep || echo "no node processes found via ps aux | grep -i node (or ps/grep failed)"

echo ""
echo "==================== 8. crontab check for pm2-ensure-running (idempotent ensure) ===================="
CURRENT_CRONTAB="$(crontab -l 2>/dev/null)"
if [ -z "$CURRENT_CRONTAB" ]; then
  CURRENT_CRONTAB=""
fi

CRON_STATUS="unknown"

if printf '%s\n' "$CURRENT_CRONTAB" | grep -F 'pm2-ensure-running' >/dev/null 2>&1; then
  echo "Existing pm2-ensure-running cron entry found (key masked):"
  printf '%s\n' "$CURRENT_CRONTAB" | grep -F 'pm2-ensure-running' | sed -E 's/(key=)[^&"[:space:]]*/\1***REDACTED***/g'
  echo "already configured, no changes made"
  CRON_STATUS="pre-existing"
else
  echo "No existing pm2-ensure-running cron entry found. Attempting to add one."

  # .ops-key is uploaded by deploy-ftps.yml straight to the docroot
  # (`${DOCROOT_DIR}/.ops-key`, i.e. public_html for xiangshuicn.cc — see
  # .remote-index.php's own comment on how it derives $homeDir/docroot
  # layout per site), not into bid_app/. We still check bid_app first in
  # case a copy was ever placed there, then fall back to the known docroots,
  # then a last-resort check directly under $HOME. No path here is invented
  # or guessed beyond "where deploy-ftps.yml / .remote-index.php already
  # look" — if none of these exist, we skip rather than fabricate a key.
  OPS_KEY_FILE=""
  if [ -f "$APP_DIR/.ops-key" ]; then
    OPS_KEY_FILE="$APP_DIR/.ops-key"
  elif [ -f "$HOME/public_html/.ops-key" ]; then
    OPS_KEY_FILE="$HOME/public_html/.ops-key"
  elif [ -f "$HOME/bid.j172.tw/.ops-key" ]; then
    OPS_KEY_FILE="$HOME/bid.j172.tw/.ops-key"
  elif [ -f "$HOME/.ops-key" ]; then
    OPS_KEY_FILE="$HOME/.ops-key"
  fi

  if [ -z "$OPS_KEY_FILE" ]; then
    echo "ERROR: could not locate an .ops-key file at any of: $APP_DIR/.ops-key, $HOME/public_html/.ops-key, $HOME/bid.j172.tw/.ops-key, $HOME/.ops-key"
    echo "Skipping cron setup — refusing to guess or hardcode a key value."
    CRON_STATUS="skipped-no-key"
  else
    echo "Found ops key file at: $OPS_KEY_FILE (value itself will not be printed or logged)"
    OPS_KEY_VALUE="$(cat "$OPS_KEY_FILE" 2>/dev/null | tr -d '\r\n')"
    OPS_KEY_VALUE="$(printf '%s' "$OPS_KEY_VALUE" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

    if [ -z "$OPS_KEY_VALUE" ]; then
      echo "ERROR: ops key file at $OPS_KEY_FILE was found but is empty. Skipping cron setup."
      CRON_STATUS="skipped-empty-key"
    else
      # Re-check immediately before writing, in case the first check above
      # raced against something else modifying crontab, or missed a
      # differently-formatted existing entry.
      if printf '%s\n' "$(crontab -l 2>/dev/null)" | grep -F 'pm2-ensure-running' >/dev/null 2>&1; then
        echo "pm2-ensure-running entry appeared between the first check and now — not adding a duplicate."
        CRON_STATUS="pre-existing-race"
      else
        CRON_LINE="*/2 * * * * curl -fsS --max-time 10 \"https://xiangshuicn.cc/__ops/pm2-ensure-running?key=${OPS_KEY_VALUE}\" >/dev/null 2>&1"
        if (crontab -l 2>/dev/null; printf '%s\n' "$CRON_LINE") | crontab - 2>&1; then
          echo "cron entry added"
          echo "Added (key masked): */2 * * * * curl -fsS --max-time 10 \"https://xiangshuicn.cc/__ops/pm2-ensure-running?key=***REDACTED***\" >/dev/null 2>&1"
          CRON_STATUS="added"
        else
          echo "ERROR: failed to write new crontab"
          CRON_STATUS="failed"
        fi
      fi
      unset OPS_KEY_VALUE
    fi
  fi
fi

echo ""
echo "==================== 9. SUMMARY ===================="
echo "bid-web pm2 status: $BID_WEB_STATUS"
echo ""
echo "Alert window to check against (today, 2026-09-28): 04:24-06:46 UTC == 12:24-14:46 Asia/Taipei."
echo "This host's current UTC offset is shown above (\"Host UTC offset\") — use it to convert any"
echo "local timestamps in .apply.log/.pm2-watchdog.log (sections 2/3 above) to UTC and confirm"
echo "whether they land inside that window."
echo ""
echo "Lines in .pm2-watchdog.log mentioning today's date (2026-09-28):"
if [ -f "$APP_DIR/.pm2-watchdog.log" ]; then
  grep '2026-09-28' "$APP_DIR/.pm2-watchdog.log" 2>&1 || echo "  (none found for today's date — either no watchdog trigger today, or the file uses a different date format than expected)"
else
  echo "  (.pm2-watchdog.log does not exist at all — the watchdog code path in .remote-index.php's /__ops/pm2-ensure-running has apparently never written to it)"
fi
echo ""
echo "Lines in .apply.log mentioning 'Sep 28' (date(1)'s default format for today):"
if [ -f "$APP_DIR/.apply.log" ]; then
  grep 'Sep 28' "$APP_DIR/.apply.log" 2>&1 || echo "  (none found — either no apply ran today, or the log uses a different date format)"
else
  echo "  (.apply.log does not exist)"
fi
echo ""
echo "crontab pm2-ensure-running entry: $CRON_STATUS"
echo "  (pre-existing = already configured before this run; added = this run added it just now;"
echo "   pre-existing-race = appeared between two checks in this run; skipped-* = could not add it,"
echo "   see section 8 above for why; unknown = unexpected — check section 8's output)"
echo ""
echo "Read together with sections 1-8 above: bid-web should show status=online in section 1, and any"
echo "restarts/apply runs visible in sections 2/3 during the alert window are the self-heal (issue"
echo "#364 / PR #365) and deploy permission fix (PR #366) actually doing their job, rather than a"
echo "sign of an unresolved problem."
