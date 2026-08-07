#!/bin/sh
# Post-deploy verification, run over SSH from inside the host instead of as
# plain curl calls from the GitHub Actions runner (see .github/workflows/
# deploy-ftps.yml's "Verify live site" step and issue #64/#67's follow-up).
#
# Checking bid.j172.tw's public HTTP(S) surface from a GitHub Actions runner
# doesn't work reliably: the production WAF/anti-bot layer in front of this
# host challenges requests from GitHub Actions' IP ranges regardless of
# whether the request targets the public domain (through Cloudflare) or the
# origin IP directly with a spoofed Host header — both get the same "Please
# wait while your request is being verified..." JS challenge page instead of
# real content. Confirmed empirically: identical curl commands succeed
# instantly from outside GitHub Actions (a developer's machine) and fail
# consistently (5 attempts over 20s) when run from the runner. This isn't a
# warm-up timing issue (that was ruled out by scripts/remote-apply.sh's own
# health probe already passing before this ever runs) — it's IP-reputation
# based, so no amount of retrying from the runner itself would ever fix it.
#
# Running these same checks from inside the host sidesteps the problem:
# loopback traffic never touches the WAF at all, and the bid-web watchdog
# cron (crontab -l on this host) has been hitting the public bid.j172.tw
# domain from here every 5 minutes without issue, so the host's own outbound
# IP isn't flagged the way GitHub Actions' is.

set -u

ORIGIN_HEALTH_OK=0
for ATTEMPT in 1 2 3; do
  if curl --fail --show-error --silent --max-time 10 \
    "http://127.0.0.1:3001/api/health?verify=$(date +%s)" | grep -q '"ok":true'; then
    ORIGIN_HEALTH_OK=1
    break
  fi
  echo "Loopback health check not ready yet (attempt $ATTEMPT/3), retrying..."
  sleep 3
done
if [ "$ORIGIN_HEALTH_OK" != "1" ]; then
  echo "Loopback health endpoint (127.0.0.1:3001) never reported ok=true"
  exit 1
fi
echo "Loopback health OK"

PUBLIC_HEALTH="$(curl --show-error --silent --location --max-time 20 \
  --write-out '\nHTTP:%{http_code}' \
  "https://bid.j172.tw/api/health?verify=$(date +%s)")"
echo "$PUBLIC_HEALTH"
if ! printf '%s' "$PUBLIC_HEALTH" | grep -q 'HTTP:200'; then
  echo "Public health endpoint (bid.j172.tw, through Cloudflare) did not return HTTP 200"
  exit 1
fi
if ! printf '%s' "$PUBLIC_HEALTH" | grep -q '"ok":true'; then
  echo "Public health endpoint did not report ok=true"
  exit 1
fi
echo "Public health OK"

PUBLIC_HOME="$(curl --show-error --silent --location --max-time 20 \
  --write-out '\nHTTP:%{http_code}' \
  "https://bid.j172.tw/?verify=$(date +%s)")"
HOMEPAGE_STATUS="$(printf '%s' "$PUBLIC_HOME" | grep -o 'HTTP:[0-9]*' | tail -1)"
if [ "$HOMEPAGE_STATUS" != "HTTP:200" ]; then
  echo "Public homepage returned $HOMEPAGE_STATUS"
  exit 1
fi
if printf '%s' "$PUBLIC_HOME" | grep -Eiq 'SSL handshake failed|Error code 525|Please wait while your request is being verified'; then
  echo "Public homepage returned a Cloudflare error/challenge page"
  exit 1
fi
echo "Public homepage OK"
