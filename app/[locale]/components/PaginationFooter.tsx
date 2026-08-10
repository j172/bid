import { Link } from "@/i18n/navigation";

// Page-size picker + prev/next footer, shared by the 最新訊息 and
// 入賞鴿/進口鴿 list pages (issue #139 item 8). Both built the same bar from
// their own copy of the markup and their own `buildQuery` helper; the query
// building now lives in lib/searchParams.ts and the callers hand the
// finished hrefs down.
export interface PaginationLabels {
  pageSizeLabel: string;
  prevPage: string;
  nextPage: string;
  /** Pre-formatted "第 X / Y 頁，共 Z 筆" sentence. */
  pageInfo: string;
}

interface PaginationFooterProps {
  pageSizes: readonly number[];
  pageSize: number;
  page: number;
  totalPages: number;
  /** Href for switching to a given page size (always returning to page 1). */
  pageSizeHref: (size: number) => string;
  /** Href for a given page number. */
  pageHref: (page: number) => string;
  labels: PaginationLabels;
}

export default function PaginationFooter({
  pageSizes,
  pageSize,
  page,
  totalPages,
  pageSizeHref,
  pageHref,
  labels,
}: PaginationFooterProps) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-sm">
      <div className="flex items-center gap-2 text-ink-light">
        <span>{labels.pageSizeLabel}</span>
        {pageSizes.map((size) => (
          <Link
            key={size}
            href={pageSizeHref(size)}
            className={size === pageSize ? "font-bold text-interactive-primary underline" : "hover:text-interactive-primary"}
          >
            {size}
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="text-interactive-primary hover:underline">
              {labels.prevPage}
            </Link>
          )}
          <span className="text-ink-light">{labels.pageInfo}</span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="text-interactive-primary hover:underline">
              {labels.nextPage}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
