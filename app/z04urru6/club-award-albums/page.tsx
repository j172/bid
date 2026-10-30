import {
  CLUB_AWARD_PAGE_SIZES,
  DEFAULT_CLUB_AWARD_PAGE_SIZE,
  isClubAwardPageSize,
  listClubAwardAlbums,
} from "@/lib/clubAwardPigeons";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import DeleteConfirmButton from "../components/DeleteConfirmButton";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import { SuccessBannerProvider } from "../components/SuccessBanner";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../components/tableStyles";
import ClubAwardAlbumFormModal from "./ClubAwardAlbumFormModal";

export const dynamic = "force-dynamic";

const QUERY_KEYS = ["search", "pageSize", "page"] as const;

export default async function ClubAwardAlbumsAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = parseFirstParam(params.search) ?? "";
  const pageSizeRaw = Number(parseFirstParam(params.pageSize));
  const pageSize = isClubAwardPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_CLUB_AWARD_PAGE_SIZE;
  const requestedPage = parsePageParam(params.page);

  const { items, total } = await listClubAwardAlbums({ search, page: requestedPage, pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return (
    <main>
      <SuccessBannerProvider>
        <AdminPageIntro
          title="各地鴿會相簿管理"
          description="管理「各地鴿會入賞鴿」專區使用的相簿名稱分類。建立相簿後，即可於「各地鴿會入賞鴿」頁面將鴿子歸入指定相簿。"
        >
          <ClubAwardAlbumFormModal mode="create" />
        </AdminPageIntro>

        <form className={filterFormClass} method="GET">
          <label className={filterLabelClass}>
            相簿名稱
            <input name="search" defaultValue={search} placeholder="搜尋相簿名稱" className={filterControlClass} />
          </label>
          <label className={filterLabelClass}>
            每頁筆數
            <select name="pageSize" defaultValue={String(pageSize)} className={filterControlClass}>
              {CLUB_AWARD_PAGE_SIZES.map((size) => (
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
          <p className="mt-6 text-ink-light">找不到符合條件的相簿資料。</p>
        ) : (
          <AdminTable headers={["相簿名稱", "排序值", "鴿子數量", "建立時間", ""]}>
            {items.map((album) => (
              <AdminTableRow key={album.id}>
                <AdminTableCell className="font-medium">{album.name}</AdminTableCell>
                <AdminTableCell>{album.sortOrder}</AdminTableCell>
                <AdminTableCell>{album.pigeonCount} 羽</AdminTableCell>
                <AdminTableCell className="text-ink-light">
                  {album.createdAt.toLocaleDateString("zh-TW")}
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <ClubAwardAlbumFormModal
                      mode="edit"
                      item={{
                        id: album.id,
                        name: album.name,
                        sortOrder: album.sortOrder,
                      }}
                    />
                    <DeleteConfirmButton
                      endpoint={`/api/admin/club-award-albums/${album.id}`}
                      itemLabel={album.name}
                      itemNoun="這個相簿"
                    />
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        )}

        <AdminPagination
          basePath="/z04urru6/club-award-albums"
          page={page}
          totalPages={totalPages}
          total={total}
          params={params}
          keys={QUERY_KEYS}
        />
      </SuccessBannerProvider>
    </main>
  );
}
