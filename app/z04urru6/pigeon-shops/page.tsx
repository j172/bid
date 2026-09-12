import AdminPageIntro from "../AdminPageIntro";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import DeleteConfirmButton from "../components/DeleteConfirmButton";
import PigeonShopFormModal from "./PigeonShopFormModal";
import { listPigeonShops } from "@/lib/pigeonShops";

export const dynamic = "force-dynamic";

// 鴿店地圖目錄後台管理 (issue #243) — manual maintenance on top of the rows
// scripts/import-pigeon-shops.mjs seeded from nicepigeon.com's public 鴿店
// 資訊 articles (see that script's header comment for the one-time import).
export default async function PigeonShopsAdminPage() {
  const shops = await listPigeonShops();

  return (
    <main>
      <AdminPageIntro
        title="鴿店地圖目錄管理"
        description="管理前台「鴿店地圖目錄」（/pigeon-shops）顯示的鴿店聯絡資訊。初始資料由一次性匯入腳本（scripts/import-pigeon-shops.mjs）匯入，之後可在此手動新增、修改或刪除。"
      >
        <PigeonShopFormModal mode="create" />
      </AdminPageIntro>

      {shops.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-base font-semibold text-ink">目前尚無鴿店資料</p>
          <p className="mt-2 text-sm text-ink-light">請點選上方「＋ 新增鴿店」手動新增，或執行一次性匯入腳本。</p>
        </div>
      ) : (
        <div className="mt-6">
          <AdminTable headers={["店名", "分類", "電話", "地址", "座標", ""]}>
            {shops.map((shop) => (
              <AdminTableRow key={shop.id}>
                <AdminTableCell className="font-medium">
                  <p className="max-w-xs font-bold text-ink">{shop.name}</p>
                  {shop.sourceUrl && (
                    <a
                      href={shop.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-interactive-primary hover:underline"
                    >
                      原文連結
                    </a>
                  )}
                </AdminTableCell>
                <AdminTableCell>{shop.category ?? <span className="text-ink-light">未分類</span>}</AdminTableCell>
                <AdminTableCell>{shop.phone ?? <span className="text-ink-light">未知</span>}</AdminTableCell>
                <AdminTableCell className="max-w-xs">
                  {shop.address ?? <span className="text-ink-light">未知</span>}
                </AdminTableCell>
                <AdminTableCell>
                  {shop.lat !== null && shop.lng !== null ? (
                    <span className="font-mono text-xs text-ink-light">
                      {shop.lat.toFixed(4)}, {shop.lng.toFixed(4)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      未定位
                    </span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <PigeonShopFormModal mode="edit" shop={shop} />
                    <DeleteConfirmButton
                      endpoint={`/api/admin/pigeon-shops/${shop.id}`}
                      itemLabel={shop.name}
                      itemNoun="這筆鴿店資料"
                    />
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        </div>
      )}
    </main>
  );
}
