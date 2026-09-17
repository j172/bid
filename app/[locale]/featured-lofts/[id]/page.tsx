import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getHomepageSectionById } from "@/lib/homepageSections";
import { homepageSectionImageUrl, pigeonShowcaseImageUrl } from "@/lib/uploads";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { excerptHtml } from "@/lib/htmlText";
import { listOpenListings } from "@/lib/listings";
import { listPigeonShowcase } from "@/lib/pigeonShowcase";
import { resolveLoftStatusScope, buildLoftShowcaseUrl } from "@/lib/loftStorefront";
import { buildListingCardView } from "@/lib/listingCardView";
import { currencyForLocale } from "@/lib/currency";
import { getLatestStoredRate } from "@/lib/exchangeRates";
import {
  absoluteUrl,
  buildBreadcrumbListJsonLd,
  canonicalUrl,
  hreflangAlternates,
  stripHtmlToPlainText,
  truncateForMetaDescription,
} from "@/lib/seo";
import { safeJsonLdString } from "@/lib/jsonLdScript";
import { Link } from "@/i18n/navigation";
import ProductCard from "../../components/ProductCard";
import ContentCardGrid from "../../components/ContentCardGrid";
import RichTextContent from "../../components/RichTextContent";

export const dynamic = "force-dynamic";

// The 名家專區 blog-style article page (issue #314 — reverts issue #270's
// "card links straight to /listings?loft=<id>" shortcut). `id` here is the
// featured_loft homepage_sections row's OWN id, never linkedLoftId — see
// FeaturedLoftCarouselCard.tsx and the listings page's #featured-lofts grid,
// both of which now link here instead of straight to the loft's storefront.
const PIGEON_CATEGORY_TITLE_KEY = {
  award: "awardTitle",
  imported: "importedTitle",
  representative: "representativeTitle",
  world_famous: "worldFamousTitle",
} as const;

async function loadFeaturedLoft(id: string) {
  const sectionId = Number(id);
  if (!Number.isFinite(sectionId)) return null;
  const section = await getHomepageSectionById(sectionId);
  if (!section || section.sectionType !== "featured_loft" || !section.isActive) return null;
  return section;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const section = await loadFeaturedLoft(id);
  if (!section) return {};

  const description = section.bio ? truncateForMetaDescription(stripHtmlToPlainText(section.bio)) : undefined;
  const pathname = `/featured-lofts/${section.id}`;
  const imageUrl = absoluteUrl(homepageSectionImageUrl(section.imageFileName));

  return {
    title: section.title,
    description,
    alternates: {
      canonical: canonicalUrl(locale, pathname),
      languages: hreflangAlternates(pathname),
    },
    openGraph: {
      title: section.title,
      description,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: section.title,
      description,
      images: [imageUrl],
    },
  };
}

// notFound() on a bad/missing/inactive id mirrors
// app/[locale]/(no-loading)/pigeon-showcase/[id]/page.tsx's own pattern (no
// custom not-found.tsx exists anywhere in this app — Next's default 404
// applies).
export default async function FeaturedLoftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const section = await loadFeaturedLoft(id);
  if (!section) {
    notFound();
  }

  const t = await getTranslations("featuredLoftDetail");
  const tListings = await getTranslations("listings");
  const tPigeonShowcase = await getTranslations("pigeonShowcase");
  const tFormat = await getTranslations("format");
  const anonymousBuyer = await getTranslations("mask").then((tMask) => tMask("anonymousBuyer"));

  // The admin form requires linkedLoftId on every featured_loft row, but this
  // page stays defensive (treats a null/missing one as "nothing to embed")
  // rather than throwing, since linked_loft_id has no DB-level FK (see
  // lib/homepageSections.ts's header comment).
  const linkedLoftId = section.linkedLoftId;
  const loft = linkedLoftId !== null ? await getHomepageSectionById(linkedLoftId) : null;

  const statusScope = resolveLoftStatusScope(linkedLoftId ?? undefined, undefined);
  const listings =
    linkedLoftId !== null ? await listOpenListings(undefined, { loftId: linkedLoftId, statusScope }) : [];
  const showcaseData =
    linkedLoftId !== null ? await listPigeonShowcase({ loftId: linkedLoftId, pageSize: 100 }) : { items: [], total: 0 };
  const showcaseItems = showcaseData.items;

  // Acceptance criteria: hide the whole embedded section (no empty-state
  // text) when the loft has neither current listings nor showcase pigeons —
  // never show it as an always-present-but-empty block.
  const hasEmbedded = listings.length > 0 || showcaseItems.length > 0;

  const locale = await getLocale();
  const displayCurrencies = currencyForLocale(locale);
  const currencyRates = await Promise.all(
    displayCurrencies.map(async (currency) => ({
      currency,
      rate: currency === "TWD" ? null : ((await getLatestStoredRate(currency))?.rate ?? null),
    })),
  );

  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: t("breadcrumbHome"), pathname: "/" },
    { name: section.title, pathname: `/featured-lofts/${section.id}` },
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }}
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
        <Link href="/" className="hover:text-interactive-primary">
          {t("breadcrumbHome")}
        </Link>{" "}
        / {section.title}
      </p>

      <article className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={homepageSectionImageUrl(section.imageFileName)}
          alt={section.title}
          loading="eager"
          fetchPriority="high"
          className="max-h-96 w-full rounded-xl bg-slate-100 object-contain"
        />
        <h1 className="mt-6 text-3xl font-black text-ink">{section.title}</h1>
        {loft && (
          <Link
            href={buildLoftShowcaseUrl(loft.id)}
            className="mt-2 inline-block text-sm font-semibold text-ink-light hover:text-interactive-primary"
          >
            {t("loftLine", { loft: loft.title })}
          </Link>
        )}
        {section.bio && (
          <RichTextContent html={section.bio} className="mt-6 border-t border-border pt-6 leading-7 text-ink-light" />
        )}
      </article>

      {hasEmbedded && (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
            <h2 className="text-2xl font-bold text-ink">{t("sectionHeading")}</h2>
            {loft && (
              <Link
                href={buildLoftShowcaseUrl(loft.id)}
                className="text-sm font-semibold text-interactive-primary hover:text-header"
              >
                {t("viewLoftLink")}
              </Link>
            )}
          </div>

          {listings.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-ink">{tListings("tabLoftListings")}</h3>
              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {listings.map((listing, index) => {
                  const card = buildListingCardView(listing, { t: tListings, tFormat, currencyRates, anonymousBuyer });
                  return (
                    <ProductCard
                      key={card.id}
                      {...card}
                      eager={index < 4}
                      highPriorityImage={index < 2}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {showcaseItems.length > 0 && (
            <div className="mt-10">
              <h3 className="text-lg font-bold text-ink">{tListings("tabLoftShowcase")}</h3>
              <ContentCardGrid
                items={showcaseItems.map((item) => ({
                  id: item.id,
                  href: `/pigeon-showcase/${item.id}`,
                  imageUrl: item.imageFileName ? pigeonShowcaseImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC,
                  title: item.name,
                  badgeLabel: tPigeonShowcase(PIGEON_CATEGORY_TITLE_KEY[item.category]),
                  excerpt: excerptHtml(item.description, 80),
                }))}
                emptyLabel={tPigeonShowcase("noItems")}
                viewDetailsLabel={tPigeonShowcase("viewDetails")}
              />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
