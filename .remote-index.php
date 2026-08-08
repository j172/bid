<?php
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

$appDir = '/home/tw123457/bid_app';
$appPort = 3001;
$nodeBin = '/home/tw123457/.nvm/versions/node/v24.19.0/bin/node';
// bin/npm is a shebang (`#!/usr/bin/env node`) script — fine when invoked
// interactively where PATH has the nvm dir first, but PHP's exec() gives the
// shell a bare PATH that resolves `env node` to some other/older system node
// instead, which then can't require() npm's `node:`-prefixed core-module
// specifiers. Invoking the actual JS entrypoint via $nodeBin directly (same
// as $pm2Bin below) sidesteps the shebang/PATH lookup entirely.
$npmCliJs = '/home/tw123457/.nvm/versions/node/v24.19.0/lib/node_modules/npm/bin/npm-cli.js';
$pm2Bin = '/home/tw123457/.nvm/versions/node/v24.19.0/lib/node_modules/pm2/bin/pm2';

// Cloudflare's published edge-node IP ranges — source:
// https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6,
// fetched 2026-08-08. Hardcoded (rather than fetched per-request, or even
// cached) because this list changes rarely and this proxy runs on every
// single request; re-fetch the two URLs above and update these arrays
// manually if Cloudflare ever rotates its edge ranges. See issue #127.
$cloudflareIpv4Ranges = [
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22',
];
$cloudflareIpv6Ranges = [
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32',
];

// Generic CIDR containment check — works for both IPv4 and IPv6 since both
// inet_pton() outputs and the mask are compared as raw bytes rather than
// via any IPv4-specific integer arithmetic.
function ipInCidrRange(string $ip, string $cidr): bool
{
    $parts = explode('/', $cidr, 2);
    if (count($parts) !== 2) {
        return false;
    }
    [$subnet, $maskBitsRaw] = $parts;
    $maskBits = (int) $maskBitsRaw;

    $ipBin = @inet_pton($ip);
    $subnetBin = @inet_pton($subnet);
    if ($ipBin === false || $subnetBin === false || strlen($ipBin) !== strlen($subnetBin)) {
        return false;
    }

    $fullBytes = intdiv($maskBits, 8);
    $remainderBits = $maskBits % 8;

    if ($fullBytes > 0 && substr($ipBin, 0, $fullBytes) !== substr($subnetBin, 0, $fullBytes)) {
        return false;
    }
    if ($remainderBits === 0) {
        return true;
    }

    $mask = chr((0xFF << (8 - $remainderBits)) & 0xFF);
    return (substr($ipBin, $fullBytes, 1) & $mask) === (substr($subnetBin, $fullBytes, 1) & $mask);
}

// Whether $ip (expected to be the raw TCP peer address, i.e.
// $_SERVER['REMOTE_ADDR'] before any rewriting) is a genuine Cloudflare
// edge node per the ranges above.
function isCloudflareEdgeIp(string $ip, array $ipv4Ranges, array $ipv6Ranges): bool
{
    $ranges = strpos($ip, ':') !== false ? $ipv6Ranges : $ipv4Ranges;
    foreach ($ranges as $cidr) {
        if (ipInCidrRange($ip, $cidr)) {
            return true;
        }
    }
    return false;
}

// Baseline security response headers (issue #140 M-3) — the PHP-side twin of
// next.config.js's headers(); see that file's comment for why there is no
// full Content-Security-Policy here either. Called on every response this
// script produces itself (the /__ops/* replies, static assets, proxy errors)
// *and* once more after the proxied response's own headers are forwarded.
// replace=true on purpose in that last case: Node already sent the same set
// via next.config.js, and replacing rather than appending keeps the browser
// from seeing two copies of each header.
function sendSecurityHeaders(): void
{
    header('X-Frame-Options: SAMEORIGIN', true);
    header("Content-Security-Policy: frame-ancestors 'self'", true);
    header('X-Content-Type-Options: nosniff', true);
    header('Referrer-Policy: strict-origin-when-cross-origin', true);
    header('Strict-Transport-Security: max-age=63072000; includeSubDomains', true);
}

