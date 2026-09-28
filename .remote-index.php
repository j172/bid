<?php
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

// Paths are derived from the account's home directory rather than hard-coded
// to one cPanel account, so this file stays correct on both the current host
// and the sng105 migration target (issue #182) — see the matching comment in
// scripts/remote-apply.sh, which this is kept in lockstep with.
//
// $HOME is deliberately NOT used here: this runs under PHP-FPM, whose
// environment is not the account's login shell and may not carry HOME.
// dirname(__DIR__) is deterministic instead — deploy-ftps.yml uploads this
// file to `<ftp root>/$DOCROOT_DIR/index.php`, and the FTP root is the account
// home, so __DIR__ is always the site's document root sitting one level under
// the home directory, and its parent is that home directory. That holds for
// both sites: bid.j172.tw is an addon domain rooted at `<home>/bid.j172.tw`,
// and xiangshuicn.cc is sng105's MAIN domain rooted at `<home>/public_html`.
// If either the upload destination or that one-level-deep layout ever
// changes, this must change with it.
$homeDir = dirname(__DIR__);
$nvmNodeDir = $homeDir . '/.nvm/versions/node/v24.19.0';

$appDir = $homeDir . '/bid_app';
$appPort = 3001;
// The public hostname this request came in on. Deliberately derived from the
// request rather than hard-coded: one copy of this file serves two sites —
// the legacy bid.j172.tw and the new xiangshuicn.cc (issue #182) — so any
// literal domain here would be wrong on one of them. 'localhost' is only a
// floor for the synthetic loopback probe below, which needs *some* Host
// header; a real browser request always sets HTTP_HOST.
$publicHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
$nodeBin = $nvmNodeDir . '/bin/node';
// bin/npm is a shebang (`#!/usr/bin/env node`) script — fine when invoked
// interactively where PATH has the nvm dir first, but PHP's exec() gives the
// shell a bare PATH that resolves `env node` to some other/older system node
// instead, which then can't require() npm's `node:`-prefixed core-module
// specifiers. Invoking the actual JS entrypoint via $nodeBin directly (same
// as $pm2Bin below) sidesteps the shebang/PATH lookup entirely.
$npmCliJs = $nvmNodeDir . '/lib/node_modules/npm/bin/npm-cli.js';
$pm2Bin = $nvmNodeDir . '/lib/node_modules/pm2/bin/pm2';

$logFile = $appDir . '/.apply.log';
$lockFile = $appDir . '/.apply.lock';
$fastLockFile = $appDir . '/.fast_restart.lock';

// Shared by /__ops/apply (manual/CI-triggered), /__ops/pm2-ensure-running
// (cron-triggered watchdog), and proxy auto-heal escalation — re-extracts the
// last deployed artifact, swaps it in, restarts pm2, health-probes, and rolls
// back on failure. Reusing this tested path for the watchdog rather than a bespoke
// "just pm2 start" matches the same pattern already proven on the health
// project, where this host has been observed silently killing long-running
// background processes roughly once a day.
$buildApplyCommand = static function () use ($appDir, $appPort, $nodeBin, $npmCliJs, $pm2Bin): string {
    $script = "cd {$appDir} "
        . "&& { "
        . "echo '[START] '$(date) > .apply.log; "
        . "chmod -R u+w .next_stage .next_previous public_stage public_previous public_failed .next_failed 2>/dev/null || true; "
        . "rm -rf .next_stage .next_previous public_stage public_previous >> .apply.log 2>&1 "
        . "&& mkdir -p .next_stage >> .apply.log 2>&1 "
        . "&& tar --no-same-owner --no-same-permissions -xzf .prebuilt-next.tgz -C .next_stage >> .apply.log 2>&1 "
        . "&& test -s .next_stage/.next/BUILD_ID "
        . "&& test -d .next_stage/.next/server "
        // The swap below needs public/ to already exist. On a host that
        // has deployed before it always does, but a brand-new app
        // directory has nothing — which is exactly how the xiangshuicn.cc
        // site's first deploy failed (issue #182). mkdir -p is a no-op
        // wherever the directory is already there, so this costs the
        // established site nothing.
        . "&& mkdir -p public >> .apply.log 2>&1 "
        // public/ is staged and swapped (public_stage -> public ->
        // public_previous) exactly like .next above, rather than untarred
        // over the live directory. `tar -x` overwrites same-named files
        // but never deletes files the archive no longer contains, so every
        // asset deleted from the repo used to survive on the server
        // forever — hero-placeholder.png stayed reachable for months after
        // commit 9ebba9f removed it (issue #203). Extracting into a fresh
        // public_stage makes the deployed tree exactly the archive's
        // contents, and the two mv's keep it a swap rather than a gap:
        // `rm -rf public && tar -x` would 404 every static asset
        // (public/tinymce, the whole TinyMCE editor included) for the
        // seconds the extraction takes. Kept in lockstep with
        // scripts/remote-apply.sh.
        . "&& { if [ -s .prebuilt-public.tgz ]; then mkdir -p public_stage >> .apply.log 2>&1 && tar --no-same-owner --no-same-permissions -xzf .prebuilt-public.tgz -C public_stage >> .apply.log 2>&1 && chmod -R u+w public public_previous 2>/dev/null || true && mv public public_previous >> .apply.log 2>&1 && mv public_stage public >> .apply.log 2>&1 && rm -f .prebuilt-public.tgz; fi; } "
        . "&& { if [ -d .next ]; then chmod -R u+w .next .next_previous 2>/dev/null || true && mv .next .next_previous; fi; } "
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
        . "chmod -R u+w public public_failed public_previous .next .next_failed .next_previous 2>/dev/null || true; "
        . "if [ -d public_previous ]; then rm -rf public_failed; mv public public_failed 2>/dev/null; mv public_previous public; fi; "
        . "if [ -d .next_previous ]; then rm -rf .next_failed; mv .next .next_failed 2>/dev/null; mv .next_previous .next; {$nodeBin} {$pm2Bin} restart bid-web >> .apply.log 2>&1 || true; fi; "
        . "echo '[FAIL]' $(date) >> .apply.log; "
        . "}; "
        . "rm -f .apply.lock";

    return "nohup /bin/sh -lc " . escapeshellarg($script) . " >/dev/null 2>&1 &";
};

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

