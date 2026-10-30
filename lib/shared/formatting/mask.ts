// Pure formatting for privacy-masked display names — e.g. the public
// listings grid's current-leading-bidder nickname (see
// app/[locale]/listings/page.tsx), where showing a full name would leak
// more than a casual browser needs to know.
// No HTTP/DB involved, so it's directly unit-testable (see mask.test.ts).

export function maskDisplayName(displayName: string | null, anonymousFallback: string): string {
  if (!displayName) {
    return anonymousFallback;
  }
  const chars = Array.from(displayName);
  const [first, ...rest] = chars;
  return rest.length === 0 ? first : first + "*".repeat(rest.length);
}
