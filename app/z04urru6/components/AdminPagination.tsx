import Link from "next/link";
import { buildQueryString, type SearchParams } from "./searchParams";

/**
 * 後台列表頁的上一頁／下一頁區塊（issue #139 M3）—— 六個列表頁原本各自
 * 複製一份結構相同的 JSX。只有一頁時不顯示，維持原本 `totalPages > 1` 的行為。
 */
export default function AdminPagination({
  basePath,
  page,
  totalPages,
  total,
  params,
  keys,
  totalUnit = "筆",
}: {
  basePath: string;
  page: number;
  totalPages: number;
  total: number;
  params: SearchParams;
  /** 換頁時要保留的查詢參數（含 "page" 本身）。 */
  keys: readonly string[];
  /** 「共 N ___」的量詞，使用者列表用「位使用者」。 */
  totalUnit?: string;
}) {
  if (totalPages <= 1) return null;

  const pageHref = (target: number) => `${basePath}?${buildQueryString(params, keys, { page: String(target) })}`;

  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2 text-sm shadow-sm">
      {page > 1 && (
        <Link href={pageHref(page - 1)} className="text-interactive-primary hover:underline">
          上一頁
        </Link>
      )}
      <span className="text-ink-light">
        第 {page} / {totalPages} 頁（共 {total} {totalUnit}）
      </span>
      {page < totalPages && (
        <Link href={pageHref(page + 1)} className="text-interactive-primary hover:underline">
          下一頁
        </Link>
      )}
    </div>
  );
}
