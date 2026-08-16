import { listHomepageSections } from "@/lib/homepageSections";
import { homepageSectionImageUrl } from "@/lib/uploads";
import AdminPageIntro from "../../AdminPageIntro";
import { AdminTable, AdminTableCell, AdminTableRow } from "../../components/AdminTable";
import PartnerLoftFormModal from "./PartnerLoftFormModal";
import DeleteButton from "./DeleteButton";

export const dynamic = "force-dynamic";

// 合作鴿舍 (see GitHub issue #34) — the first concrete admin page built on
// top of the generic homepage_sections CRUD from #33. Kept to a single
// section_type constant here rather than importing one from lib/
// homepageSections.ts because that module deliberately stays
// section-type-agnostic (see its header comment) — this string is this
// page's concern, not the library's.
const SECTION_TYPE = "partner_loft";

export default async function PartnerLoftsAdminPage() {
  // activeOnly defaults to false here (unlike the public homepage) so
  // admins can still see — and re-enable — disabled rows.
  const sections = await listHomepageSections(SECTION_TYPE);

  return (
    <main>
      <AdminPageIntro title="合作鴿舍管理" description="管理首頁「合作鴿舍」區塊的卡片：圖片、簡介與排序。首頁卡片點擊後會導向該鴿舍的商品列表。停用後會立即從首頁隱藏，不需重新部署。">
        <PartnerLoftFormModal mode="create" sectionType={SECTION_TYPE} />
      </AdminPageIntro>

      {sections.length === 0 ? (
        <p className="mt-6 text-ink-light">目前沒有任何合作鴿舍卡片，請點選上方「新增合作鴿舍」建立第一筆資料。</p>
      ) : (
        <AdminTable headers={["圖片", "標題", "簡介", "排序", "狀態", ""]}>
          {sections.map((section) => {
            const imageUrl = homepageSectionImageUrl(section.imageFileName);
            return (
              <AdminTableRow key={section.id}>
                <AdminTableCell>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={section.title} className="h-14 w-14 rounded-lg border border-border object-cover" />
                </AdminTableCell>
                <AdminTableCell className="font-medium">{section.title}</AdminTableCell>
                <AdminTableCell className="max-w-xs truncate text-ink-light" title={section.bio ?? ""}>
                  {section.bio ?? "—"}
                </AdminTableCell>
                <AdminTableCell>{section.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  {section.isActive ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">啟用中</span>
                  ) : (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-light">已停用</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <PartnerLoftFormModal
                      mode="edit"
                      sectionType={SECTION_TYPE}
                      section={{
                        id: section.id,
                        title: section.title,
                        bio: section.bio,
                        sortOrder: section.sortOrder,
                        isActive: section.isActive,
                        imageUrl,
                      }}
                    />
                    <DeleteButton id={section.id} title={section.title} />
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            );
          })}
        </AdminTable>
      )}
    </main>
  );
}