// Not hardcoded/committed: this file is public (tracked in a public GitHub
// repo), so the key lives in a sibling file that's uploaded separately by
// the deploy workflow from a GitHub secret and never committed.
$opsKey = trim((string) @file_get_contents(__DIR__ . '/.ops-key'));
if (str_starts_with($path, '/__ops/')) {
    sendSecurityHeaders();
    if ($opsKey === '' || ($_GET['key'] ?? '') !== $opsKey) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Forbidden';
        exit;
    }

    $logFile = $appDir . '/.apply.log';
    $lockFile = $appDir . '/.apply.lock';

    // Shared by /__ops/apply (manual/CI-triggered) and /__ops/pm2-ensure-running
    // (cron-triggered watchdog, see below) — re-extracts the last deployed
    // artifact, swaps it in, restarts pm2, health-probes, and rolls back on
    // failure. Reusing this tested path for the watchdog rather than a bespoke
    // "just pm2 start" matches the same pattern already proven on the health
    // project, where this host has been observed silently killing long-running
    // background processes roughly once a day.
    $buildApplyCommand = static function () use ($appDir, $appPort, $nodeBin, $npmCliJs, $pm2Bin): string {
        $script = "cd {$appDir} "
            . "&& { "
            . "echo '[START] '$(date) > .apply.log; "
            . "rm -rf .next_stage >> .apply.log 2>&1 "
            . "&& mkdir -p .next_stage >> .apply.log 2>&1 "
            . "&& tar --no-same-owner --no-same-permissions -xzf .prebuilt-next.tgz -C .next_stage >> .apply.log 2>&1 "
            . "&& test -s .next_stage/.next/BUILD_ID "
            . "&& test -d .next_stage/.next/server "
            . "&& { if [ -s .prebuilt-public.tgz ]; then tar --no-same-owner --no-same-permissions -xzf .prebuilt-public.tgz -C public >> .apply.log 2>&1 && rm -f .prebuilt-public.tgz; fi; } "
            . "&& rm -rf .next_previous >> .apply.log 2>&1 "
            . "&& { if [ -d .next ]; then mv .next .next_previous; fi; } "
            . "&& mv .next_stage/.next .next >> .apply.log 2>&1 "
            . "&& rmdir .next_stage >> .apply.log 2>&1 "
            . "&& echo '[BUILD_ID] '$(cat .next/BUILD_ID) >> .apply.log "
            // package.json/package-lock.json are shipped alongside the build
            // (see deploy-ftps.yml) purely so this can run — without it, a
            // newly-added dependency (e.g. node-cron for #45) builds fine in
            // CI but is missing from this host's long-lived node_modules,
            // crashing the app at boot on the very first deploy that needs it.
            //
            // `npm ci` (clean-slate reinstall of the whole tree) got SIGKILLed
            // here (exit 137) — this host is known to kill heavy/long-running
            // background processes (see this file's other comment on that),
            // and re-fetching/re-verifying ~500 packages from scratch on every
            // single deploy is exactly the kind of spike that trips it. `npm
            // install` instead does an incremental sync against the existing
            // node_modules — a no-op for everything already present and
            // correct, touching only what package-lock.json actually changed
            // — so the node_modules-aside-backup dance `npm ci` needed (to
            // have something to roll back to if the clean reinstall failed
            // partway) is dropped too: an incremental install can't leave
            // node_modules any more broken than it already was.
            . "&& echo '[NPM_INSTALL] start '$(date) >> .apply.log "
            // --ignore-scripts: the only lifecycle script here is postinstall
            // (scripts/copy-tinymce.mjs, copying tinymce into public/tinymce)
            // and this host never has the scripts/ source dir — CI already
            // ran that same postinstall when it built public/tinymce, which
            // ships to the host in .prebuilt-public.tgz above, so running it
            // again here would just fail on a missing file for no benefit.
            // --no-engine-strict: this host's global npm config promotes
            // EBADENGINE warnings to hard failures otherwise; kept as a
            // defensive guard against future engines mismatches even though
            // this v24.19.0 host already satisfies today's dependencies
            // (e.g. sanitize-html's Node >=22 requirement).
            . "&& { {$nodeBin} {$npmCliJs} install --omit=dev --ignore-scripts --no-audit --no-fund --no-engine-strict --prefer-offline >> .apply.log 2>&1; NPM_INSTALL_EXIT=\$?; echo \"[NPM_INSTALL] exit=\$NPM_INSTALL_EXIT\" >> .apply.log; test \"\$NPM_INSTALL_EXIT\" -eq 0; } "
            . "&& echo '[NPM_INSTALL] done '$(date) >> .apply.log "
            . "&& ({$nodeBin} {$pm2Bin} delete bid-web >> .apply.log 2>&1 || true) "
            . "&& setsid {$nodeBin} {$pm2Bin} start ecosystem.config.cjs --only bid-web >> .apply.log 2>&1 "
            . "&& { PROBE_OK=0; for ATTEMPT in $(seq 1 30); do if curl -fsS --max-time 5 http://127.0.0.1:{$appPort}/ >/dev/null 2>&1; then PROBE_OK=1; break; fi; sleep 1; done; test \"\$PROBE_OK\" = 1; } "
            . "&& echo '[DONE]' $(date) >> .apply.log; "
            . "} || { "
            . "echo '[ROLLBACK] apply or health probe failed' >> .apply.log; "
            . "if [ -d .next_previous ]; then rm -rf .next_failed; mv .next .next_failed 2>/dev/null; mv .next_previous .next; {$nodeBin} {$pm2Bin} restart bid-web >> .apply.log 2>&1 || true; fi; "
            . "echo '[FAIL]' $(date) >> .apply.log; "
            . "}; "
            . "rm -f .apply.lock";

        return "nohup /bin/sh -lc " . escapeshellarg($script) . " >/dev/null 2>&1 &";
    };

    if ($path === '/__ops/apply') {
        $artifact = $appDir . '/.prebuilt-next.tgz';
        if (!is_file($artifact)) {
            header('Content-Type: text/plain; charset=utf-8');
            echo "Artifact missing: {$artifact}\n";
            exit;
        }

        if (is_file($lockFile) && (time() - (int) @filemtime($lockFile)) > 1800) {
            @unlink($lockFile);
        }
        if (is_file($lockFile)) {
            header('Content-Type: text/plain; charset=utf-8');
            echo "Apply already running.\n";
            if (is_file($logFile)) {
                echo file_get_contents($logFile);
            }
            exit;
        }
        @file_put_contents($lockFile, (string) time(), LOCK_EX);
        @exec($buildApplyCommand());

        header('Content-Type: text/plain; charset=utf-8');
        echo "Apply triggered. Check /__ops/status?key=...\n";
        exit;
    }

    if ($path === '/__ops/status') {
        header('Content-Type: text/plain; charset=utf-8');
        echo is_file($lockFile) ? "running\n" : "idle\n";
        echo is_file($logFile) ? file_get_contents($logFile) : "No log yet.\n";
        exit;
    }

    if ($path === '/__ops/pm2-status') {
        header('Content-Type: text/plain; charset=utf-8');
        echo shell_exec(escapeshellarg($nodeBin) . ' ' . escapeshellarg($pm2Bin) . ' describe bid-web 2>&1');
        exit;
    }

    // Meant to be hit by an external cron job (see the deploy workflow /
    // ops docs) so bid-web recovers from this host's periodic process kills
    // without anyone noticing a 502 first — see $buildApplyCommand's comment.
    if ($path === '/__ops/pm2-ensure-running') {
        header('Content-Type: text/plain; charset=utf-8');
        $jlist = shell_exec(escapeshellarg($nodeBin) . ' ' . escapeshellarg($pm2Bin) . ' jlist 2>/dev/null');
        $procs = json_decode($jlist ?: '[]', true);
        if (!is_array($procs)) {
            $procs = [];
        }
        $isOnline = false;
        foreach ($procs as $proc) {
            if (($proc['name'] ?? '') === 'bid-web' && ($proc['pm2_env']['status'] ?? '') === 'online') {
                $isOnline = true;
                break;
            }
        }

        $now = date('Y-m-d H:i:s');
        $watchdogLog = $appDir . '/.pm2-watchdog.log';

        if ($isOnline) {
            echo "[{$now}] bid-web is online. No action taken.\n";
            exit;
        }

        if (is_file($lockFile) && (time() - (int) @filemtime($lockFile)) > 1800) {
            @unlink($lockFile);
        }
        if (is_file($lockFile)) {
            echo "[{$now}] bid-web is not online, but an apply is already running — leaving it alone.\n";
            exit;
        }

        @file_put_contents($watchdogLog, "[{$now}] bid-web was not online (this host periodically kills long-running background processes) — restarting via apply.\n", FILE_APPEND);
        @file_put_contents($lockFile, (string) time(), LOCK_EX);
        @exec($buildApplyCommand());

        echo "[{$now}] bid-web was not online. Restart triggered — check /__ops/status?key=...\n";
        exit;
    }

    http_response_code(404);
    exit;
}

