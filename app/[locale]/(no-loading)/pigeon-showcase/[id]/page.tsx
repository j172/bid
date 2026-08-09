import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPigeonShowcaseById, listLatestPigeonShowcase } from "@/lib/pigeonShowcase";
import { pigeonShowcaseImageUrl } from "@/lib/uploads";
import { Link } from "@/i18n/navigation";
import RichTextContent from "../../../components/RichTextContent";

export const dynamic = "force-dynamic";

const SIDEBAR_LATEST_LIMIT = 5;

const CATEGORY_LABEL_KEY = { award: "awardTitle", imported: "importedTitle" } as const;

// Layout reference: NextMerce's "blog-details-with-sidebar" (issue #54) —
// main column carries the category tag/name/loft/full description, sidebar
// carries a "latest in this category" list. notFound() on a bad/missing id
// mirrors app/[locale]/listings/(no-loading)/[id]/page.tsx's own pattern (no
// custom not-found.tsx exists anywhere in this app — Next's default 404
// applies).
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
  const sidebarItems = (await listLatestPigeonShowcase(item.category, SIDEBAR_LATEST_LIMIT + 1)).filter(
    (candidate) => candidate.id !== item.id,
  ).slice(0, SIDEBAR_LATEST_LIMIT);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
        <Link href="/" className="hover:text-interactive-primary">
          {t("breadcrumbHome")}
        </Link>{" "}
        /{" "}
        <Link href={`/pigeon-showcase?category=${item.category}`} className="hover:text-interactive-primary">
          {t(CATEGORY_LABEL_KEY[item.category])}
        </Link>{" "}
        / {item.name}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <article className="min-w-0 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageFileName ? pigeonShowcaseImageUrl(item.imageFileName) : "/images/hero-placeholder.png"}
            alt={item.name}
            className="max-h-96 w-full rounded-xl object-cover"
          />
          <span className="mt-6 inline-flex rounded-full bg-interactive-primary-subtle px-3 py-1 text-xs font-bold uppercase tracking-wide text-interactive-primary">
            {t(CATEGORY_LABEL_KEY[item.category])}
          </span>
          <h1 className="mt-4 text-3xl font-black text-ink">{item.name}</h1>
          <p className="mt-2 text-sm font-semibold text-ink-light">{t("loftLine", { loft: item.loftTitle })}</p>

          <RichTextContent html={item.description} className="mt-6 border-t border-border pt-6 leading-7 text-ink-light" />
        </article>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-light">
              {item.category === "award" ? t("sidebarLatestAward") : t("sidebarLatestImported")}
            </h2>
            {sidebarItems.length === 0 ? (
              <p className="mt-3 text-sm text-ink-light">{t("noItems")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {sidebarItems.map((sidebarItem) => (
                  <li key={sidebarItem.id}>
                    <Link href={`/pigeon-showcase/${sidebarItem.id}`} className="block rounded-lg p-2 transition hover:bg-surface-muted">
                      <p className="truncate text-sm font-semibold text-ink">{sidebarItem.name}</p>
                      <p className="truncate text-xs text-ink-light">{sidebarItem.loftTitle}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href={`/pigeon-showcase?category=${item.category}`}
            className="rounded-2xl border border-border bg-white p-5 text-center text-sm font-bold text-interactive-primary shadow-sm hover:bg-surface-muted"
          >
            {t("backToList")}
          </Link>
        </aside>
      </div>
    </main>
  );
}
