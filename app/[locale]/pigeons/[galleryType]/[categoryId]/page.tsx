import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPigeonGalleryCategoryById, listPigeonGalleryItems, type GalleryType, type PigeonGalleryItem } from "@/lib/pigeonGallery";
import { pigeonGalleryItemImageUrl } from "@/lib/uploads";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

const GALLERY_TYPES: GalleryType[] = ["award", "import"];

function isGalleryType(value: string): value is GalleryType {
  return (GALLERY_TYPES as string[]).includes(value);
}

// Pure display page (issue #45's GRILL ME follow-up removed the former
// type/price-range filter UI and its query-string filtering logic entirely
// — a deliberate simplification, not an oversight: this page is now just
// photos + titles, no filtering of any kind).
export default async function PigeonGalleryCategoryPage({
  params,
}: {
  params: Promise<{ galleryType: string; categoryId: string }>;
}) {
  const { galleryType: galleryTypeParam, categoryId: categoryIdParam } = await params;
  if (!isGalleryType(galleryTypeParam)) {
    notFound();
  }
  const galleryType = galleryTypeParam;

  const categoryId = Number(categoryIdParam);
  if (!Number.isFinite(categoryId)) {
    notFound();
  }

  const category = await getPigeonGalleryCategoryById(categoryId);
  if (!category || category.galleryType !== galleryType || !category.isActive) {
    notFound();
  }

  const [t, items] = await Promise.all([getTranslations("pigeonGallery"), listPigeonGalleryItems(categoryId, { activeOnly: true })]);

  const pageTitle =
    galleryType === "award" ? t("categoryTitleAward", { name: category.name }) : t("categoryTitleImport", { name: category.name });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
          <Link href="/" className="hover:text-interactive-primary">
            {t("breadcrumbHome")}
          </Link>
          {" / "}
          {galleryType === "award" ? t("sectionAwardTitle") : t("sectionImportTitle")}
        </p>
        <h1 className="mt-2 text-3xl font-black text-ink">{pageTitle}</h1>
      </div>

      <section className="mt-6">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-light">{t("showingCount", { count: items.length })}</p>
        </div>

        {items.length === 0 && <p className="mt-6 text-ink-light">{t("emptyState")}</p>}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item: PigeonGalleryItem) => (
            <article key={item.id} className="group rounded-2xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-interactive-primary/60 hover:shadow-md">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                <img
                  src={pigeonGalleryItemImageUrl(item.imageFileName)}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              {/* Plain-text label — never a link (issue #45, same rule as the public listing cards). */}
              {item.loftName && <p className="mt-3 text-xs font-semibold text-ink-light">{item.loftName}</p>}
              <h3 className="mt-1 truncate text-sm font-semibold text-ink">{item.title}</h3>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
