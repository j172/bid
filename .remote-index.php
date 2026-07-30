<?php
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

$appDir = '/home/tw123457/bid_app';
$appPort = 3001;
$nodeBin = '/home/tw123457/.nvm/versions/node/v20.20.2/bin/node';
$pm2Bin = '/home/tw123457/.nvm/versions/node/v20.20.2/lib/node_modules/pm2/bin/pm2';

// Not hardcoded/committed: this file is public (tracked in a public GitHub
// repo), so the key lives in a sibling file that's uploaded separately by
// the deploy workflow from a GitHub secret and never committed.
$opsKey = trim((string) @file_get_contents(__DIR__ . '/.ops-key'));
if (str_starts_with($path, '/__ops/')) {
    if ($opsKey === '' || ($_GET['key'] ?? '') !== $opsKey) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Forbidden';
        exit;
    }

    $logFile = $appDir . '/.apply.log';
    $lockFile = $appDir . '/.apply.lock';

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

        @exec("nohup /bin/sh -lc " . escapeshellarg($script) . " >/dev/null 2>&1 &");

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

    http_response_code(404);
    exit;
}

if (str_starts_with($path, '/_next/static/')) {
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
$headers[] = 'X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
$body = file_get_contents('php://input');

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE']) ? $body : null,
    CURLOPT_ENCODING => '',
    CURLOPT_TIMEOUT => 30,
]);
$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
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
echo $responseBody;
