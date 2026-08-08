// "Ray ID" for the Cloudflare-styled error pages (see issue #65).
//
// .remote-index.php (the PHP front controller — see that file's header
// comment) validates the raw TCP peer against Cloudflare's published edge
// IP ranges before trusting anything Cloudflare-flavored; when a request
// really did come straight from a Cloudflare edge node, it forwards
// Cloudflare's own `CF-Ray` value as a new `X-Real-Ray-Id` header. This
// module prefers that real, verified Ray ID and only falls back to a fake
// one (a random string in the same 16-lowercase-hex-character shape, purely
// for visual consistency — never persisted or looked up) when the header is
// absent, e.g. local dev, or a request that never went through Cloudflare
// at all. See issue #127 for the full design.
//
// Uses the Web Crypto API (`globalThis.crypto`), which is available both in
// the browser and in Node 20+ (well under this project's current Node 24+
// minimum, see package.json engines) without any import — so this fallback
// works unchanged from a
// Server Component and from a Client Component (error.tsx, global-error.tsx
// call it directly as a last resort; see lib/actions/getRayId.ts for how
// they get the real, header-derived value instead).
export function generateRayId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Reads the verified Ray ID forwarded by .remote-index.php, mirroring
// lib/clientIp.ts's getClientIpFromHeaders. Returns null when the header is
// absent or blank (request didn't come from a verified Cloudflare edge IP,
// or Cloudflare omitted CF-Ray for some reason) so callers know to fall
// back to generateRayId().
export function getRayIdFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-real-ray-id");
  if (!forwarded) return null;

  const trimmed = forwarded.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Convenience for server-side callers that already have a Headers object in
// hand (from next/headers' headers() or a Request): the real forwarded Ray
// ID if present, otherwise the same cosmetic fallback generateRayId() has
// always produced.
export function resolveRayId(headers: Headers): string {
  return getRayIdFromHeaders(headers) ?? generateRayId();
}