// High-fidelity fallback maintenance/recovery page shown during server wake-up/restarts.
function renderRecoveryPage(): string
{
    return <<<'HTML'
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="3">
    <title>服務正在自動恢復中 | 香水賽鴿</title>
    <style>
        :root {
            --bg: #0b0f19;
            --surface: #111827;
            --surface-border: #1f2937;
            --accent: #3b82f6;
            --accent-glow: rgba(59, 130, 246, 0.35);
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg);
            color: var(--text-main);
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            position: relative;
            overflow: hidden;
        }
        .bg-glow {
            position: absolute;
            width: 480px;
            height: 480px;
            background: radial-gradient(circle, var(--accent-glow) 0%, rgba(11, 15, 25, 0) 70%);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 0;
        }
        .card {
            position: relative;
            z-index: 1;
            background: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid var(--surface-border);
            border-radius: 1.25rem;
            max-width: 460px;
            width: 100%;
            padding: 2.5rem 2rem;
            text-align: center;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        .icon-wrap {
            width: 64px;
            height: 64px;
            margin: 0 auto 1.5rem;
            background: rgba(59, 130, 246, 0.12);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--accent);
            animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-ring {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
            50% { transform: scale(1.04); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
        }
        h1 {
            font-size: 1.4rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
            letter-spacing: -0.02em;
        }
        p {
            font-size: 0.95rem;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 1.75rem;
        }
        .progress-bar {
            width: 100%;
            height: 6px;
            background: #1f2937;
            border-radius: 9999px;
            overflow: hidden;
            margin-bottom: 1.25rem;
            position: relative;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #60a5fa);
            border-radius: 9999px;
            width: 30%;
            animation: progress-move 2.5s ease-in-out infinite;
        }
        @keyframes progress-move {
            0% { transform: translateX(-100%); width: 20%; }
            50% { width: 60%; }
            100% { transform: translateX(400%); width: 30%; }
        }
        .timer-info {
            font-size: 0.875rem;
            color: var(--text-muted);
            margin-bottom: 1.5rem;
        }
        .timer-info strong {
            color: var(--accent);
            font-size: 1rem;
        }
        .btn {
            display: inline-block;
            width: 100%;
            padding: 0.75rem 1.5rem;
            background: #2563eb;
            color: #ffffff;
            font-weight: 600;
            font-size: 0.95rem;
            border-radius: 0.75rem;
            text-decoration: none;
            border: none;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
        }
        .btn:hover {
            background: #1d4ed8;
        }
        .btn:active {
            transform: scale(0.98);
        }
        .footer-note {
            margin-top: 1.75rem;
            font-size: 0.75rem;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="bg-glow"></div>
    <div class="card">
        <div class="icon-wrap">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
        </div>
        <h1>服務節點連線中</h1>
        <p>系統偵測到服務實例正處於喚醒重啟階段，已即時啟動自動修復與快取預熱機制，請稍候片刻。</p>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        <div class="timer-info">
            將在 <strong id="countdown">3</strong> 秒後自動重新整理...
        </div>
        <button class="btn" onclick="window.location.reload()">立即重新載入</button>
        <div class="footer-note">
            香水賽鴿 xiangshuicn.cc • 即時自癒保護中
        </div>
    </div>
    <script>
        let seconds = 3;
        const el = document.getElementById('countdown');
        const timer = setInterval(() => {
            seconds--;
            if (el) el.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(timer);
                window.location.reload();
            }
        }, 1000);
    </script>
</body>
</html>
HTML;
}

// Not hardcoded/committed: this file is public (tracked in a public GitHub
// repo), so the key lives in a sibling file that's uploaded separately by
// the deploy workflow from a GitHub secret and never committed.
$opsKey = trim((string) @file_get_contents(__DIR__ . '/.ops-key'));
if (str_starts_with($path, '/__ops/')) {
    sendSecurityHeaders();
    // hash_equals, not !== : PHP's string comparison short-circuits on the
    // first differing byte, which is a (theoretical, but free to remove)
    // timing side-channel an attacker could use to recover .ops-key one byte
    // at a time. hash_equals compares in constant time. Issue #140 L-1.
    // is_string guards `?key[]=x`, which would otherwise hand hash_equals an
    // array and raise a TypeError.
    $providedKey = $_GET['key'] ?? '';
    if ($opsKey === '' || !is_string($providedKey) || !hash_equals($opsKey, $providedKey)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Forbidden';
        exit;
    }

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
        $now = date('Y-m-d H:i:s');

        // Fast path first, and it spawns nothing.
        //
        // The `pm2 jlist` below is a full Node process, and this endpoint is
        // meant to be hit by cron every 1-2 minutes (see the 502 runbook), so
        // the old unconditional jlist burned dozens of process spawns an hour
        // purely to be told nothing was wrong. health.j172.tw's watchdog does
        // the same thing on the same shared account: on 2026-08-23 the pair
        // filled that account's 20-slot Entry Process ceiling with idle pm2
        // helpers — orphaned Node children left behind whenever the host
        // killed their wrapper mid-call — and wedged it so hard the watchdog
        // could no longer spawn the very process it needed to recover.
        // fsockopen costs zero processes, so the healthy case (almost every
        // tick) now runs entirely inside PHP.
        //
        // This is a fast path, NOT a replacement for the pm2 check. Anything
        // short of a clean HTTP status line falls through to the original
        // logic below, so a slow-but-healthy app costs exactly what it used to
        // and still cannot trigger a spurious restart: the jlist path will see
        // bid-web online and take no action.
        //
        // Deliberate trade-off: while the app answers on :3001 this no longer
        // notices a dead pm2 daemon. That is the right call — a dead daemon
        // with a healthy app is not an outage, and the escalation below still
        // rebuilds it the moment the app actually stops answering.
        $probe = @fsockopen('127.0.0.1', $appPort, $probeErrno, $probeErrstr, 2);
        if ($probe !== false) {
            // A connect alone only proves something holds the port; ask for a
            // status line so a wedged listener still escalates.
            $servingHttp = false;
            @stream_set_timeout($probe, 5);
            if (@fwrite($probe, "HEAD / HTTP/1.0\r\nHost: {$publicHost}\r\nConnection: close\r\n\r\n")) {
                $statusLine = (string) @fgets($probe, 128);
                $servingHttp = (stripos($statusLine, 'HTTP/') === 0);
            }
            @fclose($probe);

            if ($servingHttp) {
                echo "[{$now}] bid-web is online (socket probe, no process spawned). No action taken.\n";
                exit;
            }
        }

        $watchdogLog = $appDir . '/.pm2-watchdog.log';

        // `pm2 jlist` talks to the pm2 daemon over a unix socket, so when the
        // daemon itself is dead — not just bid-web — a bare shell_exec() waits
        // on a socket nothing is listening on and hangs until PHP's own
        // max_execution_time kills the request. The watchdog then goes silent
        // at precisely the moment it is needed: no output, no log line, no
        // restart. health.j172.tw watched that happen during its 2026-08-01
        // outage, where its watchdog fired reliably ~14 times over four days
        // for ordinary "app got killed" events and then said nothing at all
        // once the daemon died. `timeout 5` turns the hang into a fast,
        // detectable failure (exit 124).
        exec('timeout 5 ' . escapeshellarg($nodeBin) . ' ' . escapeshellarg($pm2Bin) . ' jlist 2>/dev/null', $jlistOutput, $jlistExit);
        $daemonResponsive = ($jlistExit === 0);

        $isOnline = false;
        if ($daemonResponsive) {
            $procs = json_decode(implode("\n", $jlistOutput) ?: '[]', true);
            if (!is_array($procs)) {
                $procs = [];
            }
            foreach ($procs as $proc) {
                if (($proc['name'] ?? '') === 'bid-web' && ($proc['pm2_env']['status'] ?? '') === 'online') {
                    $isOnline = true;
                    break;
                }
            }
        } else {
            // Deliberately no daemon rebuild here, unlike health.j172.tw's
            // watchdog (pm2 kill / pkill / unlink the runtime sockets /
            // resurrect). That daemon is shared by both sites on this
            // account, health's watchdog already owns rebuilding it, and its
            // `pm2 resurrect` restores bid-web along with health-web — two
            // watchdogs racing to pkill the same daemon would just deepen the
            // process pile-up this file spent 2026-08-23 digging out of.
            // Falling through as "offline" is enough on its own: the apply
            // below ends in `pm2 start`, which spawns a fresh daemon when
            // none is running.
            @file_put_contents(
                $watchdogLog,
                "[{$now}] pm2 jlist did not respond (exit={$jlistExit}) — the pm2 daemon itself looks dead; treating bid-web as offline so the apply below rebuilds it.\n",
                FILE_APPEND
            );
        }

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
$headers[] = 'Host: ' . $publicHost;
$headers[] = 'X-Forwarded-Host: ' . $publicHost;
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
    $curlErrno = curl_errno($ch);
    $curlError = curl_error($ch);
    curl_close($ch);

    // If the error is a connection failure (Node.js offline / killed / restarting):
    // 7 = CURLE_COULDNT_CONNECT, 56 = CURLE_RECV_ERROR, 52 = CURLE_GOT_NOTHING
    $isConnectionFailure = in_array($curlErrno, [7, 52, 56], true);

    if ($isConnectionFailure) {
        $nowTime = time();
        $fastLockAge = is_file($fastLockFile) ? ($nowTime - (int) @filemtime($fastLockFile)) : 9999;
        $applyLockAge = is_file($lockFile) ? ($nowTime - (int) @filemtime($lockFile)) : 9999;

        // Trigger fast restart if neither lock is actively held
        if ($fastLockAge > 30 && $applyLockAge > 120) {
            @file_put_contents($fastLockFile, (string) $nowTime, LOCK_EX);
            // Non-blocking fast start via setsid PM2
            $fastStartCmd = "cd {$appDir} && { "
                . "echo '[FAST_RESTART] '$(date) >> .apply.log; "
                . "setsid {$nodeBin} {$pm2Bin} start ecosystem.config.cjs --only bid-web >> .apply.log 2>&1 || {$nodeBin} {$pm2Bin} restart bid-web >> .apply.log 2>&1; "
                . "rm -f .fast_restart.lock; "
                . "} >/dev/null 2>&1 &";
            @exec($fastStartCmd);
        }

        // In-flight retry: wait 1.2s and attempt to reconnect
        usleep(1200000);

        $retryCh = curl_init($target);
        curl_setopt_array($retryCh, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE']) ? $body : null,
            CURLOPT_ENCODING => '',
            CURLOPT_TIMEOUT => 25,
        ]);
        $retryResponse = curl_exec($retryCh);
        if ($retryResponse !== false) {
            $ch = $retryCh;
            $response = $retryResponse;
        } else {
            curl_close($retryCh);

            // If fast restart still didn't revive it and no apply is running, trigger full apply
            if (!is_file($lockFile)) {
                @file_put_contents($lockFile, (string) $nowTime, LOCK_EX);
                @exec($buildApplyCommand());
            }

            http_response_code(503);
            sendSecurityHeaders();
            header('Retry-After: 3');
            header('Cache-Control: no-cache, no-store, must-revalidate');

            $isApi = str_starts_with($path, '/api/')
                || (isset($_SERVER['HTTP_ACCEPT']) && stripos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

            if ($isApi) {
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'ok' => false,
                    'error' => 'service_starting',
                    'message' => '服務節點正在自動啟動與校準中，請於 3 秒後重試。',
                    'retry_after' => 3
                ], JSON_UNESCAPED_UNICODE);
            } else {
                header('Content-Type: text/html; charset=utf-8');
                echo renderRecoveryPage();
            }
            exit;
        }
    } else {
        http_response_code(504);
        sendSecurityHeaders();
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Gateway Timeout: ' . $curlError;
        exit;
    }
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
