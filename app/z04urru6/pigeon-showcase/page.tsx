import { listHomepageSections } from "@/lib/homepageSections";
import {
  PIGEON_SHOWCASE_PAGE_SIZES,
  DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE,
  isPigeonShowcasePageSize,
  listPigeonShowcase,
  type PigeonShowcaseCategory,
} from "@/lib/pigeonShowcase";
import { isPigeonShowcaseCategory } from "@/lib/pigeonShowcaseValidation";
import { pigeonShowcaseImageUrl } from "@/lib/uploads";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../components/tableStyles";
import PigeonShowcaseFormModal from "./PigeonShowcaseFormModal";
import DeleteConfirmButton from "../components/DeleteConfirmButton";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<PigeonShowcaseCategory, string> = { award: "入賞鴿", imported: "進口鴿", representative: "代表種鴿" };

const QUERY_KEYS = ["category", "search", "loftId", "pageSize", "page"] as const;

export default async function PigeonShowcaseAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const categoryRaw = parseFirstParam(params.category) ?? "";
  const category = isPigeonShowcaseCategory(categoryRaw) ? categoryRaw : undefined;
  const search = parseFirstParam(params.search) ?? "";
  const loftIdRaw = parseFirstParam(params.loftId) ?? "";
  const loftId = loftIdRaw ? Number(loftIdRaw) : undefined;
  const pageSizeRaw = Number(parseFirstParam(params.pageSize));
  const pageSize = isPigeonShowcasePageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE;
  const requestedPage = parsePageParam(params.page);

  // activeOnly: false — admins need to see/filter by every 合作鴿舍, including
  // ones since deactivated on the homepage, since pigeon_showcase rows can
  // still reference them (same reasoning as the partner-lofts admin page).
  const [{ items, total }, lofts] = await Promise.all([
    listPigeonShowcase({ category, search, loftId, page: requestedPage, pageSize }),
    listHomepageSections("partner_loft"),
  ]);
  const loftOptions = lofts.map((loft) => ({ id: loft.id, title: loft.title }));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // 超出範圍的 page 夾回最後一頁，避免分頁列顯示「第 999 / 3 頁」（issue #139 L3）。
  const page = Math.min(requestedPage, totalPages);

  return (
    <main>
      <AdminPageIntro title="入賞鴿／進口鴿／代表種鴿管理" description="管理首頁輪播與分類清單頁使用的入賞鴿／進口鴿／代表種鴿資料。">
        <PigeonShowcaseFormModal mode="create" lofts={loftOptions} />
      </AdminPageIntro>

      <form className={filterFormClass} method="GET">
        <label className={filterLabelClass}>
          鴿種
          <select name="category" defaultValue={category ?? ""} className={filterControlClass}>
            <option value="">全部</option>
            <option value="award">入賞鴿</option>
            <option value="imported">進口鴿</option>
            <option value="representative">代表種鴿</option>
          </select>
        </label>
        <label className={filterLabelClass}>
          名稱
          <input name="search" defaultValue={search} placeholder="搜尋名稱" className={filterControlClass} />
        </label>
        <label className={filterLabelClass}>
          鴿舍
          <select name="loftId" defaultValue={loftId ? String(loftId) : ""} className={filterControlClass}>
            <option value="">全部</option>
            {loftOptions.map((loft) => (
              <option key={loft.id} value={loft.id}>
                {loft.title}
              </option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          每頁筆數
          <select name="pageSize" defaultValue={String(pageSize)} className={filterControlClass}>
            {PIGEON_SHOWCASE_PAGE_SIZES.map((size) => (
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
        <p className="mt-6 text-ink-light">找不到符合條件的鴿況資料。</p>
      ) : (
        <AdminTable headers={["主圖", "鴿種", "名稱", "鴿舍", "簡介", ""]}>
          {items.map((item) => {
            const imageUrl = item.imageFileName ? pigeonShowcaseImageUrl(item.imageFileName) : "/images/hero-placeholder.png";
            return (
              <AdminTableRow key={item.id}>
                <AdminTableCell>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={item.name} className="h-14 w-14 rounded-lg border border-border object-cover" />
                </AdminTableCell>
                <AdminTableCell>{CATEGORY_LABEL[item.category]}</AdminTableCell>
                <AdminTableCell className="font-medium">{item.name}</AdminTableCell>
                <AdminTableCell>{item.loftTitle}</AdminTableCell>
                <AdminTableCell className="max-w-xs truncate text-ink-light">
                  {item.description.replace(/<[^>]*>/g, " ").trim()}
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <PigeonShowcaseFormModal
                      mode="edit"
                      lofts={loftOptions}
                      item={{
                        id: item.id,
                        category: item.category,
                        name: item.name,
                        loftId: item.loftId,
                        description: item.description,
                        imageUrl,
                      }}
                    />
                    <DeleteConfirmButton
                      endpoint={`/api/admin/pigeon-showcase/${item.id}`}
                      itemLabel={item.name}
                      itemNoun="這筆鴿況資料"
                    />
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            );
          })}
        </AdminTable>
      )}

      <AdminPagination
        basePath="/z04urru6/pigeon-showcase"
        page={page}
        totalPages={totalPages}
        total={total}
        params={params}
        keys={QUERY_KEYS}
      />
    </main>
  );
}
