import {
  DEFAULT_FEATURED_LOFT_POST_PAGE_SIZE,
  FEATURED_LOFT_POST_PAGE_SIZES,
  isFeaturedLoftPostPageSize,
  listFeaturedLoftPosts,
} from "@/lib/featuredLoftPosts";
import { listHomepageSections } from "@/lib/homepageSections";
import { featuredLoftPostImageUrl } from "@/lib/uploads";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../components/tableStyles";
import FeaturedLoftPostFormModal from "./FeaturedLoftPostFormModal";
import DeleteConfirmButton from "../components/DeleteConfirmButton";

export const dynamic = "force-dynamic";

const QUERY_KEYS = ["search", "pageSize", "page"] as const;

// 名家專區管理 (issue #176) — modeled directly on app/z04urru6/news/page.tsx
// (this feature is explicitly "最新訊息 but for 名家專區"), replacing #168's
// admin page at app/z04urru6/homepage/featured-lofts/ (removed). The loft
// dropdown data comes from listHomepageSections("partner_loft"), same source
// app/z04urru6/pigeon-showcase/page.tsx uses for its own loft select.
export default async function FeaturedLoftsAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = parseFirstParam(params.search) ?? "";
  const pageSizeRaw = Number(parseFirstParam(params.pageSize));
  const pageSize = isFeaturedLoftPostPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_FEATURED_LOFT_POST_PAGE_SIZE;
  const requestedPage = parsePageParam(params.page);

  // activeOnly defaults to false here (unlike the public homepage/listings
  // pages) so admins can still see — and re-link a post to — every 合作鴿舍,
  // including ones since deactivated on the homepage (same reasoning as the
  // pigeon-showcase admin page's own loft dropdown).
  const [{ items, total }, lofts] = await Promise.all([
    listFeaturedLoftPosts({ search, page: requestedPage, pageSize }),
    listHomepageSections("partner_loft"),
  ]);
  const loftOptions = lofts.map((loft) => ({ id: loft.id, title: loft.title }));
  const loftTitleById = new Map(loftOptions.map((loft) => [loft.id, loft.title]));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // 超出範圍的 page 夾回最後一頁，避免分頁列顯示「第 999 / 3 頁」（issue #139 L3）。
  const page = Math.min(requestedPage, totalPages);

  return (
    <main>
      <AdminPageIntro
        title="名家專區管理"
        description="管理首頁輪播與 /featured-lofts 清單頁使用的名家專區文章：圖片、富文本內容與選填的鴿舍連結。設定鴿舍後，文章詳情頁會顯示「查看商品」按鈕。"
      >
        <FeaturedLoftPostFormModal mode="create" lofts={loftOptions} />
      </AdminPageIntro>

      <form className={filterFormClass} method="GET">
        <label className={filterLabelClass}>
          標題
          <input name="search" defaultValue={search} placeholder="搜尋標題" className={filterControlClass} />
        </label>
        <label className={filterLabelClass}>
          每頁筆數
          <select name="pageSize" defaultValue={String(pageSize)} className={filterControlClass}>
            {FEATURED_LOFT_POST_PAGE_SIZES.map((size) => (
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
        <p className="mt-6 text-ink-light">找不到符合條件的名家專區文章。</p>
      ) : (
        <AdminTable headers={["主圖", "標題", "內容", "鴿舍", "發布時間", ""]}>
          {items.map((item) => {
            const imageUrl = item.imageFileName ? featuredLoftPostImageUrl(item.imageFileName) : "/images/hero-placeholder.png";
            return (
              <AdminTableRow key={item.id}>
                <AdminTableCell>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={item.title} className="h-14 w-14 rounded-lg border border-border object-cover" />
                </AdminTableCell>
                <AdminTableCell className="font-medium">{item.title}</AdminTableCell>
                <AdminTableCell className="max-w-xs truncate text-ink-light">
                  {item.content.replace(/<[^>]*>/g, " ").trim()}
                </AdminTableCell>
                <AdminTableCell className="text-ink-light">
                  {item.loftId ? (loftTitleById.get(item.loftId) ?? "—") : "—"}
                </AdminTableCell>
                <AdminTableCell className="whitespace-nowrap text-ink-light">{item.createdAt.toLocaleString("zh-TW")}</AdminTableCell>
                <AdminTableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <FeaturedLoftPostFormModal
                      mode="edit"
                      lofts={loftOptions}
                      item={{
                        id: item.id,
                        title: item.title,
                        content: item.content,
                        loftId: item.loftId,
                        imageUrl,
                      }}
                    />
                    <DeleteConfirmButton
                      endpoint={`/api/admin/featured-lofts/${item.id}`}
                      itemLabel={item.title}
                      itemNoun="這篇名家專區文章"
                    />
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            );
          })}
        </AdminTable>
      )}

      <AdminPagination
        basePath="/z04urru6/featured-lofts"
        page={page}
        totalPages={totalPages}
        total={total}
        params={params}
        keys={QUERY_KEYS}
      />
    </main>
  );
}
