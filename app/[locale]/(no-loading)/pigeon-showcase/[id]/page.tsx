import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPigeonShowcaseById, listLatestPigeonShowcase } from "@/lib/pigeonShowcase";
import { pigeonShowcaseImageUrl } from "@/lib/uploads";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { Link } from "@/i18n/navigation";
import DetailWithSidebar from "../../../components/DetailWithSidebar";
import RichTextContent from "../../../components/RichTextContent";

export const dynamic = "force-dynamic";

const SIDEBAR_LATEST_LIMIT = 5;

const CATEGORY_LABEL_KEY = { award: "awardTitle", imported: "importedTitle" } as const;

// Layout reference: NextMerce's "blog-details-with-sidebar" (issue #54) —
// main column carries the category tag/name/loft/full description, sidebar
// carries a "latest in this category" list. The layout itself is shared with
// app/[locale]/(no-loading)/news/[id]/page.tsx via DetailWithSidebar (issue
// #139 item 8). notFound() on a bad/missing id mirrors
// app/[locale]/listings/(no-loading)/[id]/page.tsx's own pattern (no custom
// not-found.tsx exists anywhere in this app — Next's default 404 applies).
export default async function PigeonShowcaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const showcaseId = Number(id);
  if (!Number.isFinite(showcaseId)) {
    notFound();
  }

  const item = await getPigeonShowcaseById(showcaseId);
  if (!item) {
    notFound();
  }

  const t = await getTranslations("pigeonShowcase");
  const sidebarItems = (await listLatestPigeonShowcase(item.category, SIDEBAR_LATEST_LIMIT + 1))
    .filter((candidate) => candidate.id !== item.id)
    .slice(0, SIDEBAR_LATEST_LIMIT);
  const categoryHref = `/pigeon-showcase?category=${item.category}`;

  return (
    <DetailWithSidebar
      breadcrumb={
        <>
          <Link href="/" className="hover:text-interactive-primary">
            {t("breadcrumbHome")}
          </Link>{" "}
          /{" "}
          <Link href={categoryHref} className="hover:text-interactive-primary">
            {t(CATEGORY_LABEL_KEY[item.category])}
          </Link>{" "}
          / {item.name}
        </>
      }
      sidebarTitle={item.category === "award" ? t("sidebarLatestAward") : t("sidebarLatestImported")}
      sidebarItems={sidebarItems.map((sidebarItem) => ({
        id: sidebarItem.id,
        href: `/pigeon-showcase/${sidebarItem.id}`,
        primary: sidebarItem.name,
        secondary: sidebarItem.loftTitle,
      }))}
      sidebarEmptyLabel={t("noItems")}
      backHref={categoryHref}
      backLabel={t("backToList")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageFileName ? pigeonShowcaseImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC}
        alt={item.name}
        className="max-h-96 w-full rounded-xl object-cover"
      />
      <span className="mt-6 inline-flex rounded-full bg-interactive-primary-subtle px-3 py-1 text-xs font-bold uppercase tracking-wide text-interactive-primary">
        {t(CATEGORY_LABEL_KEY[item.category])}
      </span>
      <h1 className="mt-4 text-3xl font-black text-ink">{item.name}</h1>
      <p className="mt-2 text-sm font-semibold text-ink-light">{t("loftLine", { loft: item.loftTitle })}</p>
      <RichTextContent html={item.description} className="mt-6 border-t border-border pt-6 leading-7 text-ink-light" />
    </DetailWithSidebar>
  );
}
