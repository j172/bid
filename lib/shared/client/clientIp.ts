// Reads the real visitor IP forwarded by this project's reverse proxy, for
// display on the Cloudflare-styled error pages (see issue #65) and for
// rate-limiting (see the app/api/auth/* routes).
//
// .remote-index.php (the PHP front controller that proxies every request to
// the Node app — see that file's header comment) sets a single-hop
// `X-Forwarded-For: <value>` on every request it forwards. As of issue #127
// that value isn't just the raw TCP peer address anymore: the PHP proxy
// first checks whether the TCP peer is a genuine Cloudflare edge IP against
// a hardcoded copy of Cloudflare's published ranges — only then does it
// trust `CF-Connecting-IP` (Cloudflare's own real-visitor-IP header) as the
// forwarded value, falling back to the raw peer address otherwise (covers
// both "host already restores REMOTE_ADDR itself" and "request bypassed
// Cloudflare entirely", e.g. local dev or a direct hit on the origin IP —
// fail-open, nothing here gets blocked). This prevents a request that
// bypasses Cloudflare and hits the origin directly from spoofing
// `CF-Connecting-IP` to fake an arbitrary client IP.
//
// A generic `x-forwarded-for` can in principle carry a comma-separated
// chain (client, proxy1, proxy2, ...) when multiple proxies are involved,
// so this still takes the left-most entry to be defensive, but in this
// deployment it's always just the one value the PHP proxy set above — the
// parsing logic itself didn't need to change for #127.
export function getClientIpFromHeaders(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (!forwardedFor) return null;

  const first = forwardedFor.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}
