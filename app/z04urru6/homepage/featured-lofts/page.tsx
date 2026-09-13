import { listHomepageSections } from "@/lib/homepageSections";
import { homepageSectionImageUrl } from "@/lib/uploads";
import AdminPageIntro from "../../AdminPageIntro";
import { AdminTable, AdminTableCell, AdminTableRow } from "../../components/AdminTable";
import FeaturedLoftFormModal from "./FeaturedLoftFormModal";
import DeleteButton from "./DeleteButton";

export const dynamic = "force-dynamic";

// 名家專區 (issue #270) — replaces issue #176's standalone featured_loft_posts
// article CMS (list/detail pages + its own admin at /z04urru6/featured-lofts)
// with a lightweight curated-card admin built on the same generic
// homepage_sections CRUD as ../partner-lofts/page.tsx, plus a required
// linkedLoftId pointing at a 合作鴿舍. Kept to a single section_type constant
// here rather than importing one from lib/homepageSections.ts because that
// module deliberately stays section-type-agnostic (see its header comment)
// — this string is this page's concern, not the library's.
const SECTION_TYPE = "featured_loft";

export default async function FeaturedLoftsAdminPage() {
  // activeOnly defaults to false here (unlike the public homepage/listings
  // pages) so admins can still see — and re-enable — disabled rows.
  const [sections, lofts] = await Promise.all([
    listHomepageSections(SECTION_TYPE),
    listHomepageSections("partner_loft"),
  ]);
  const loftOptions = lofts.map((loft) => ({ id: loft.id, title: loft.title }));
  const loftTitleById = new Map(loftOptions.map((loft) => [loft.id, loft.title]));

  return (
    <main>
      <AdminPageIntro title="名家專區管理" description="管理首頁輪播與 /listings 頁面底部區塊使用的名家專區卡片：圖片、富文本內容與必選的關聯鴿舍。首頁／商品列表卡片點擊後都會導向該鴿舍的商品列表。停用後會立即隱藏，不需重新部署。">
        <FeaturedLoftFormModal mode="create" sectionType={SECTION_TYPE} lofts={loftOptions} />
      </AdminPageIntro>

      {sections.length === 0 ? (
        <p className="mt-6 text-ink-light">目前沒有任何名家專區卡片，請點選上方「新增名家專區」建立第一筆資料。</p>
      ) : (
        <AdminTable headers={["圖片", "標題", "內容", "關聯鴿舍", "排序", "狀態", ""]}>
          {sections.map((section) => {
            const imageUrl = homepageSectionImageUrl(section.imageFileName);
            const contentPreview = section.bio ? section.bio.replace(/<[^>]*>/g, " ").trim() : "—";
            return (
              <AdminTableRow key={section.id}>
                <AdminTableCell>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={section.title} className="h-14 w-14 rounded-lg border border-border object-cover" />
                </AdminTableCell>
                <AdminTableCell className="font-medium">{section.title}</AdminTableCell>
                <AdminTableCell className="max-w-xs truncate text-ink-light" title={contentPreview}>
                  {contentPreview}
                </AdminTableCell>
                <AdminTableCell className="text-ink-light">
                  {section.linkedLoftId ? (loftTitleById.get(section.linkedLoftId) ?? "—") : "—"}
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
                    <FeaturedLoftFormModal
                      mode="edit"
                      sectionType={SECTION_TYPE}
                      lofts={loftOptions}
                      section={{
                        id: section.id,
                        title: section.title,
                        bio: section.bio,
                        linkedLoftId: section.linkedLoftId,
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
