// Pure client-side pagination slicing for the pigeon-shops/-stations/-groups
// directory explorer pages (issue #275). Those pages render fully
// client-side from a server-fetched array that's already been
// search/county-filtered and distance-sorted in the browser, rather than
// paging through a live query — so unlike lib/pagination.ts's LIMIT/OFFSET
// helper for SQL callers, this one slices an in-memory array and clamps the
// requested page down when it overshoots (e.g. a distance-sort change or a
// filter narrowing the list out from under an already-chosen page).

export interface ClientPage<T> {
  /** The requested page, clamped to the valid [1, totalPages] range. */
  page: number;
  totalPages: number;
  items: T[];
}

export function paginateClientList<T>(items: readonly T[], page: number, pageSize: number): ClientPage<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return { page: safePage, totalPages, items: items.slice(start, start + pageSize) };
}
