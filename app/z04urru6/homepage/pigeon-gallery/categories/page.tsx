import Link from "next/link";
import AdminPageIntro from "../../../AdminPageIntro";
import CategoryManager from "./CategoryManager";
import type { GalleryType } from "@/lib/pigeonGallery";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const TABS: { value: GalleryType; label: string }[] = [
  { value: "award", label: "入賞鴿分類" },
  { value: "import", label: "進口鴿分類" },
];

export default async function PigeonGalleryCategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rawType = first(params.type);
  const galleryType: GalleryType = rawType === "import" ? "import" : "award";

  return (
    <main>
      <AdminPageIntro
        title="入賞鴿／進口鴿分類管理"
        description="管理首頁「入賞鴿展示」與「進口鴿展示」的鴿舍/國家分類（封面圖、名稱、排序、上下架）。"
      />

      <div className="mt-6 flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/z04urru6/homepage/pigeon-gallery/categories?type=${tab.value}`}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              galleryType === tab.value
                ? "bg-interactive-primary text-white"
                : "border border-border bg-surface text-ink-light hover:bg-surface-muted"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <CategoryManager key={galleryType} galleryType={galleryType} />
      </div>
    </main>
  );
}
