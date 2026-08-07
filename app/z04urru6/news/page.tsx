import Link from "next/link";
import { DEFAULT_NEWS_PAGE_SIZE, NEWS_PAGE_SIZES, isNewsPageSize, listNews } from "@/lib/news";
import { newsImageUrl } from "@/lib/uploads";
import { listBroadcasts, type Broadcast } from "@/lib/newsletter";
import { BROADCAST_STATUS_LABEL } from "@/lib/broadcastStatusLabel";
import AdminPageIntro from "../AdminPageIntro";
import NewsFormModal from "./NewsFormModal";
import DeleteButton from "./DeleteButton";
import CancelBroadcastButton from "./CancelBroadcastButton";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(params: SearchParams, overrides: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const key of ["search", "pageSize", "page"]) {
    const value = key in overrides ? overrides[key] : first(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}

export default async function NewsAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = first(params.search) ?? "";
  const pageSizeRaw = Number(first(params.pageSize));
  const pageSize = isNewsPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_NEWS_PAGE_SIZE;
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);

  const { items, total } = await listNews({ search, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 電子報狀態 column (issue #80) — status/schedule are never cached on the
  // news_posts row, only the broadcast_id pointer is (see lib/news.ts), so
  // this is resolved live against Resend every render, same "single source
  // of truth" story the old standalone /z04urru6/newsletter status page had.
  // One list call regardless of how many rows are opted in; a fetch failure
  // (not configured / provider error) just means the column shows "—"
  // instead of breaking the whole page.
  const broadcastsResult = await listBroadcasts();
  const broadcastsById = new Map<string, Broadcast>(
    broadcastsResult.ok ? broadcastsResult.broadcasts.map((broadcast) => [broadcast.id, broadcast]) : [],
  );

  return (
    <main>
      <AdminPageIntro title="最新訊息管理" description="管理首頁輪播與 /news 清單頁使用的最新訊息公告。">
        <NewsFormModal mode="create" />
      </AdminPageIntro>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm" method="GET">
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          標題
          <input
            name="search"
            defaultValue={search}
            placeholder="搜尋標題"
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-interactive-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          每頁筆數
          <select name="pageSize" defaultValue={String(pageSize)} className="rounded-md border border-border px-2 py-1 text-sm focus:border-interactive-primary focus:outline-none">
            {NEWS_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active">
          套用
        </button>
      </form>

      {items.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的訊息。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>主圖</th>
                <th className={th}>標題</th>
                <th className={th}>內容</th>
                <th className={th}>發布時間</th>
                <th className={th}>電子報狀態</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const imageUrl = item.imageFileName ? newsImageUrl(item.imageFileName) : "/images/hero-placeholder.png";
                const broadcast = item.broadcastId ? broadcastsById.get(item.broadcastId) : undefined;
                return (
                  <tr key={item.id} className="transition hover:bg-surface-muted/80">
                    <td className={td}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt={item.title} className="h-14 w-14 rounded-lg border border-border object-cover" />
                    </td>
                    <td className={`${td} font-medium`}>{item.title}</td>
                    <td className={`${td} max-w-xs truncate text-ink-light`}>{item.content.replace(/<[^>]*>/g, " ").trim()}</td>
                    <td className={`${td} whitespace-nowrap text-ink-light`}>{item.createdAt.toLocaleString("zh-TW")}</td>
                    <td className={td}>
                      {!item.broadcastId ? (
                        <span className="text-xs text-ink-light">—</span>
                      ) : broadcast ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-ink-light">{BROADCAST_STATUS_LABEL[broadcast.status] ?? broadcast.status}</span>
                          {(broadcast.status === "draft" || broadcast.status === "scheduled") && (
                            <CancelBroadcastButton broadcastId={broadcast.id} />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-light">無法讀取</span>
                      )}
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <NewsFormModal
                          mode="edit"
                          item={{
                            id: item.id,
                            title: item.title,
                            content: item.content,
                            imageUrl,
                            broadcast: broadcast ? { id: broadcast.id, status: broadcast.status, scheduledAt: broadcast.scheduledAt } : null,
                          }}
                        />
                        <DeleteButton id={item.id} title={item.title} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2 text-sm shadow-sm">
          {page > 1 && (
            <Link href={`/z04urru6/news?${buildQuery(params, { page: String(page - 1) })}`} className="text-interactive-primary hover:underline">
              上一頁
            </Link>
          )}
          <span className="text-ink-light">
            第 {page} / {totalPages} 頁（共 {total} 筆）
          </span>
          {page < totalPages && (
            <Link href={`/z04urru6/news?${buildQuery(params, { page: String(page + 1) })}`} className="text-interactive-primary hover:underline">
              下一頁
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
