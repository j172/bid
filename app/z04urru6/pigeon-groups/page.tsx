import AdminPageIntro from "../AdminPageIntro";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import DeleteConfirmButton from "../components/DeleteConfirmButton";
import PigeonGroupFormModal from "./PigeonGroupFormModal";
import { listPigeonGroups } from "@/lib/pigeonGroups";

export const dynamic = "force-dynamic";

// 鴿會查詢後台管理 (issue #260) — manual maintenance on top of the rows
// scripts/import-cb-pigeon-groups.mjs seeded from cb-pigeon.com's public
// 鴿會查詢 detail pages (see that script's header comment for the one-time
// import). Modeled directly on app/z04urru6/pigeon-shops/page.tsx.
export default async function PigeonGroupsAdminPage() {
  const groups = await listPigeonGroups();

  return (
    <main>
      <AdminPageIntro
        title="鴿會查詢管理"
        description="管理前台「鴿會查詢」（/pigeon-groups）顯示的鴿會聯絡資訊。初始資料由一次性匯入腳本（scripts/import-cb-pigeon-groups.mjs）匯入，之後可在此手動新增、修改或刪除。"
      >
        <PigeonGroupFormModal mode="create" />
      </AdminPageIntro>

      {groups.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-base font-semibold text-ink">目前尚無鴿會資料</p>
          <p className="mt-2 text-sm text-ink-light">請點選上方「＋ 新增鴿會」手動新增，或執行一次性匯入腳本。</p>
        </div>
      ) : (
        <div className="mt-6">
          <AdminTable headers={["鴿會名稱", "會長", "秘書", "地址", "座標", "連結", ""]}>
            {groups.map((group) => (
              <AdminTableRow key={group.id}>
                <AdminTableCell className="font-medium">
                  <p className="max-w-xs font-bold text-ink">{group.name}</p>
                  {group.sourceUrl && (
                    <a
                      href={group.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-interactive-primary hover:underline"
                    >
                      原文連結
                    </a>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  {group.chairmanName ? (
                    <>
                      <p>{group.chairmanName}</p>
                      {group.chairmanPhone && <p className="text-xs text-ink-light">{group.chairmanPhone}</p>}
                    </>
                  ) : (
                    <span className="text-ink-light">未知</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  {group.secretaryName ? (
                    <>
                      <p>{group.secretaryName}</p>
                      {group.secretaryPhone && <p className="text-xs text-ink-light">{group.secretaryPhone}</p>}
                    </>
                  ) : (
                    <span className="text-ink-light">未知</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="max-w-xs">
                  {group.address ?? <span className="text-ink-light">未知</span>}
                </AdminTableCell>
                <AdminTableCell>
                  {group.lat !== null && group.lng !== null ? (
                    <span className="font-mono text-xs text-ink-light">
                      {group.lat.toFixed(4)}, {group.lng.toFixed(4)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      未定位
                    </span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-col gap-0.5 text-xs">
                    {group.websiteUrl && (
                      <a href={group.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-interactive-primary hover:underline">
                        官網
                      </a>
                    )}
                    {group.pigeonTrackingUrl && (
                      <a href={group.pigeonTrackingUrl} target="_blank" rel="noopener noreferrer" className="text-interactive-primary hover:underline">
                        即時返鴿
                      </a>
                    )}
                    {!group.websiteUrl && !group.pigeonTrackingUrl && <span className="text-ink-light">無</span>}
                  </div>
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <PigeonGroupFormModal mode="edit" group={group} />
                    <DeleteConfirmButton
                      endpoint={`/api/admin/pigeon-groups/${group.id}`}
                      itemLabel={group.name}
                      itemNoun="這筆鴿會資料"
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