if (str_starts_with($path, '/_next/static/')) {
    sendSecurityHeaders();
    $relative = rawurldecode(substr($path, strlen('/_next/static/')));
    if ($relative === '' || str_contains($relative, "\0") || str_contains($relative, '..')) {
        http_response_code(400);
        exit;
    }

    $root = $appDir . '/.next/static';
    $rootReal = realpath($root);
    $fileReal = realpath($root . '/' . $relative);

    if ($rootReal !== false && $fileReal !== false && is_file($fileReal) && str_starts_with($fileReal, $rootReal . DIRECTORY_SEPARATOR)) {
        $types = [
            'css' => 'text/css; charset=utf-8',
            'js' => 'application/javascript; charset=utf-8',
            'json' => 'application/json; charset=utf-8',
            'map' => 'application/json; charset=utf-8',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
        ];
        $extension = strtolower(pathinfo($fileReal, PATHINFO_EXTENSION));
        header('Content-Type: ' . ($types[$extension] ?? 'application/octet-stream'));
        header('Cache-Control: public, max-age=31536000, immutable');
        header('Content-Length: ' . filesize($fileReal));
        if ($method !== 'HEAD') {
            readfile($fileReal);
        }
        exit;
    }

    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Static asset not found';
    exit;
}

$target = 'http://127.0.0.1:' . $appPort . $uri;

