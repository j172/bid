// Cosmetic-only "Ray ID" for the Cloudflare-styled error pages (see issue
// #65) — real Cloudflare Ray IDs are generated at their edge and aren't
// obtainable here, so this just produces a random string in the same shape
// (16 lowercase hex characters) purely so the page looks visually
// consistent with a real Cloudflare error page. It's never persisted or
// used to look anything up.
//
// Uses the Web Crypto API (`globalThis.crypto`), which is available both in
// the browser and in Node 20+ (this project's minimum, see package.json
// engines) without any import — so the same function works unchanged from
// a Server Component (not-found.tsx, the admin layout) and from a Client
// Component (error.tsx, global-error.tsx).
export function generateRayId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
