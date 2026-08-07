// Reads the real visitor IP forwarded by this project's reverse proxy, for
// display on the Cloudflare-styled error pages (see issue #65).
//
// .remote-index.php (the PHP front controller that proxies every request to
// the Node app — see that file's header comment) sets a single-hop
// `X-Forwarded-For: <REMOTE_ADDR>` on every request it forwards. A generic
// `x-forwarded-for` can in principle carry a comma-separated chain
// (client, proxy1, proxy2, ...) when multiple proxies are involved, so this
// still takes the left-most entry to be defensive, but in this deployment
// it's always just the one IP the PHP proxy saw.
export function getClientIpFromHeaders(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (!forwardedFor) return null;

  const first = forwardedFor.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}
