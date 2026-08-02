import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPageIntro from "../../../AdminPageIntro";
import ItemManager from "./ItemManager";
import { getPigeonGalleryCategoryById, listPigeonGalleryCategories } from "@/lib/pigeonGallery";
import { pigeonGalleryCategoryImageUrl } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const GALLERY_LABEL: Record<"award" | "import", string> = { award: "入賞鴿", import: "進口鴿" };

export default async function PigeonGalleryItemsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const categoryIdParam = first(params.categoryId);
  const categoryId = categoryIdParam ? Number(categoryIdParam) : undefined;

  if (categoryId !== undefined) {
    if (!Number.isFinite(categoryId)) {
      notFound();
    }
    const category = await getPigeonGalleryCategoryById(categoryId);
    if (!category) {
      notFound();
    }

    return (
      <main>
        <AdminPageIntro
          title={`「${category.name}」展示項目管理`}
          description={`管理 ${GALLERY_LABEL[category.galleryType]}展示分類「${category.name}」底下的鴿隻項目（圖片、標題、類型、參考價格、排序）。`}
        >
          <Link
            href={`/z04urru6/homepage/pigeon-gallery/categories?type=${category.galleryType}`}
            className="text-sm font-semibold text-interactive-primary hover:underline"
          >
            ← 返回分類管理
          </Link>
        </AdminPageIntro>

        <div className="mt-6">
          <ItemManager categoryId={category.id} />
        </div>
      </main>
    );
  }

  const [awardCategories, importCategories] = await Promise.all([
    listPigeonGalleryCategories("award"),
    listPigeonGalleryCategories("import"),
  ]);

  return (
    <main>
      <AdminPageIntro title="展示項目管理" description="請先選擇要管理項目的分類。" />

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {[
          { label: "入賞鴿分類", categories: awardCategories },
          { label: "進口鴿分類", categories: importCategories },
        ].map((group) => (
          <div key={group.label} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-light">{group.label}</h2>
            {group.categories.length === 0 ? (
              <p className="mt-3 text-sm text-ink-light">尚無分類</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {group.categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/z04urru6/homepage/pigeon-gallery/items?categoryId=${category.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-surface-muted"
                    >
                      <img
                        src={pigeonGalleryCategoryImageUrl(category.coverImageFileName)}
                        alt={category.name}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                      <span className="text-sm font-medium text-ink">{category.name}</span>
                      {!category.isActive && <span className="ml-auto text-xs text-ink-light">已下架</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
