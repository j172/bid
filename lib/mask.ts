// Pure formatting for privacy-masked display names — e.g. the public
// listings grid's "目前出價最高者暱稱" (see app/listings/page.tsx), where
// showing a full name would leak more than a casual browser needs to know.
// No HTTP/DB involved, so it's directly unit-testable (see mask.test.ts).

export function maskDisplayName(displayName: string | null): string {
  if (!displayName) {
    return "匿名買家";
  }
  const chars = Array.from(displayName);
  const [first, ...rest] = chars;
  return rest.length === 0 ? first : first + "*".repeat(rest.length);
}
