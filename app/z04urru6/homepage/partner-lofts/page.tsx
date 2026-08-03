import { listHomepageSections } from "@/lib/homepageSections";
import { homepageSectionImageUrl } from "@/lib/uploads";
import AdminPageIntro from "../../AdminPageIntro";
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

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

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
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>圖片</th>
                <th className={th}>標題</th>
                <th className={th}>簡介</th>
                <th className={th}>排序</th>
                <th className={th}>狀態</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => {
                const imageUrl = homepageSectionImageUrl(section.imageFileName);
                return (
                  <tr key={section.id} className="transition hover:bg-surface-muted/80">
                    <td className={td}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt={section.title} className="h-14 w-14 rounded-lg border border-border object-cover" />
                    </td>
                    <td className={`${td} font-medium`}>{section.title}</td>
                    <td className={`${td} max-w-xs truncate text-ink-light`} title={section.bio ?? ""}>
                      {section.bio ?? "—"}
                    </td>
                    <td className={td}>{section.sortOrder}</td>
                    <td className={td}>
                      {section.isActive ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">啟用中</span>
                      ) : (
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-light">已停用</span>
                      )}
                    </td>
                    <td className={`${td} text-right`}>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
