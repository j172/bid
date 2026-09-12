import AdminPageIntro from "../AdminPageIntro";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import DeleteConfirmButton from "../components/DeleteConfirmButton";
import PigeonStationFormModal from "./PigeonStationFormModal";
import { listPigeonStations } from "@/lib/pigeonStations";

export const dynamic = "force-dynamic";

// 取鴿站管理 (issue #242) — manual CRUD for the pigeon_stations rows seeded
// once by scripts/import-pigeon-stations.mjs. Modeled on
// ../homepage-videos/page.tsx.
export default async function PigeonStationsAdminPage() {
  const stations = await listPigeonStations();
  const unmappedCount = stations.filter((station) => station.lat === null || station.lng === null).length;

  return (
    <main>
      <AdminPageIntro
        title="取鴿站管理"
        description="管理全台取鴿站名錄，前台「取鴿站地圖目錄」頁面會顯示以下所有資料。緯度／經度留空的站點僅會出現在前台列表，不會顯示在地圖上。"
      >
        <div className="flex items-center gap-3">
          {unmappedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {unmappedCount} 筆尚未定位座標
            </span>
          )}
          <PigeonStationFormModal mode="create" />
        </div>
      </AdminPageIntro>

      {stations.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-base font-semibold text-ink">目前尚無取鴿站資料</p>
          <p className="mt-2 text-sm text-ink-light">請點選上方「＋ 新增取鴿站」手動新增。</p>
        </div>
      ) : (
        <div className="mt-6">
          <AdminTable headers={["名稱", "電話", "地址", "座標", ""]}>
            {stations.map((station) => (
              <AdminTableRow key={station.id}>
                <AdminTableCell className="font-medium text-ink">{station.name}</AdminTableCell>
                <AdminTableCell>{station.phone}</AdminTableCell>
                <AdminTableCell className="max-w-xs">{station.address}</AdminTableCell>
                <AdminTableCell>
                  {station.lat !== null && station.lng !== null ? (
                    <span className="font-mono text-xs text-ink-light">
                      {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      未定位
                    </span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <PigeonStationFormModal
                      mode="edit"
                      station={{
                        id: station.id,
                        name: station.name,
                        phone: station.phone,
                        address: station.address,
                        lat: station.lat,
                        lng: station.lng,
                        sourceUrl: station.sourceUrl,
                      }}
                    />
                    <DeleteConfirmButton
                      endpoint={`/api/admin/pigeon-stations/${station.id}`}
                      itemLabel={station.name}
                      itemNoun="這個取鴿站"
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
