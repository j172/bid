// Shared "YYYY-MM-DD HH:mm:ss UTC" formatter for the Cloudflare-styled
// error pages (see issue #65) — matches the timestamp format real
// Cloudflare error pages show, and stays in UTC (rather than the visitor's
// locale/timezone) so it reads the same regardless of which of the three
// site locales the page is rendered in.
export function formatUtcTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}
