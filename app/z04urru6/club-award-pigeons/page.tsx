import { listHomepageSections } from "@/lib/homepageSections";
import {
  CLUB_AWARD_PAGE_SIZES,
  DEFAULT_CLUB_AWARD_PAGE_SIZE,
  isClubAwardPageSize,
  listAllClubAwardAlbums,
  listClubAwardPigeons,
  type PigeonShowcaseCategory,
} from "@/lib/clubAwardPigeons";
import { isPigeonShowcaseCategory } from "@/lib/clubAwardPigeonsValidation";
import { clubAwardPigeonImageUrl } from "@/lib/uploads";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import DeleteConfirmButton from "../components/DeleteConfirmButton";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import { SuccessBannerProvider } from "../components/SuccessBanner";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../components/tableStyles";
import ClubAwardPigeonFormModal from "./ClubAwardPigeonFormModal";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<PigeonShowcaseCategory, string> = {
  award: "入賞鴿",
  imported: "進口鴿",
  representative: "代表種鴿",
  world_famous: "世界名鴿",
};

const QUERY_KEYS = ["albumId", "category", "search", "loftId", "pageSize", "page"] as const;

export default async function ClubAwardPigeonsAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const albumIdRaw = parseFirstParam(params.albumId) ?? "";
  const albumIdNum = Number(albumIdRaw);
  const albumId = Number.isInteger(albumIdNum) && albumIdNum > 0 ? albumIdNum : undefined;
  const categoryRaw = parseFirstParam(params.category) ?? "";
  const category = isPigeonShowcaseCategory(categoryRaw) ? categoryRaw : undefined;
  const search = parseFirstParam(params.search) ?? "";
  const loftIdRaw = parseFirstParam(params.loftId) ?? "";
  const loftIdNum = Number(loftIdRaw);
  const loftId = Number.isInteger(loftIdNum) && loftIdNum > 0 ? loftIdNum : undefined;
  const pageSizeRaw = Number(parseFirstParam(params.pageSize));
  const pageSize = isClubAwardPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_CLUB_AWARD_PAGE_SIZE;
  const requestedPage = parsePageParam(params.page);

  const [{ items, total }, albums, lofts] = await Promise.all([
    listClubAwardPigeons({ albumId, category, search, loftId, page: requestedPage, pageSize }),
    listAllClubAwardAlbums(),
    listHomepageSections("partner_loft"),
  ]);
  const albumOptions = albums.map((album) => ({ id: album.id, name: album.name }));
  const loftOptions = lofts.map((loft) => ({ id: loft.id, title: loft.title }));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return (
    <main>
      <SuccessBannerProvider>
        <AdminPageIntro
          title="各地鴿會入賞鴿"
          description="管理「各地鴿會入賞鴿」專區各相簿下的入賞鴿資料（獨立於「鴿種介紹專區」與「世界名鴿介紹專區」）。"
        >
          <ClubAwardPigeonFormModal mode="create" albums={albumOptions} lofts={loftOptions} />
        </AdminPageIntro>

        <form className={filterFormClass} method="GET">
          <label className={filterLabelClass}>
            相簿名稱
            <select name="albumId" defaultValue={albumId ? String(albumId) : ""} className={filterControlClass}>
              <option value="">全部</option>
              {albumOptions.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          </label>
          <label className={filterLabelClass}>
            鴿種
            <select name="category" defaultValue={category ?? ""} className={filterControlClass}>
              <option value="">全部</option>
              <option value="award">入賞鴿</option>
              <option value="imported">進口鴿</option>
              <option value="representative">代表種鴿</option>
              <option value="world_famous">世界名鴿</option>
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
          <p className="mt-6 text-ink-light">找不到符合條件的入賞鴿資料。</p>
        ) : (
          <AdminTable headers={["主圖", "相簿名稱", "排序值", "鴿種", "名稱", "鴿舍", "照片來源", "簡介", ""]}>
            {items.map((item) => {
              const imageUrl = item.imageFileName ? clubAwardPigeonImageUrl(item.imageFileName) : "/images/logo.png";
              return (
                <AdminTableRow key={item.id}>
                  <AdminTableCell>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={item.name}
                      className="h-14 w-14 rounded-lg border border-border object-cover"
                    />
                  </AdminTableCell>
                  <AdminTableCell>{item.albumTitle}</AdminTableCell>
                  <AdminTableCell>{item.sortOrder}</AdminTableCell>
                  <AdminTableCell>{CATEGORY_LABEL[item.category]}</AdminTableCell>
                  <AdminTableCell className="font-medium">{item.name}</AdminTableCell>
                  <AdminTableCell>{item.loftTitle ?? "—"}</AdminTableCell>
                  <AdminTableCell>{item.photoSource ?? "—"}</AdminTableCell>
                  <AdminTableCell className="max-w-xs truncate text-ink-light">
                    {item.description.replace(/<[^>]*>/g, " ").trim()}
                  </AdminTableCell>
                  <AdminTableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ClubAwardPigeonFormModal
                        mode="edit"
                        albums={albumOptions}
                        lofts={loftOptions}
                        item={{
                          id: item.id,
                          albumId: item.albumId,
                          sortOrder: item.sortOrder,
                          category: item.category,
                          name: item.name,
                          loftId: item.loftId,
                          photoSource: item.photoSource,
                          description: item.description,
                          imageUrl,
                        }}
                      />
                      <DeleteConfirmButton
                        endpoint={`/api/admin/club-award-pigeons/${item.id}`}
                        itemLabel={item.name}
                        itemNoun="這筆入賞鴿資料"
                      />
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              );
            })}
          </AdminTable>
        )}

        <AdminPagination
          basePath="/z04urru6/club-award-pigeons"
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
