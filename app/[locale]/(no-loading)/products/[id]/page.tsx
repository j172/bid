import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/products";
import { productPhotoUrl } from "@/lib/uploads";
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
import RichTextContent from "@/app/[locale]/components/RichTextContent";
import YoutubeEmbed from "@/app/[locale]/components/YoutubeEmbed";
import ProductGallery from "./ProductGallery";

export const dynamic = "force-dynamic";

// activeOnly: true (issue #277's acceptance criteria: "下架商品不會出現在
// 前台首頁輪播") — a 下架 product also 404s here for a public visitor even
// with the direct URL, same "unpublished means gone from every public
// surface" rule the rest of this app follows (e.g. deleted/hidden news
// posts). The admin edit form (app/z04urru6/products/) reads through
// lib/products.ts's getProductById WITHOUT activeOnly, so admins can still
// open and re-publish a disabled product.
async function loadActiveProduct(id: string) {
  const productId = Number(id);
  if (!Number.isFinite(productId)) return null;
  return getProductById(productId, { activeOnly: true });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const product = await loadActiveProduct(id);
  if (!product) return {};

  const description = truncateForMetaDescription(stripHtmlToPlainText(product.description));
  const pathname = `/products/${product.id}`;
  const cover = product.photos.find((photo) => photo.isCover) ?? product.photos[0];
  const imageUrl = cover ? absoluteUrl(productPhotoUrl(product.id, cover.fileName)) : absoluteUrl("/images/logo.png");

  return {
    title: product.title,
    description,
    alternates: {
      canonical: canonicalUrl(locale, pathname),
      languages: hreflangAlternates(pathname),
    },
    openGraph: {
      title: product.title,
      description,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await loadActiveProduct(id);
  if (!product) {
    notFound();
  }

  const t = await getTranslations("productDetail");
  const imageUrls = product.photos.map((photo) => productPhotoUrl(product.id, photo.fileName));

  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: t("breadcrumbHome"), pathname: "/" },
    { name: product.title, pathname: `/products/${product.id}` },
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }} />

      <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
        <Link href="/" className="hover:text-interactive-primary">
          {t("breadcrumbHome")}
        </Link>{" "}
        / {t("breadcrumbSelf")}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ProductGallery title={product.title} imageUrls={imageUrls} />

        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-black text-ink">{product.title}</h1>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-light">{t("priceLabel")}</p>
            <p className="mt-2 text-4xl font-black text-interactive-primary">{product.priceText}</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-ink">{t("descriptionHeading")}</h2>
            <RichTextContent html={product.description} className="mt-3 leading-7 text-ink-light" />
          </div>

          {product.youtubeUrl && (
            <div>
              <h2 className="text-lg font-bold text-ink">{t("videoHeading")}</h2>
              <YoutubeEmbed url={product.youtubeUrl} title={product.title} className="mt-3" />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