$headers = [];
foreach ($_SERVER as $key => $value) {
    if (strpos($key, 'HTTP_') === 0) {
        $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
        if (!in_array(strtolower($name), ['connection', 'host', 'content-length'])) {
            $headers[] = $name . ': ' . $value;
        }
    }
}
$headers[] = 'Host: ' . ($_SERVER['HTTP_HOST'] ?? 'bid.j172.tw');
$headers[] = 'X-Forwarded-Host: ' . ($_SERVER['HTTP_HOST'] ?? 'bid.j172.tw');
$headers[] = 'X-Forwarded-Proto: https';

// $_SERVER['REMOTE_ADDR'] here is the raw TCP peer address — whatever
// LiteSpeed itself saw, unmodified by any of this script's own logic — so
// this is exactly the "direct connection source" check issue #127 asks
// for. Origin IP is public (see deploy-ftps.yml / the 502 runbook), so a
// forged CF-Connecting-IP/CF-Ray sent straight to origin (bypassing
// Cloudflare) must NOT be trusted just because the header is present —
// only trust them when the TCP peer that actually opened this connection
// is a genuine Cloudflare edge node per the ranges above.
$remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
$realClientIp = $remoteAddr;
$realRayId = null;
if (isCloudflareEdgeIp($remoteAddr, $cloudflareIpv4Ranges, $cloudflareIpv6Ranges)) {
    // Cloudflare edge connected directly — this host has no separate
    // module restoring REMOTE_ADDR to the real visitor IP, so recover it
    // from the header Cloudflare itself sets.
    $cfConnectingIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '';
    if ($cfConnectingIp !== '') {
        $realClientIp = $cfConnectingIp;
    }
    $realRayId = $_SERVER['HTTP_CF_RAY'] ?? null;
}
// Else: REMOTE_ADDR is left as-is (fail-open) — this covers both "the host
// already has a module restoring REMOTE_ADDR to the real visitor IP" and
// "this request never went through Cloudflare at all" (local dev, or a
// direct hit on the origin IP), neither of which should be blocked.

