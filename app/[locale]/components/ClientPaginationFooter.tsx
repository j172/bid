"use client";

// Client-side counterpart to PaginationFooter.tsx (issue #275): same markup
// and PaginationLabels shape, but driven by onClick handlers over an
// in-memory, already-filtered/sorted array instead of Link hrefs into a
// server-paginated query. Used by the pigeon-shops/-stations/-groups
// directory explorers, which do all of their filtering, distance sorting,
// and pagination client-side against server-fetched props (see issue #275's
// "不要改成 URL query 驅動的後端分頁" decision) — a plain PaginationFooter
// would need real page URLs to link to, which these pages don't have.
import type { PaginationLabels } from "./PaginationFooter";

export type { PaginationLabels };

interface ClientPaginationFooterProps {
  pageSizes: readonly number[];
  pageSize: number;
  page: number;
  totalPages: number;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  labels: PaginationLabels;
}

export default function ClientPaginationFooter({
  pageSizes,
  pageSize,
  page,
  totalPages,
  onPageSizeChange,
  onPageChange,
  labels,
}: ClientPaginationFooterProps) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-sm">
      <div className="flex items-center gap-2 text-ink-light">
        <span>{labels.pageSizeLabel}</span>
        {pageSizes.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onPageSizeChange(size)}
            aria-current={size === pageSize}
            className={size === pageSize ? "font-bold text-interactive-primary underline" : "hover:text-interactive-primary"}
          >
            {size}
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          {page > 1 && (
            <button type="button" onClick={() => onPageChange(page - 1)} className="text-interactive-primary hover:underline">
              {labels.prevPage}
            </button>
          )}
          <span className="text-ink-light">{labels.pageInfo}</span>
          {page < totalPages && (
            <button type="button" onClick={() => onPageChange(page + 1)} className="text-interactive-primary hover:underline">
              {labels.nextPage}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
