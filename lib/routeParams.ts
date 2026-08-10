// Shared parsing for the `[id]` path segment every resource route takes
// (issue #139 M1) — 25 route handlers used to spell out the same
// `Number(id)` + `Number.isFinite` dance before their own 404 response.
//
// Stricter than the old `Number.isFinite` check on purpose: every id in this
// schema is a MySQL AUTO_INCREMENT primary key, so "1.5", "1e3", "-1", ""
// and " " are all just as much "no such row" as "abc" is, and are better
// rejected up front than sent to the DB. Returns null rather than throwing
// so the caller keeps ownership of the 404 message (商品 / 使用者 / 訂單 …).

export function parseIdParam(id: string): number | null {
  if (!/^\d+$/.test(id.trim())) return null;
  const parsed = Number(id.trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}
