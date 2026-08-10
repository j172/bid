import { DEFAULT_NEWS_PAGE_SIZE, NEWS_PAGE_SIZES, isNewsPageSize, listNews } from "@/lib/news";
import { newsImageUrl } from "@/lib/uploads";
import { listBroadcasts, type Broadcast } from "@/lib/newsletter";
import { BROADCAST_STATUS_LABEL } from "@/lib/broadcastStatusLabel";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import {
  filterControlClass,
  filterFormClass,
  filterLabelClass,
  filterSubmitClass,
  tableRowClass,
  tableWrapperClass,
  td,
  th,
} from "../components/tableStyles";
import NewsFormModal from "./NewsFormModal";
import DeleteConfirmButton from "../components/DeleteConfirmButton";
import CancelBroadcastButton from "./CancelBroadcastButton";

export const dynamic = "force-dynamic";

const QUERY_KEYS = ["search", "pageSize", "page"] as const;

export default async function NewsAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = parseFirstParam(params.search) ?? "";
  const pageSizeRaw = Number(parseFirstParam(params.pageSize));
  const pageSize = isNewsPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_NEWS_PAGE_SIZE;
  const requestedPage = parsePageParam(params.page);

  const { items, total } = await listNews({ search, page: requestedPage, pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // 超出範圍的 page 夾回最後一頁，避免分頁列顯示「第 999 / 3 頁」（issue #139 L3）。
  const page = Math.min(requestedPage, totalPages);

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

      <form className={filterFormClass} method="GET">
        <label className={filterLabelClass}>
          標題
          <input name="search" defaultValue={search} placeholder="搜尋標題" className={filterControlClass} />
        </label>
        <label className={filterLabelClass}>
          每頁筆數
          <select name="pageSize" defaultValue={String(pageSize)} className={filterControlClass}>
            {NEWS_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={filterSubmitClass}>
          套用
        </button>
      </form>

      {items.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的訊息。</p>
      ) : (
        <div className={tableWrapperClass}>
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
                  <tr key={item.id} className={tableRowClass}>
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
                        <DeleteConfirmButton endpoint={`/api/admin/news/${item.id}`} itemLabel={item.title} itemNoun="這則訊息" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination
        basePath="/z04urru6/news"
        page={page}
        totalPages={totalPages}
        total={total}
        params={params}
        keys={QUERY_KEYS}
      />
    </main>
  );
}
