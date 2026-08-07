// Shared contract for the live listing-status poll (see
// app/api/listings/[id]/status/route.ts and
// app/[locale]/listings/(no-loading)/[id]/LiveListingStatus.tsx).
// Kept dependency-free (no DB, no React) so it's usable from both the client
// bundle and plain vitest, and so the client can defensively validate
// whatever comes back over the wire instead of trusting it blindly.

export const LISTING_STATUS_POLL_INTERVAL_MS = 4_000;

export interface ListingStatusPayload {
  currentPrice: number;
  /** ISO 8601 string, not a Date — Dates don't survive JSON. */
  endsAt: string;
  /** ISO 8601 string, or null — set only while status is 'scheduled'. */
  startsAt: string | null;
  status: string;
}

// Validates an untrusted parsed-JSON response body from the status endpoint.
// Returns null for anything malformed (wrong shape, non-finite price,
// unparseable date, network body truncated, etc.) so the caller can just
// skip that update and keep showing the last known-good state — the poll
// degrading gracefully rather than crashing the page.
export function parseListingStatusResponse(data: unknown): ListingStatusPayload | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.ok !== true) return null;

  const { currentPrice, endsAt, startsAt, status } = record;
  if (typeof currentPrice !== "number" || !Number.isFinite(currentPrice)) return null;
  if (typeof endsAt !== "string" || Number.isNaN(new Date(endsAt).getTime())) return null;
  if (startsAt !== null && (typeof startsAt !== "string" || Number.isNaN(new Date(startsAt).getTime()))) return null;
  if (typeof status !== "string" || status.length === 0) return null;

  return { currentPrice, endsAt, startsAt, status };
}

// "open" listings can still change (further bids, anti-snipe extensions);
// "scheduled" ones need polling too, just to notice the moment they flip to
// open (the server-side sweep only runs when something reads the row, and
// this poll is exactly the thing making that happen for an actively-viewed
// listing). Any other status is final — nothing left to poll for.
export function isPollableStatus(status: string): boolean {
  return status === "open" || status === "scheduled";
}
