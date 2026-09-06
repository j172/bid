import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getNewsById, listLatestNews } from "@/lib/news";
import { newsImageUrl } from "@/lib/uploads";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { Link } from "@/i18n/navigation";
import {
  absoluteUrl,
  buildBreadcrumbListJsonLd,
  buildNewsArticleJsonLd,
  canonicalUrl,
  hreflangAlternates,
  stripHtmlToPlainText,
  truncateForMetaDescription,
} from "@/lib/seo";
import { safeJsonLdString } from "@/lib/jsonLdScript";
import DetailWithSidebar from "../../../components/DetailWithSidebar";
import RichTextContent from "../../../components/RichTextContent";
import GooglePreferenceButton from "../../../components/GooglePreferenceButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const newsId = Number(id);
  if (!Number.isFinite(newsId)) return {};

  const item = await getNewsById(newsId);
  if (!item) return {};

  const description = truncateForMetaDescription(stripHtmlToPlainText(item.content));
  const pathname = `/news/${item.id}`;
  const imageUrl = item.imageFileName
    ? absoluteUrl(newsImageUrl(item.imageFileName))
    : absoluteUrl("/images/logo.png");

  return {
    title: item.title,
    description,
    alternates: {
      canonical: canonicalUrl(locale, pathname),
      languages: hreflangAlternates(pathname),
    },
    openGraph: {
      title: item.title,
      description,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
      images: [imageUrl],
    },
  };
}

const SIDEBAR_LATEST_LIMIT = 5;

// Layout reference: NextMerce's "blog-details-with-sidebar" (issue #56) —
// main column carries the title/published time/full content, sidebar carries
// a "最新訊息" list. The layout itself is shared with
// app/[locale]/(no-loading)/pigeon-showcase/[id]/page.tsx via
// DetailWithSidebar (issue #139 item 8). notFound() on a bad/missing id
// mirrors that page's own pattern (no custom not-found.tsx exists anywhere
// in this app — Next's default 404 applies).
export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isFinite(newsId)) {
    notFound();
  }

  const item = await getNewsById(newsId);
  if (!item) {
    notFound();
  }

  const t = await getTranslations("news");
  const sidebarItems = (await listLatestNews(SIDEBAR_LATEST_LIMIT + 1))
    .filter((candidate) => candidate.id !== item.id)
    .slice(0, SIDEBAR_LATEST_LIMIT);

  const newsJsonLd = buildNewsArticleJsonLd({
    title: item.title,
    description: truncateForMetaDescription(stripHtmlToPlainText(item.content)),
    pathname: `/news/${item.id}`,
    datePublished: item.createdAt.toISOString(),
    imageUrl: item.imageFileName ? newsImageUrl(item.imageFileName) : null,
  });

  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: t("breadcrumbHome"), pathname: "/" },
    { name: t("title"), pathname: "/news" },
    { name: item.title, pathname: `/news/${item.id}` },
  ]);

  return (
    <DetailWithSidebar
      breadcrumb={
        <>
          <Link href="/" className="hover:text-interactive-primary">
            {t("breadcrumbHome")}
          </Link>{" "}
          /{" "}
          <Link href="/news" className="hover:text-interactive-primary">
            {t("title")}
          </Link>{" "}
          / {item.title}
        </>
      }
      sidebarTitle={t("sidebarLatest")}
      sidebarItems={sidebarItems.map((sidebarItem) => ({
        id: sidebarItem.id,
        href: `/news/${sidebarItem.id}`,
        primary: sidebarItem.title,
        secondary: sidebarItem.createdAt.toLocaleDateString(),
      }))}
      sidebarEmptyLabel={t("noItems")}
      backHref="/news"
      backLabel={t("backToList")}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(newsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageFileName ? newsImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC}
        alt={item.title}
        loading="eager"
        fetchPriority="high"
        className="max-h-96 w-full rounded-xl object-cover"
      />
      <h1 className="mt-6 text-3xl font-black text-ink">{item.title}</h1>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-light">
          {t("publishedLine", { date: item.createdAt.toLocaleString() })}
        </p>
        <GooglePreferenceButton />
      </div>
      <RichTextContent html={item.content} className="mt-6 border-t border-border pt-6 leading-7 text-ink-light" />
    </DetailWithSidebar>
  );
}
