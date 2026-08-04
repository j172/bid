import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  getGalleryItemPhotoFileNames,
  getPigeonGalleryCategoryById,
  listPigeonGalleryItems,
  type GalleryType,
} from "@/lib/pigeonGallery";
import { pigeonGalleryItemImageUrl } from "@/lib/uploads";
import { Link } from "@/i18n/navigation";
import ListingGallery from "../../../../listings/[id]/ListingGallery";

export const dynamic = "force-dynamic";

const GALLERY_TYPES: GalleryType[] = ["award", "import"];

function isGalleryType(value: string): value is GalleryType {
  return (GALLERY_TYPES as string[]).includes(value);
}

// Public detail page for a single showcase pigeon (issue #49) — the gallery
// gap the category list page never covered: photos + description. Reuses
// ListingGallery as-is (same gallery/lightbox/keyboard-nav UX as a listing's
// detail page) and the same description-HTML rendering treatment as
// ListingDetailTabs, but with none of the price/bidding/purchase UI —
// display-only, same as the rest of this gallery (see db/init.sql's note on
// pigeon_gallery_items).
export default async function PigeonGalleryItemPage({
  params,
}: {
  params: Promise<{ galleryType: string; categoryId: string; itemId: string }>;
}) {
  const { galleryType: galleryTypeParam, categoryId: categoryIdParam, itemId: itemIdParam } = await params;
  if (!isGalleryType(galleryTypeParam)) {
    notFound();
  }
  const galleryType = galleryTypeParam;

  const categoryId = Number(categoryIdParam);
  const itemId = Number(itemIdParam);
  if (!Number.isFinite(categoryId) || !Number.isFinite(itemId)) {
    notFound();
  }

  const category = await getPigeonGalleryCategoryById(categoryId);
  if (!category || category.galleryType !== galleryType || !category.isActive) {
    notFound();
  }

  const items = await listPigeonGalleryItems(categoryId, { activeOnly: true });
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    notFound();
  }

  // Items created (or never re-edited) before issue #49 have no
  // gallery_item_photos rows yet — fall back to the single legacy photo, same
  // as the admin API routes do (see app/api/admin/pigeon-gallery/items/[id]/route.ts).
  const photoFileNames = await getGalleryItemPhotoFileNames(item.id);
  const imageUrls = (photoFileNames.length > 0 ? photoFileNames : [item.imageFileName]).map(pigeonGalleryItemImageUrl);

  const t = await getTranslations("pigeonGallery");
  const categoryTitle =
    galleryType === "award" ? t("categoryTitleAward", { name: category.name }) : t("categoryTitleImport", { name: category.name });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
          <Link href="/" className="hover:text-interactive-primary">
            {t("breadcrumbHome")}
          </Link>
          {" / "}
          <Link href={`/pigeons/${galleryType}/${categoryId}`} className="hover:text-interactive-primary">
            {categoryTitle}
          </Link>
          {" / "}
          {item.title}
        </p>
        <h1 className="mt-2 text-3xl font-black text-ink">{item.title}</h1>
        {item.loftName && <p className="mt-1 text-sm font-semibold text-ink-light">{item.loftName}</p>}
      </div>

      <div className="mt-6">
        <ListingGallery title={item.title} imageUrls={imageUrls} />
      </div>

      {item.description && (
        <section className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-black text-ink">{t("itemDescriptionHeading")}</h2>
          {/* description is stored pre-sanitized (see lib/sanitizeDescriptionHtml.ts,
              applied by the admin create/edit routes) before ever reaching here — same
              rendering treatment as ListingDetailTabs' description tab. */}
          <div
            className="mt-3 max-w-none leading-7 text-ink-light [&_a]:text-interactive-primary [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: item.description }}
          />
        </section>
      )}
    </main>
  );
}