$headers[] = 'X-Forwarded-For: ' . $realClientIp;
if ($realRayId !== null && $realRayId !== '') {
    // New header (not a standard Cloudflare one) carrying the *verified*
    // Ray ID through to Node — see lib/rayId.ts, issue #127.
    $headers[] = 'X-Real-Ray-Id: ' . $realRayId;
}
// Content-Type/Content-Length land in $_SERVER as CONTENT_TYPE/CONTENT_LENGTH,
// not HTTP_CONTENT_TYPE, so the HTTP_-prefix loop above never picks them up.
// Without Content-Type (and its multipart boundary) forwarded, Node has no
// way to parse a multipart/form-data body at all.
if (!empty($_SERVER['CONTENT_TYPE'])) {
    $headers[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}
if (!empty($_SERVER['CONTENT_LENGTH'])) {
    $headers[] = 'Content-Length: ' . $_SERVER['CONTENT_LENGTH'];
}
$body = file_get_contents('php://input');

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    // Must NOT follow redirects here: with this on, curl transparently
    // chases a 3xx from Node (e.g. every redirect()-guarded page — any
    // non-admin hitting /admin/listings/new, or an anonymous visitor
    // hitting /my-bids) and CURLINFO_HEADER_SIZE then covers *all* hops'
    // headers concatenated together. The forwarding loop below assumes a
    // single header block, so two "HTTP/1.1 ..." status lines get run
    // through it at once, producing a malformed response the browser
    // errors on. Passing the 3xx straight through lets the browser do its
    // own redirect, which is what a Next.js redirect() needs anyway (its
    // own follow-up request needs to actually reach the browser to update
    // the URL bar/cookies correctly).
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE']) ? $body : null,
    CURLOPT_ENCODING => '',
    CURLOPT_TIMEOUT => 30,
]);
$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
    sendSecurityHeaders();
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Proxy error: ' . curl_error($ch);
    curl_close($ch);
    exit;
}
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$headerText = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);
curl_close($ch);

http_response_code($status ?: 200);
header_remove();
$lines = preg_split('/\r\n|\r|\n/', trim($headerText));
foreach ($lines as $i => $line) {
    if ($i === 0 || $line === '') {
        continue;
    }
    if (stripos($line, 'Transfer-Encoding:') === 0) continue;
    if (stripos($line, 'Content-Length:') === 0) continue;
    if (stripos($line, 'Content-Encoding:') === 0) continue;
    if (stripos($line, 'Connection:') === 0) continue;
    header($line, false);
}
if ($contentType) {
    header('Content-Type: ' . $contentType);
}
// After the forwarding loop (which appends), so these end up as exactly one
// copy each even though Node sends its own via next.config.js — and so a
// response Node somehow served without them still gets them here.
sendSecurityHeaders();
echo $responseBody;
