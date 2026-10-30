import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getClubAwardPigeonById, listLatestClubAwardPigeonsByAlbum } from "@/lib/pigeons/clubAwardPigeons";
import { clubAwardPigeonImageUrl } from "@/lib/shared/content/uploads";
import { IMAGE_FALLBACK_SRC } from "@/lib/shared/content/imageFallback";
import { Link } from "@/i18n/navigation";
import {
  absoluteUrl,
  buildBreadcrumbListJsonLd,
  canonicalUrl,
  hreflangAlternates,
  stripHtmlToPlainText,
  truncateForMetaDescription,
} from "@/lib/shared/seo/seo";
import { safeJsonLdString } from "@/lib/shared/seo/jsonLdScript";
import { buildLoftShowcaseUrl } from "@/lib/lofts/loftStorefront";
import DetailWithSidebar from "../../../components/DetailWithSidebar";
import RichTextContent from "../../../components/RichTextContent";
import RetryableImage from "@/app/components/RetryableImage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const pigeonId = Number(id);
  if (!Number.isFinite(pigeonId)) return {};

  const item = await getClubAwardPigeonById(pigeonId);
  if (!item) return {};

  const description = truncateForMetaDescription(stripHtmlToPlainText(item.description));
  const pathname = `/club-award-pigeons/${item.id}`;
  const imageUrl = item.imageFileName
    ? absoluteUrl(clubAwardPigeonImageUrl(item.imageFileName))
    : absoluteUrl("/images/logo.png");

  return {
    title: item.name,
    description,
    alternates: {
      canonical: canonicalUrl(locale, pathname),
      languages: hreflangAlternates(pathname),
    },
    openGraph: {
      title: item.name,
      description,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: item.name,
      description,
      images: [imageUrl],
    },
  };
}

const SIDEBAR_LATEST_LIMIT = 5;

const CATEGORY_LABEL_KEY = {
  award: "awardTitle",
  imported: "importedTitle",
  representative: "representativeTitle",
  world_famous: "worldFamousTitle",
} as const;

export default async function ClubAwardPigeonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pigeonId = Number(id);
  if (!Number.isFinite(pigeonId)) {
    notFound();
  }

  const item = await getClubAwardPigeonById(pigeonId);
  if (!item) {
    notFound();
  }

  const t = await getTranslations("clubAwardPigeons");
  const sidebarItems = (await listLatestClubAwardPigeonsByAlbum(item.albumId, SIDEBAR_LATEST_LIMIT + 1))
    .filter((candidate) => candidate.id !== item.id)
    .slice(0, SIDEBAR_LATEST_LIMIT);
  const albumHref = `/club-award-pigeons?albumId=${item.albumId}`;
  const loftHref = item.loftId != null ? buildLoftShowcaseUrl(item.loftId, { tab: "showcase" }) : null;

  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: t("breadcrumbHome"), pathname: "/" },
    { name: t("title"), pathname: "/club-award-pigeons" },
    { name: item.albumTitle, pathname: albumHref },
    { name: item.name, pathname: `/club-award-pigeons/${item.id}` },
  ]);

  return (
    <DetailWithSidebar
      breadcrumb={
        <>
          <Link href="/" className="hover:text-interactive-primary">
            {t("breadcrumbHome")}
          </Link>{" "}
          /{" "}
          <Link href="/club-award-pigeons" className="hover:text-interactive-primary">
            {t("title")}
          </Link>{" "}
          /{" "}
          <Link href={albumHref} className="hover:text-interactive-primary">
            {item.albumTitle}
          </Link>{" "}
          / {item.name}
        </>
      }
      sidebarTitle={t("sidebarLatestAlbum")}
      sidebarItems={sidebarItems.map((sidebarItem) => ({
        id: sidebarItem.id,
        href: `/club-award-pigeons/${sidebarItem.id}`,
        primary: sidebarItem.name,
        secondary: sidebarItem.loftTitle ?? "",
      }))}
      sidebarEmptyLabel={t("noItems")}
      backHref={albumHref}
      backLabel={t("backToList")}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }}
      />
      <RetryableImage
        src={item.imageFileName ? clubAwardPigeonImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC}
        alt={item.name}
        loading="eager"
        fetchPriority="high"
        className="max-h-96 w-full rounded-xl bg-slate-100 object-contain"
      />
      <span className="mt-6 inline-flex rounded-full bg-interactive-primary-subtle px-3 py-1 text-xs font-bold uppercase tracking-wide text-interactive-primary">
        {t(CATEGORY_LABEL_KEY[item.category])}
      </span>
      <h1 className="mt-4 text-3xl font-black text-ink">{item.name}</h1>
      <div className="mt-2 flex flex-col gap-1">
        <Link
          href={albumHref}
          className="inline-block text-sm font-semibold text-ink-light hover:text-interactive-primary"
        >
          {t("albumLine", { album: item.albumTitle })}
        </Link>
        {loftHref && item.loftTitle && (
          <Link
            href={loftHref}
            className="inline-block text-sm font-semibold text-ink-light hover:text-interactive-primary"
          >
            {t("loftLine", { loft: item.loftTitle })}
          </Link>
        )}
        {item.photoSource && (
          <p className="text-sm font-semibold text-ink-light">
            {t("photoSourceLine", { source: item.photoSource })}
          </p>
        )}
      </div>
      <RichTextContent html={item.description} className="mt-6 border-t border-border pt-6 leading-7 text-ink-light" />
    </DetailWithSidebar>
  );
}
