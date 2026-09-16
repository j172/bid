import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listProducts } from "@/lib/products";
import { productPhotoUrl } from "@/lib/uploads";
import { formatProductPriceText } from "@/lib/productPriceText";
import { Link } from "@/i18n/navigation";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import ProductImage from "@/app/[locale]/components/ProductImage";

export const dynamic = "force-dynamic";

// 商品總覽頁 (issue #298) — the "查看更多" target for the homepage精選商品
// carousel (ProductCarouselCard.tsx), previously nonexistent: `products` only
// had a /products/[id] detail page (issue #277), no index/catalog page.
// Deliberately minimal (grid of active products, no search/filter/pagination)
// — same "activeOnly: true" visibility rule as the detail page (a 下架
// product never appears here either).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "productsCatalog" });
  return {
    title: t("title"),
    alternates: {
      canonical: canonicalUrl(locale, "/products"),
      languages: hreflangAlternates("/products"),
    },
  };
}

export default async function ProductsCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("productsCatalog");
  const products = await listProducts({ activeOnly: true });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
        <Link href="/" className="hover:text-interactive-primary">
          {t("breadcrumbHome")}
        </Link>{" "}
        / {t("breadcrumbSelf")}
      </p>

      <h1 className="mt-3 text-3xl font-black text-ink">{t("title")}</h1>

      {products.length === 0 ? (
        <p className="mt-8 text-ink-light">{t("empty")}</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) => {
            const cover = product.photos.find((photo) => photo.isCover) ?? product.photos[0];
            const imageSrc = cover ? productPhotoUrl(product.id, cover.fileName) : "/images/logo.png";
            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                  <ProductImage src={imageSrc} alt={product.title} eager={index < 4} sizes="(max-width: 640px) 50vw, 25vw" />
                </div>
                <div className="p-3">
                  <h2 className="truncate text-sm font-semibold text-ink">{product.title}</h2>
                  <p className="mt-1 text-base font-black text-interactive-primary">
                    {formatProductPriceText(product.priceText, locale)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
